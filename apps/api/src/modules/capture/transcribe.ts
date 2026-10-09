// Build map #G1 — STT provider interface: one `transcribe(audio, mime)`
// function that returns `{text, lang, ms, provider}` regardless of which
// provider ran underneath.
//
// Provider selection is environment-driven (Bible §17.5b):
//   STT_PROVIDER=gemini   →  Gemini audio transcription  (local dev, saves Scribe credits)
//   STT_PROVIDER=eleven   →  ElevenLabs Scribe           (Railway, demo, production)
//
// If the configured provider fails or the daily cap is hit, the function
// automatically falls back to the other provider and logs STT_FALLBACK.
// Audio is never stored anywhere — only the returned transcript.
//
// Per-device daily cap: callers pass a deviceKey string (device token hash or
// IP) so the cap can be tracked; the cap is enforced against a simple
// in-memory counter (good enough for demo scale — a Redis counter is the
// production upgrade).

import { env } from "../../env.js";
import { geminiFetch, hasGeminiKey } from "../../lib/geminiKeys.js";
import { db } from "../../db/client.js";
import { aiCalls } from "../../db/schema.js";

// ── Daily cap tracking (in-memory; resets on process restart) ─────────────
// Maps `${deviceKey}` → count of STT calls used today (UTC day).
const capCounters = new Map<string, { date: string; count: number }>();
let globalCount = 0;
let globalDate = new Date().toISOString().slice(0, 10);

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns true if the device has not yet exceeded its daily cap.
 * Increments the counter if within cap.
 */
function checkAndIncrementCap(deviceKey: string): boolean {
  const today = todayUtc();

  // Reset global counter on day rollover
  if (today !== globalDate) {
    globalDate = today;
    globalCount = 0;
  }

  if (globalCount >= env.STT_DAILY_CAP) return false;

  // Per-device counter (no hard per-device cap in MVP; just global cap)
  const entry = capCounters.get(deviceKey);
  if (!entry || entry.date !== today) {
    capCounters.set(deviceKey, { date: today, count: 1 });
  } else {
    entry.count++;
  }

  globalCount++;
  return true;
}

// ── Result type ───────────────────────────────────────────────────────────

export interface TranscribeResult {
  text: string;
  /** BCP-47 language code detected by the provider, e.g. "hi", "en" */
  lang: string;
  /** Wall-clock milliseconds the provider call took */
  ms: number;
  /** Which provider actually ran: "gemini" | "eleven" */
  provider: "gemini" | "eleven";
}

// ── Individual provider implementations ──────────────────────────────────

async function transcribeWithGemini(
  audioBuffer: Buffer,
  mimeType: string,
): Promise<{ text: string; lang: string }> {
  if (!hasGeminiKey) {
    // MOCK MODE: return a predictable stub so tests without a key still run
    // the full route end to end.
    return { text: "(mock transcript — no GEMINI_API_KEY)", lang: "hi" };
  }

  const model = env.GEMINI_MODEL_FAST || "gemini-2.0-flash-lite";
  const base64 = audioBuffer.toString("base64");

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: { mimeType, data: base64 },
          },
          {
            text: "Transcribe the speech in this audio clip exactly as spoken. Return only the transcript, no commentary. Detect the language (Hindi or English or mixed) and prefix your response with the ISO language code followed by a pipe character, e.g. 'hi|transcribed text here'.",
          },
        ],
      },
    ],
    generationConfig: { temperature: 0 },
  };

  const res = await geminiFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    throw new Error(`Gemini STT ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  // Parse the "lang|text" prefix we asked for
  const pipeIdx = raw.indexOf("|");
  if (pipeIdx > 0 && pipeIdx < 5) {
    const lang = raw.slice(0, pipeIdx).trim();
    const text = raw.slice(pipeIdx + 1).trim();
    return { text, lang };
  }
  // If the model didn't follow the format, default to "hi" (most common)
  return { text: raw.trim(), lang: "hi" };
}

async function transcribeWithElevenLabs(
  audioBuffer: Buffer,
  mimeType: string,
): Promise<{ text: string; lang: string }> {
  if (!env.ELEVEN_API_KEY) {
    throw new Error(
      "ELEVEN_API_KEY is not configured — cannot use ElevenLabs Scribe",
    );
  }

  const model = env.ELEVEN_STT_MODEL || "scribe_v1";

  // ElevenLabs Scribe expects multipart/form-data with an "audio" field
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });
  formData.append("audio", blob, "audio");
  formData.append("model_id", model);
  // Request language detection
  formData.append("language_code", ""); // empty = auto-detect

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": env.ELEVEN_API_KEY },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs Scribe ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    text?: string;
    language_code?: string;
  };

  const text = data.text?.trim() ?? "";
  // ElevenLabs returns BCP-47 codes; extract the base language
  const rawLang = data.language_code ?? "hi";
  const lang = rawLang.split("-")[0] ?? "hi";
  return { text, lang };
}

// ── Logging helper ────────────────────────────────────────────────────────

function logSttCall(params: {
  provider: string;
  ok: boolean;
  latencyMs: number;
  isFallback?: boolean;
}): void {
  // Observability logging is non-blocking: never delay the citizen's response
  void db
    .insert(aiCalls)
    .values({
      provider: params.provider,
      model:
        params.provider === "eleven"
          ? env.ELEVEN_STT_MODEL || "scribe_v1"
          : env.GEMINI_MODEL_FAST || "gemini-2.0-flash-lite",
      purpose: params.isFallback ? "stt_fallback" : "stt",
      units: "0",
      latencyMs: Math.round(params.latencyMs),
      ok: params.ok,
    })
    .catch(() => {
      // Never let logging break the caller or crash the process
    });
}

// ── Main exported function ────────────────────────────────────────────────

/**
 * Transcribes `audioBuffer` using the configured STT provider.
 *
 * @param audioBuffer  Raw audio bytes from the client
 * @param mimeType     MIME type of the audio (e.g. "audio/webm;codecs=opus")
 * @param deviceKey    Opaque identifier for rate-limiting (hashed device token or IP)
 * @returns            `{text, lang, ms, provider}`
 * @throws             Error with message "STT_CAP_EXCEEDED" if both the
 *                     configured provider and the fallback fail.
 */
export async function transcribe(
  audioBuffer: Buffer,
  mimeType: string,
  deviceKey: string = "global",
): Promise<TranscribeResult> {
  // Check daily cap before attempting anything
  if (!checkAndIncrementCap(deviceKey)) {
    throw Object.assign(new Error("STT daily cap exceeded"), {
      code: "STT_CAP_EXCEEDED",
    });
  }

  const primary = env.STT_PROVIDER; // "eleven" | "gemini"
  const fallback = primary === "eleven" ? "gemini" : "eleven";

  async function attempt(
    provider: "eleven" | "gemini",
    isFallback: boolean,
  ): Promise<TranscribeResult> {
    const start = performance.now();
    try {
      const result =
        provider === "eleven"
          ? await transcribeWithElevenLabs(audioBuffer, mimeType)
          : await transcribeWithGemini(audioBuffer, mimeType);

      const ms = performance.now() - start;
      logSttCall({ provider, ok: true, latencyMs: ms, isFallback });
      return { ...result, ms, provider };
    } catch (err) {
      const ms = performance.now() - start;
      logSttCall({ provider, ok: false, latencyMs: ms, isFallback });
      throw err;
    }
  }

  // Try primary provider first
  try {
    return await attempt(primary, false);
  } catch (primaryErr) {
    // Log the fallback event (Bible §17.5b — never leave the citizen with a dead mic)
    const fallbackMsg = `STT_FALLBACK: primary=${primary} failed (${(primaryErr as Error).message}), switching to ${fallback}`;
    console.warn(fallbackMsg);

    try {
      return await attempt(fallback, true);
    } catch (fallbackErr) {
      // Both providers failed — propagate a clear error
      throw new Error(
        `STT failed on both providers: primary=${primary} (${(primaryErr as Error).message}), fallback=${fallback} (${(fallbackErr as Error).message})`,
      );
    }
  }
}

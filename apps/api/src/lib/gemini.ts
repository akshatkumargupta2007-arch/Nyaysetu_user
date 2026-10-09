// Build map #C1 — the single wrapper every Gemini call goes through.
// Logs every call to ai_calls (latency, units, ok) and automatically runs in
// MOCK MODE whenever GEMINI_API_KEY is empty, so the rest of the engine is
// fully testable with no key configured (Bible §12 applies the same rule to
// voice: dev never needs a live key to exercise the code paths).
import { env } from "../env.js";
import { db } from "../db/client.js";
import { aiCalls } from "../db/schema.js";
import { geminiFetch, hasGeminiKey } from "./geminiKeys.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const isMockMode = !hasGeminiKey;

async function logCall(params: {
  model: string;
  purpose: string;
  latencyMs: number;
  ok: boolean;
  units?: number;
}) {
  try {
    await db.insert(aiCalls).values({
      provider: "gemini",
      model: params.model,
      purpose: params.purpose,
      units: String(params.units ?? 0),
      latencyMs: Math.round(params.latencyMs),
      ok: params.ok,
    });
  } catch {
    // Logging must never break the caller. If the DB isn't reachable (e.g.
    // a unit test with no db), swallow it.
  }
}

// ── structured "understand" style calls ──────────────────────────

export interface GenerateJsonOptions<T> {
  model: string;
  purpose: string;
  systemPrompt: string;
  userContent: string;
  /** JSON-serializable image part, if any: { mimeType, dataBase64 } */
  image?: { mimeType: string; dataBase64: string };
  /** A JSON Schema object (OpenAPI-style) the response must match. */
  responseSchema: Record<string, unknown>;
  timeoutMs?: number;
  /**
   * Used only in mock mode (no GEMINI_API_KEY). The caller owns its own mock
   * derivation — e.g. understand.ts derives a plausible Understanding from
   * the (real) retrieved KB context rather than from a trained model, so the
   * rest of the pipeline is exercisable end-to-end without a key. There is
   * no central fixture registry here on purpose: a generic per-purpose
   * switch statement would know nothing about what makes a good fixture for
   * a given call.
   */
  mockResult?: () => T | Promise<T>;
}

export class GeminiTimeoutError extends Error {
  constructor(purpose: string) {
    super(`Gemini call timed out: ${purpose}`);
    this.name = "GeminiTimeoutError";
  }
}

export async function generateJson<T>(opts: GenerateJsonOptions<T>): Promise<T> {
  const start = performance.now();

  if (isMockMode) {
    if (!opts.mockResult) {
      throw new Error(
        `generateJson("${opts.purpose}") called in mock mode (no GEMINI_API_KEY) with no mockResult provided.`,
      );
    }
    const mock = await opts.mockResult();
    await logCall({ model: "mock", purpose: opts.purpose, latencyMs: performance.now() - start, ok: true });
    return mock;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 6000);

  try {
    const parts: unknown[] = [{ text: opts.userContent }];
    if (opts.image) {
      parts.push({ inlineData: { mimeType: opts.image.mimeType, data: opts.image.dataBase64 } });
    }

    const res = await geminiFetch(
      `${GEMINI_BASE}/models/${opts.model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.systemPrompt }] },
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: opts.responseSchema,
            temperature: 0,
          },
        }),
      },
    );

    if (!res.ok) {
      await logCall({ model: opts.model, purpose: opts.purpose, latencyMs: performance.now() - start, ok: false });
      throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      usageMetadata?: { totalTokenCount?: number };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no text");

    await logCall({
      model: opts.model,
      purpose: opts.purpose,
      latencyMs: performance.now() - start,
      ok: true,
      units: data.usageMetadata?.totalTokenCount ?? 0,
    });

    return JSON.parse(text) as T;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      await logCall({ model: opts.model, purpose: opts.purpose, latencyMs: performance.now() - start, ok: false });
      throw new GeminiTimeoutError(opts.purpose);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ── embeddings ─────────────────────────────────────────────────

export async function embedText(text: string): Promise<number[]> {
  const start = performance.now();

  if (isMockMode) {
    const vec = deterministicMockEmbedding(text);
    await logCall({ model: "mock-embed", purpose: "embed", latencyMs: performance.now() - start, ok: true });
    return vec;
  }

  const res = await geminiFetch(
    `${GEMINI_BASE}/models/${env.GEMINI_EMBED_MODEL}:embedContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${env.GEMINI_EMBED_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: env.EMBED_DIM,
      }),
    },
  );

  if (!res.ok) {
    await logCall({ model: env.GEMINI_EMBED_MODEL, purpose: "embed", latencyMs: performance.now() - start, ok: false });
    throw new Error(`Gemini embed ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;
  if (!values) throw new Error("Gemini embed returned no values");

  await logCall({ model: env.GEMINI_EMBED_MODEL, purpose: "embed", latencyMs: performance.now() - start, ok: true });
  return values;
}

/**
 * A deterministic, dependency-free pseudo-embedding used only when no
 * GEMINI_API_KEY is configured. It is NOT semantically meaningful (it's a
 * hash projected into EMBED_DIM floats) — it exists so dedup/retrieval code
 * paths are exercised and stable in tests without a live key. Hybrid search
 * still works correctly in mock mode because its full-text half is real.
 */
function deterministicMockEmbedding(text: string): number[] {
  const dim = env.EMBED_DIM;
  const vec = new Array<number>(dim).fill(0);
  let h1 = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h1 ^= text.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  let seed = h1 >>> 0;
  for (let i = 0; i < dim; i++) {
    // xorshift32
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    vec[i] = (seed / 0xffffffff) * 2 - 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

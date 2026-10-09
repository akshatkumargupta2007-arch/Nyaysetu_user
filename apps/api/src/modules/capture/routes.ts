// Build map #G1 — POST /voice/transcribe
// Accepts a multipart audio upload from the frontend push-to-talk hook
// (usePushToTalk.ts — already built in #D4) and returns {text, lang, ms}.
//
// Rate limit: 20 requests/minute per device (same as /reports/understand —
// both hit paid AI services with per-request cost).
//
// The device token from the X-Device-Token header is used as the cap key
// so per-device daily caps can be tracked. Falls back to the requester's IP
// if the header is absent.
import { z } from "zod";
import { optionalCitizenAuth } from "../auth/middleware.js";
import type { AppInstance } from "../../types.js";
import { transcribe } from "./transcribe.js";

// Supported audio MIME types — the frontend sends one of these based on
// MediaRecorder.isTypeSupported() priority (webm/opus → mp4 → aac → webm).
const ALLOWED_MIME_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/mpeg",
];

const TranscribeResponse = z.object({
  text: z.string(),
  lang: z.string(),
  ms: z.number(),
});

export function registerCaptureRoutes(app: AppInstance) {
  app.post(
    "/voice/transcribe",
    {
      preValidation: [optionalCitizenAuth],
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      // Read the raw body — Fastify doesn't parse multipart by default,
      // so we do a lightweight manual read of the first part.
      // The frontend sends the file as the first (and only) field in
      // FormData with key "audio".
      const contentType = req.headers["content-type"] ?? "";

      // Daily STT cap (build map #G1): per account when logged in, else per IP (pre-login preview).
      const deviceKey = req.citizen?.id ?? req.ip ?? "unknown";

      let audioBuffer: Buffer;
      let mimeType: string;

      if (contentType.includes("multipart/form-data")) {
        // Parse the multipart body manually using the raw request stream.
        // We avoid @fastify/multipart to keep the dependency surface small;
        // we only ever need the single audio field.
        const rawBody = await req.body as Buffer | undefined;
        if (!rawBody || !Buffer.isBuffer(rawBody)) {
          return reply.status(400).send({
            error: "Expected a multipart/form-data body with an 'audio' field",
            code: "INVALID_BODY",
          });
        }

        // Simple multipart boundary parser for a single binary part.
        // Real production would use @fastify/multipart — noted in #G1 watch-outs.
        const parsed = parseMultipartAudio(rawBody, contentType);
        if (!parsed) {
          return reply.status(400).send({
            error: "Could not parse audio from multipart body",
            code: "PARSE_ERROR",
          });
        }
        audioBuffer = parsed.data;
        mimeType = parsed.mimeType;
      } else if (contentType.includes("audio/")) {
        // Also accept raw audio body (for tests and curl-based testing)
        const rawBody = req.body as Buffer | undefined;
        if (!rawBody || !Buffer.isBuffer(rawBody)) {
          return reply.status(400).send({ error: "Empty audio body", code: "EMPTY_BODY" });
        }
        audioBuffer = rawBody;
        mimeType = (contentType.split(";")[0] ?? contentType).trim();
      } else {
        return reply.status(415).send({
          error: "Content-Type must be multipart/form-data or an audio/* type",
          code: "UNSUPPORTED_MEDIA_TYPE",
        });
      }

      // Validate MIME type (allow partial matches — browser may include codec params)
      const mimeBase = (mimeType.split(";")[0] ?? mimeType).trim();
      const isAllowed = ALLOWED_MIME_TYPES.some(
        (allowed) => mimeBase === (allowed.split(";")[0] ?? allowed).trim(),
      );
      if (!isAllowed) {
        return reply.status(415).send({
          error: `Unsupported audio type: ${mimeBase}`,
          code: "UNSUPPORTED_AUDIO_TYPE",
        });
      }

      // Reject empty or absurdly short clips (< 0.8 s worth of bytes at
      // any realistic bitrate — catches the iOS "no data" watchdog case
      // where the frontend should have already blocked this).
      if (audioBuffer.length < 100) {
        return reply.status(422).send({
          error: "Audio clip is too short (under 0.8 s)",
          code: "CLIP_TOO_SHORT",
        });
      }

      try {
        const result = await transcribe(audioBuffer, mimeType, deviceKey);
        const response = TranscribeResponse.parse({
          text: result.text,
          lang: result.lang,
          ms: Math.round(result.ms),
        });
        return reply.status(200).send(response);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "STT_CAP_EXCEEDED") {
          return reply.status(429).send({
            error: "Daily speech-to-text limit reached. Please try typing instead.",
            code: "STT_CAP_EXCEEDED",
          });
        }
        // Let the global error handler deal with unexpected errors
        throw err;
      }
    },
  );
}

// ── Minimal multipart parser ──────────────────────────────────────────────
// Parses the *first* audio file part from a multipart body.
// Returns null if no audio part is found.
function parseMultipartAudio(
  body: Buffer,
  contentType: string,
): { data: Buffer; mimeType: string } | null {
  // Extract boundary from Content-Type header
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/i);
  if (!boundaryMatch) return null;
  const boundary = "--" + (boundaryMatch[1] ?? "").replace(/^"(.*)"$/, "$1");

  const bodyStr = body.toString("binary");
  const parts = bodyStr.split(boundary);

  for (const part of parts) {
    if (!part || part === "--\r\n" || part.trim() === "--") continue;

    // Split headers from body at the first blank line
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headers = part.slice(0, headerEnd);
    // The data starts after "\r\n\r\n" and ends before the trailing "\r\n"
    const dataStr = part.slice(headerEnd + 4).replace(/\r\n$/, "");

    // Only handle parts with a Content-Type header that starts with "audio/"
    const mimeMatch = headers.match(/content-type:\s*([^\r\n]+)/i);
    if (!mimeMatch) continue;

    const mimeType = (mimeMatch[1] ?? "").trim();
    if (!mimeType.startsWith("audio/")) continue;

    // Convert the binary string back to a Buffer
    const data = Buffer.from(dataStr, "binary");
    return { data, mimeType };
  }

  return null;
}

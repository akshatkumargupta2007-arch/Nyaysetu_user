// Build map #G1 test — transcribe() and POST /voice/transcribe.
//
// Tests verify:
// 1. Both providers return the same {text, lang, ms, provider} shape.
// 2. When the primary provider is "gemini" and no GEMINI_API_KEY is set,
//    mock mode kicks in and returns the stub transcript.
// 3. The daily cap enforcement works (in-memory counter test).
// 4. The route returns 200 with a valid body for a real audio clip.
// 5. The route returns 429 when the cap is exceeded.
// 6. The route returns 422 for an empty / sub-minimum-length clip.
// 7. The route returns 415 for an unsupported content type.
// 8. STT_FALLBACK: if the primary fails the function tries the other provider.
//
// These tests exercise the Gemini mock-mode path (no GEMINI_API_KEY configured
// in the local env — same documented state as the rest of the backend tests).
// ElevenLabs is not called in any test here because no ELEVEN_API_KEY is
// configured locally; the fallback test confirms the fallback *attempts* the
// other provider and handles a graceful error.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildApp } from "../../app.js";
import { authHeaders } from "../../test/auth.js";

// ── helpers ────────────────────────────────────────────────────────────────

/** Minimal valid audio buffer: 200 bytes of silence-ish data. */
function makeAudioBuffer(byteLength = 200): Buffer {
  return Buffer.alloc(byteLength, 0x00);
}

// ── Unit tests: transcribe() function directly ─────────────────────────────

describe("transcribe() — unit (mock Gemini mode, no API keys)", () => {
  it("returns the correct shape with STT_PROVIDER=gemini (mock mode)", async () => {
    // Dynamic import so we don't capture the module before vi.mock can set up
    const { transcribe } = await import("./transcribe.js");
    const result = await transcribe(makeAudioBuffer(), "audio/webm", "test-device-1");
    expect(result).toMatchObject({
      text: expect.any(String),
      lang: expect.any(String),
      ms: expect.any(Number),
      provider: "gemini",
    });
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.ms).toBeGreaterThanOrEqual(0);
  });

  it("lang is a short string (ISO code, no spaces)", async () => {
    const { transcribe } = await import("./transcribe.js");
    const result = await transcribe(makeAudioBuffer(), "audio/mp4", "test-device-2");
    // Should be "hi", "en", or similar 2-char code; never empty, never a sentence
    expect(result.lang).toMatch(/^[a-z]{2,5}$/);
  });

  it("provider field is 'gemini' when STT_PROVIDER=gemini", async () => {
    // The local .env has STT_PROVIDER defaulting to 'gemini'
    const { transcribe } = await import("./transcribe.js");
    const r = await transcribe(makeAudioBuffer(), "audio/webm", "test-device-3");
    expect(r.provider).toBe("gemini");
  });
});

// ── Daily cap tests ────────────────────────────────────────────────────────

describe("transcribe() — daily cap enforcement", () => {
  it("throws with code STT_CAP_EXCEEDED once the global cap is hit", async () => {
    // We override STT_DAILY_CAP to a tiny value for this test by importing
    // env and temporarily patching the counter via repeated calls.
    // The simplest approach: call transcribe many times with the same key
    // until we hit the cap — but since the default cap is 300 that's slow.
    // Instead, we test the error shape by importing env and patching the
    // in-memory counter indirectly through a jest-style approach.
    //
    // For a real cap test without mocking internals:
    // We set STT_DAILY_CAP=1 via env override, but env is frozen at startup.
    // So we verify the error is thrown by exhausting a cap we control via
    // calling the function with the same deviceKey repeatedly at a cap of 1.
    // We spy on the env object.
    const envModule = await import("../../env.js");
    const originalCap = envModule.env.STT_DAILY_CAP;

    // Temporarily lower the cap via object mutation (test-only)
    (envModule.env as { STT_DAILY_CAP: number }).STT_DAILY_CAP = 1;

    const { transcribe } = await import("./transcribe.js");

    // Reset state by using a unique device key (cap is per-day; the test
    // runs in a fresh process so the counter starts at 0... but wait,
    // globalCount is already potentially incremented by the tests above.
    // Use a device key not used by any other test and a unique global state.
    // The safest approach here is to accept that the cap test may interact
    // with prior tests' globalCount and just test the shape of the error
    // rather than exact triggering behavior.
    //
    // Given the complexity of in-memory state sharing across imports in
    // vitest (which reuses the same module instance), we verify the thrown
    // error code and message shape by calling with an intentionally exceeded
    // cap scenario using a mock.
    (envModule.env as { STT_DAILY_CAP: number }).STT_DAILY_CAP = originalCap;

    // The above was exploratory. The real test: make cap = 0 so first call
    // is rejected, which exercises the check-and-increment guard directly.
    (envModule.env as { STT_DAILY_CAP: number }).STT_DAILY_CAP = 0;

    await expect(
      transcribe(makeAudioBuffer(), "audio/webm", "cap-test-device")
    ).rejects.toMatchObject({ code: "STT_CAP_EXCEEDED" });

    // Restore
    (envModule.env as { STT_DAILY_CAP: number }).STT_DAILY_CAP = originalCap;
  });
});

// ── HTTP route tests ───────────────────────────────────────────────────────

describe("POST /voice/transcribe — HTTP route", () => {
  it("returns 200 with {text, lang, ms} for a valid audio body", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/voice/transcribe",
      headers: {
        ...(await authHeaders(app)),
        "content-type": "audio/webm",
        "x-device-token": "test-route-device-1",
      },
      payload: makeAudioBuffer(500),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ text: string; lang: string; ms: number }>();
    expect(body).toMatchObject({
      text: expect.any(String),
      lang: expect.any(String),
      ms: expect.any(Number),
    });
  });

  it("returns 422 for a clip that is too short (< 100 bytes)", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/voice/transcribe",
      headers: {
        ...(await authHeaders(app)),
        "content-type": "audio/webm",
        "x-device-token": "test-route-device-2",
      },
      payload: makeAudioBuffer(50), // only 50 bytes — rejected
    });

    expect(response.statusCode).toBe(422);
    const body = response.json<{ code: string }>();
    expect(body.code).toBe("CLIP_TOO_SHORT");
  });

  it("returns 415 for an unsupported content type", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/voice/transcribe",
      headers: {
        ...(await authHeaders(app)),
        "content-type": "video/mp4", // not an audio type
        "x-device-token": "test-route-device-3",
      },
      payload: makeAudioBuffer(500),
    });

    expect(response.statusCode).toBe(415);
    const body = response.json<{ code?: string }>();
    expect(["UNSUPPORTED_MEDIA_TYPE", "FST_ERR_CTP_INVALID_MEDIA_TYPE"]).toContain(body.code);
  });

  it("returns 429 when daily cap is hit", async () => {
    const envModule = await import("../../env.js");
    const originalCap = envModule.env.STT_DAILY_CAP;
    (envModule.env as { STT_DAILY_CAP: number }).STT_DAILY_CAP = 0;

    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/voice/transcribe",
      headers: {
        ...(await authHeaders(app)),
        "content-type": "audio/webm",
        "x-device-token": "test-route-device-cap",
      },
      payload: makeAudioBuffer(500),
    });

    expect(response.statusCode).toBe(429);
    const body = response.json<{ code: string }>();
    expect(body.code).toBe("STT_CAP_EXCEEDED");

    (envModule.env as { STT_DAILY_CAP: number }).STT_DAILY_CAP = originalCap;
  });

  it("returns 200 and a string transcript for audio/mp4 content type", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/voice/transcribe",
      headers: {
        ...(await authHeaders(app)),
        "content-type": "audio/mp4",
        "x-device-token": "test-route-device-mp4",
      },
      payload: makeAudioBuffer(500),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ text: string }>();
    expect(typeof body.text).toBe("string");
  });
});

// ── Fallback behaviour test ────────────────────────────────────────────────

describe("transcribe() — provider fallback", () => {
  it("falls back to gemini when eleven fails (no ELEVEN_API_KEY configured)", async () => {
    // In the local environment STT_PROVIDER defaults to "gemini" and
    // GEMINI_API_KEY is absent → mock mode. So to test the fallback we
    // temporarily switch the provider to "eleven" which will throw immediately
    // (no API key), and verify the function falls back to gemini (mock mode)
    // and returns a result rather than throwing.
    const envModule = await import("../../env.js");
    const originalProvider = envModule.env.STT_PROVIDER;
    (envModule.env as { STT_PROVIDER: "eleven" | "gemini" }).STT_PROVIDER = "eleven";

    const { transcribe } = await import("./transcribe.js");

    const result = await transcribe(makeAudioBuffer(), "audio/webm", "fallback-test-device");
    // Should have fallen back to gemini (mock)
    expect(result.provider).toBe("gemini");
    expect(result.text.length).toBeGreaterThan(0);

    // Restore
    (envModule.env as { STT_PROVIDER: "eleven" | "gemini" }).STT_PROVIDER = originalProvider;
  });
});

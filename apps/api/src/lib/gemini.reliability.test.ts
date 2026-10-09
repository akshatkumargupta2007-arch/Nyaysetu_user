import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { env } from "../env.js";
import { generateJson, generateJsonSafe, geminiHealth, resetGeminiState, timeoutFor, GeminiError } from "./gemini.js";

const ok = (obj: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }], usageMetadata: { totalTokenCount: 7 } }), { status: 200 });
const status = (n: number, body = "x") => new Response(body, { status: n });
const base = { purpose: "understand", systemPrompt: "s", userContent: "u", responseSchema: { type: "object" } };
const saved = { key: env.GEMINI_API_KEY, fb: env.GEMINI_MODEL_FALLBACKS };

describe("Gemini reliability layer", () => {
  beforeEach(() => { resetGeminiState(); Object.assign(env, { GEMINI_API_KEY: "test", GEMINI_MODEL_FALLBACKS: "m-b,m-c" }); });
  afterEach(() => { vi.restoreAllMocks(); Object.assign(env, { GEMINI_API_KEY: saved.key, GEMINI_MODEL_FALLBACKS: saved.fb }); });
  const calls = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((c: unknown[]) => String(c[0]).match(/models\/([^:]+):/)?.[1]);

  it("returns the answer on the first model when it works", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => ok({ a: 1 }));
    const r = await generateJsonSafe<{ a: number }>({ ...base, model: "m-a" });
    expect(r).toMatchObject({ ok: true, value: { a: 1 }, model: "m-a" });
    expect(calls(spy)).toEqual(["m-a"]);
  });

  it("retries once on a transient failure, then succeeds on the same model", async () => {
    let n = 0;
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => (++n === 1 ? status(503) : ok({ a: 2 })));
    const r = await generateJsonSafe({ ...base, model: "m-a" });
    expect(r.ok && r.model).toBe("m-a");
    expect(calls(spy)).toEqual(["m-a", "m-a"]);
  });

  it("falls back to the next model after a retry fails", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (u) => (String(u).includes("models/m-a:") ? status(503) : ok({ a: 3 })));
    const r = await generateJsonSafe({ ...base, model: "m-a" });
    expect(r).toMatchObject({ ok: true, model: "m-b" });
    expect(calls(spy)).toEqual(["m-a", "m-a", "m-b"]);
  });

  it("a retired model (404) skips straight to the fallback, with no retry", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (u) => (String(u).includes("models/m-a:") ? status(404, "model not found") : ok({ a: 4 })));
    const r = await generateJsonSafe({ ...base, model: "m-a" });
    expect(r).toMatchObject({ ok: true, model: "m-b" });
    expect(calls(spy)).toEqual(["m-a", "m-b"]);
    expect(geminiHealth().find((h) => h.model === "m-a")?.circuit).toBe("open");
  });

  it("opens the circuit after repeated failures and stops calling that model", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (u) => (String(u).includes("models/m-a:") ? status(500) : ok({ a: 5 })));
    await generateJsonSafe({ ...base, model: "m-a" }); // 2 failures
    await generateJsonSafe({ ...base, model: "m-a" }); // third failure opens the circuit
    spy.mockClear();
    await generateJsonSafe({ ...base, model: "m-a" });
    expect(calls(spy)).toEqual(["m-b"]); // m-a skipped while open
  });

  it("returns a degraded result (never throws) when every model fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => status(500));
    const r = await generateJsonSafe({ ...base, model: "m-a" });
    expect(r).toMatchObject({ ok: false, degraded: true, kind: "UPSTREAM" });
    if (!r.ok) expect(r.userMessage).toMatch(/AI helper/);
  });

  it("a bad API key fails fast with AUTH and does not try fallbacks", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => status(403, "API key not valid"));
    const r = await generateJsonSafe({ ...base, model: "m-a" });
    expect(r).toMatchObject({ ok: false, kind: "AUTH" });
    expect(calls(spy)).toEqual(["m-a"]);
  });

  it("a safety block is reported as SAFETY and not retried", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), { status: 200 }));
    const r = await generateJsonSafe({ ...base, model: "m-a" });
    expect(r).toMatchObject({ ok: false, kind: "SAFETY" });
    expect(calls(spy)).toHaveLength(1);
  });

  it("a meaning check (validate) that throws counts as a schema problem, then falls back", async () => {
    let n = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => ok(++n < 3 ? { bad: true } : { good: true }));
    const r = await generateJsonSafe<{ good?: boolean }>({ ...base, model: "m-a", validate: (v) => { if (!v.good) throw new Error("not good"); } });
    expect(r).toMatchObject({ ok: true, value: { good: true }, model: "m-b" });
  });

  it("timeouts abort the call and are reported as TIMEOUT", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_u, init) => new Promise((_res, rej) => { (init as RequestInit).signal!.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))); }));
    const r = await generateJsonSafe({ ...base, model: "m-a", timeoutMs: 30 });
    expect(r).toMatchObject({ ok: false, kind: "TIMEOUT" });
  }, 15000);

  it("generateJson (the old API) throws a typed error instead of returning a degraded result", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => status(500));
    await expect(generateJson({ ...base, model: "m-a" })).rejects.toBeInstanceOf(GeminiError);
  });

  it("each purpose has its own timeout, overridable by setting", () => {
    expect(timeoutFor("understand")).toBe(8000);
    expect(timeoutFor("vision")).toBe(15000);
    expect(timeoutFor("video")).toBe(25000);
    expect(timeoutFor("something-new")).toBe(env.GEMINI_TIMEOUT_MS);
    const prev = env.GEMINI_TIMEOUTS; env.GEMINI_TIMEOUTS = "vision=20000";
    expect(timeoutFor("vision")).toBe(20000); env.GEMINI_TIMEOUTS = prev;
  });
});

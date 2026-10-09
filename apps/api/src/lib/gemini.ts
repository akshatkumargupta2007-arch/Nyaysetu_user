// Build map #C1 — the single wrapper every Gemini call goes through.
// Logs every call to ai_calls (latency, units, ok) and automatically runs in
// MOCK MODE whenever GEMINI_API_KEY is empty, so the rest of the engine is
// fully testable with no key configured (Bible §12 applies the same rule to
// voice: dev never needs a live key to exercise the code paths).
import { env } from "../env.js";
import { db } from "../db/client.js";
import { aiCalls } from "../db/schema.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const isMockMode = !env.GEMINI_API_KEY;
/** Evaluated per call (isMockMode above is fixed at import time); lets tests flip the key. */
const mockNow = () => !env.GEMINI_API_KEY;

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

// ── the reliability layer (Gemini build map GC0) ─────────────────
// Every call: a timeout chosen per purpose, one retry with jitter, a fallback chain of models, a circuit breaker per
// model, an error taxonomy, and (for new code) a "degraded" result instead of an exception. Every attempt writes an
// ai_calls row. Nothing here ever decides anything about a complaint.

export type GeminiErrorKind = "TIMEOUT" | "RATE_LIMIT" | "MODEL_GONE" | "SCHEMA" | "SAFETY" | "NETWORK" | "AUTH" | "UPSTREAM";

export class GeminiError extends Error {
  constructor(public kind: GeminiErrorKind, message: string, public model?: string) {
    super(message);
    this.name = "GeminiError";
  }
}
export class GeminiTimeoutError extends GeminiError {
  constructor(purpose: string, model?: string) {
    super("TIMEOUT", `Gemini call timed out: ${purpose}`, model);
    this.name = "GeminiTimeoutError";
  }
}

/** Plain-language messages that are safe to show a citizen or an official. */
export const GEMINI_USER_MESSAGES: Record<GeminiErrorKind, string> = {
  TIMEOUT: "The AI helper is slow right now.",
  RATE_LIMIT: "The AI helper is busy right now.",
  MODEL_GONE: "The AI helper is being updated.",
  SCHEMA: "The AI helper gave an answer we could not use.",
  SAFETY: "The AI helper could not look at this.",
  NETWORK: "We could not reach the AI helper.",
  AUTH: "The AI helper is not set up.",
  UPSTREAM: "The AI helper had a problem.",
};

const DEFAULT_TIMEOUTS: Record<string, number> = { understand: 8000, contract: 10000, vision: 15000, video: 25000, analyst: 15000, embed: 5000 };
/** Timeout for a purpose: GEMINI_TIMEOUTS="vision=20000,..." overrides, then the defaults above, then GEMINI_TIMEOUT_MS. */
export function timeoutFor(purpose: string): number {
  const key = purpose.split(/[:._/-]/)[0] ?? purpose;
  const overrides = Object.fromEntries(env.GEMINI_TIMEOUTS.split(",").map((p) => p.split("=")).filter((p) => p.length === 2).map(([k, v]) => [k!.trim(), Number(v)]));
  return overrides[purpose] ?? overrides[key] ?? DEFAULT_TIMEOUTS[purpose] ?? DEFAULT_TIMEOUTS[key] ?? env.GEMINI_TIMEOUT_MS;
}

const BREAKER_FAILS = 3;
const BREAKER_WINDOW_MS = 60_000;
const BREAKER_OPEN_MS = 30_000;
const MODEL_GONE_OPEN_MS = 5 * 60_000;
type ModelState = { fails: number[]; openUntil: number; lastError?: string; lastOkAt?: number; served: number };
const breakers = new Map<string, ModelState>();
const state = (m: string): ModelState => { let s = breakers.get(m); if (!s) { s = { fails: [], openUntil: 0, served: 0 }; breakers.set(m, s); } return s; };

function recordFailure(model: string, kind: GeminiErrorKind, message: string) {
  const s = state(model);
  const now = Date.now();
  s.lastError = `${kind}: ${message}`.slice(0, 200);
  if (kind === "MODEL_GONE") { s.openUntil = now + MODEL_GONE_OPEN_MS; return; }
  if (kind === "SCHEMA" || kind === "SAFETY" || kind === "AUTH") return; // not the model being unhealthy
  s.fails = s.fails.filter((t) => now - t < BREAKER_WINDOW_MS).concat(now);
  if (s.fails.length >= BREAKER_FAILS) { s.openUntil = now + BREAKER_OPEN_MS; s.fails = []; }
}
function recordOk(model: string) { const s = state(model); s.fails = []; s.openUntil = 0; s.lastOkAt = Date.now(); s.served += 1; }
const isOpen = (model: string) => state(model).openUntil > Date.now();

/** For the health page: the circuit state of every model we have used. */
export function geminiHealth() {
  const now = Date.now();
  return [...breakers.entries()].map(([model, s]) => ({
    model, circuit: s.openUntil > now ? "open" : "closed", opensUntil: s.openUntil > now ? new Date(s.openUntil).toISOString() : null,
    recentFailures: s.fails.length, lastError: s.lastError ?? null, lastOkAt: s.lastOkAt ? new Date(s.lastOkAt).toISOString() : null, served: s.served,
  }));
}
export function resetGeminiState() { breakers.clear(); }

const fallbackChain = (primary: string): string[] => {
  const extra = env.GEMINI_MODEL_FALLBACKS.split(",").map((m) => m.trim()).filter(Boolean);
  return [primary, ...extra].filter((m, i, a) => m && a.indexOf(m) === i);
};
const jitter = () => 150 + Math.random() * 250;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Part = Record<string, unknown>;
interface RawRequest { model: string; purpose: string; systemPrompt: string; parts: Part[]; schema?: Record<string, unknown>; timeoutMs: number; temperature?: number; thinkingBudget?: number }
/** Models that refused a thinking budget: we stop sending it to them (they think as they like). */
const noThinking = new Set<string>();

/** One HTTP attempt against one model. Throws GeminiError with a kind. */
async function attempt(req: RawRequest): Promise<{ text: string; tokens: number }> {
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs);
  const log = (ok: boolean, units = 0) => logCall({ model: req.model, purpose: req.purpose, latencyMs: performance.now() - start, ok, units });
  try {
    let res: Response;
    try {
      res = await fetch(`${GEMINI_BASE}/models/${req.model}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.systemPrompt }] },
          contents: [{ role: "user", parts: req.parts }],
          generationConfig: { ...(req.schema ? { responseMimeType: "application/json", responseJsonSchema: req.schema } : {}), temperature: req.temperature ?? 0, ...(req.thinkingBudget !== undefined && !noThinking.has(req.model) ? { thinkingConfig: { thinkingBudget: req.thinkingBudget } } : {}) },
        }),
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new GeminiTimeoutError(req.purpose, req.model);
      throw new GeminiError("NETWORK", (e as Error).message, req.model);
    }
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      if (res.status === 400 && req.thinkingBudget !== undefined && !noThinking.has(req.model)) { noThinking.add(req.model); /* the thinking budget may have been the invalid argument: stop sending it to this model and retry */ throw new GeminiError("UPSTREAM", `thinking budget not supported: ${body}`, req.model); }
      const kind: GeminiErrorKind = res.status === 429 ? "RATE_LIMIT" : res.status === 404 || /not found|no longer available|deprecated/i.test(body) ? "MODEL_GONE"
        : res.status === 401 || res.status === 403 || (res.status === 400 && /API key/i.test(body)) ? "AUTH" : res.status >= 500 ? "UPSTREAM" : "SCHEMA";
      throw new GeminiError(kind, `Gemini ${res.status}: ${body}`, req.model);
    }
    const data = (await res.json()) as {
      usageMetadata?: { totalTokenCount?: number };
      promptFeedback?: { blockReason?: string };
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
    };
    if (data.promptFeedback?.blockReason) throw new GeminiError("SAFETY", `blocked: ${data.promptFeedback.blockReason}`, req.model);
    const cand = data.candidates?.[0];
    if (cand?.finishReason === "SAFETY" || cand?.finishReason === "PROHIBITED_CONTENT") throw new GeminiError("SAFETY", `finish: ${cand.finishReason}`, req.model);
    const text = cand?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) throw new GeminiError("SCHEMA", "Gemini returned no text", req.model);
    await log(true, data.usageMetadata?.totalTokenCount ?? 0);
    return { text, tokens: data.usageMetadata?.totalTokenCount ?? 0 };
  } catch (e) {
    await log(false);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Runs the chain: each model gets one retry for transient failures; schema trouble retries once then moves on. */
async function runChain<T>(primary: string, build: (model: string) => RawRequest, parse: (text: string) => T): Promise<{ value: T; model: string; tokens: number; attempts: number }> {
  let last: GeminiError | null = null;
  let attempts = 0;
  for (const model of fallbackChain(primary)) {
    if (isOpen(model)) { last = last ?? new GeminiError("UPSTREAM", `circuit open for ${model}`, model); continue; }
    for (let i = 0; i < 2; i++) {
      attempts++;
      try {
        const { text, tokens } = await attempt(build(model));
        let value: T;
        try { value = parse(text); } catch (pe) { throw new GeminiError("SCHEMA", `unparseable answer: ${(pe as Error).message}`, model); }
        recordOk(model);
        return { value, model, tokens, attempts };
      } catch (e) {
        const err = e instanceof GeminiError ? e : new GeminiError("UPSTREAM", (e as Error).message, model);
        last = err;
        recordFailure(model, err.kind, err.message);
        if (err.kind === "AUTH" || err.kind === "SAFETY") throw err;      // no fallback can fix these
        if (err.kind === "MODEL_GONE") break;                               // straight to the next model
        if (isOpen(model)) break;
        if (i === 0) await sleep(jitter()); else break;                     // one retry, then the next model
      }
    }
  }
  throw last ?? new GeminiError("UPSTREAM", "no model available", primary);
}

// ── structured calls ──────────────────────────────────────────────

export interface GenerateJsonOptions<T> {
  model: string;
  purpose: string;
  systemPrompt: string;
  userContent: string;
  /** JSON-serializable image part, if any: { mimeType, dataBase64 } */
  image?: { mimeType: string; dataBase64: string };
  /** More images (before/after, several proof photos). */
  images?: Array<{ mimeType: string; dataBase64: string }>;
  /** A file already uploaded to the Gemini Files API (short video clips). */
  fileUri?: { mimeType: string; fileUri: string };
  /** A JSON Schema object (OpenAPI-style) the response must match. */
  responseSchema: Record<string, unknown>;
  timeoutMs?: number;
  temperature?: number;
  /** How many "thinking" tokens the model may spend (0 = none). Lower = faster. Ignored by models that do not accept it. */
  thinkingBudget?: number;
  /** Validates the parsed answer's meaning (the schema only checks its shape). Throw to reject. */
  validate?: (value: T) => void;
  /**
   * Used only in mock mode (no GEMINI_API_KEY). The caller owns its own mock derivation so the rest of the pipeline is
   * exercisable end-to-end without a key.
   */
  mockResult?: () => T | Promise<T>;
}

function partsOf(opts: GenerateJsonOptions<unknown>): Part[] {
  const parts: Part[] = [{ text: opts.userContent }];
  for (const im of [...(opts.image ? [opts.image] : []), ...(opts.images ?? [])]) parts.push({ inlineData: { mimeType: im.mimeType, data: im.dataBase64 } });
  if (opts.fileUri) parts.push({ fileData: { mimeType: opts.fileUri.mimeType, fileUri: opts.fileUri.fileUri } });
  return parts;
}

export type GeminiResult<T> = { ok: true; value: T; model: string; tokens: number; attempts: number } | { ok: false; degraded: true; kind: GeminiErrorKind; message: string; userMessage: string };

/** Never throws for AI trouble: callers must handle the degraded result (the case then goes to a human). */
export async function generateJsonSafe<T>(opts: GenerateJsonOptions<T>): Promise<GeminiResult<T>> {
  const start = performance.now();
  if (mockNow()) {
    if (!opts.mockResult) throw new Error(`generateJson("${opts.purpose}") called in mock mode (no GEMINI_API_KEY) with no mockResult provided.`);
    const mock = await opts.mockResult();
    await logCall({ model: "mock", purpose: opts.purpose, latencyMs: performance.now() - start, ok: true });
    return { ok: true, value: mock, model: "mock", tokens: 0, attempts: 0 };
  }
  const timeoutMs = opts.timeoutMs ?? timeoutFor(opts.purpose);
  const parts = partsOf(opts as GenerateJsonOptions<unknown>);
  try {
    const r = await runChain<T>(
      opts.model,
      (model) => ({ model, purpose: opts.purpose, systemPrompt: opts.systemPrompt, parts, schema: opts.responseSchema, timeoutMs, temperature: opts.temperature, thinkingBudget: opts.thinkingBudget }),
      (text) => { const v = JSON.parse(text) as T; if (opts.validate) opts.validate(v); return v; },
    );
    return { ok: true, value: r.value, model: r.model, tokens: r.tokens, attempts: r.attempts };
  } catch (e) {
    const err = e instanceof GeminiError ? e : new GeminiError("UPSTREAM", (e as Error).message);
    return { ok: false, degraded: true, kind: err.kind, message: err.message, userMessage: GEMINI_USER_MESSAGES[err.kind] };
  }
}

/** The original API: returns the value or throws a GeminiError (callers that already handle exceptions keep working). */
export async function generateJson<T>(opts: GenerateJsonOptions<T>): Promise<T> {
  const r = await generateJsonSafe(opts);
  if (r.ok) return r.value;
  throw r.kind === "TIMEOUT" ? new GeminiTimeoutError(opts.purpose) : new GeminiError(r.kind, r.message);
}

/** Start-up check: warns when a configured model is not in the key's model list. Never throws. */
export async function checkGeminiModels(log: (m: string) => void): Promise<{ checked: boolean; missing: string[] }> {
  if (mockNow()) return { checked: false, missing: [] };
  try {
    const res = await fetch(`${GEMINI_BASE}/models?pageSize=200&key=${env.GEMINI_API_KEY}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) { log(`gemini model check: HTTP ${res.status}`); return { checked: false, missing: [] }; }
    const names = new Set(((await res.json()) as { models?: Array<{ name: string }> }).models?.map((m) => m.name.replace(/^models\//, "")) ?? []);
    const wanted = [env.GEMINI_MODEL_FAST, env.GEMINI_MODEL_VISION, env.GEMINI_EMBED_MODEL, ...env.GEMINI_MODEL_FALLBACKS.split(",")].map((m) => m.trim()).filter(Boolean);
    const missing = wanted.filter((m) => !names.has(m));
    if (missing.length) log(`gemini model check: not available on this key: ${missing.join(", ")}`);
    return { checked: true, missing };
  } catch (e) {
    log(`gemini model check failed: ${(e as Error).message}`);
    return { checked: false, missing: [] };
  }
}

// ── embeddings ─────────────────────────────────────────────────

export async function embedText(text: string): Promise<number[]> {
  const start = performance.now();
  if (mockNow()) {
    const vec = deterministicMockEmbedding(text);
    await logCall({ model: "mock-embed", purpose: "embed", latencyMs: performance.now() - start, ok: true });
    return vec;
  }
  let lastErr: GeminiError | null = null;
  for (let i = 0; i < 2; i++) {
    const t0 = performance.now();
    try {
      const res = await fetch(`${GEMINI_BASE}/models/${env.GEMINI_EMBED_MODEL}:embedContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(timeoutFor("embed")),
        body: JSON.stringify({ model: `models/${env.GEMINI_EMBED_MODEL}`, content: { parts: [{ text }] }, outputDimensionality: env.EMBED_DIM }),
      });
      if (!res.ok) throw new GeminiError(res.status === 429 ? "RATE_LIMIT" : res.status >= 500 ? "UPSTREAM" : res.status === 404 ? "MODEL_GONE" : "SCHEMA", `Gemini embed ${res.status}: ${(await res.text()).slice(0, 200)}`, env.GEMINI_EMBED_MODEL);
      const values = ((await res.json()) as { embedding?: { values?: number[] } }).embedding?.values;
      if (!values) throw new GeminiError("SCHEMA", "Gemini embed returned no values", env.GEMINI_EMBED_MODEL);
      await logCall({ model: env.GEMINI_EMBED_MODEL, purpose: "embed", latencyMs: performance.now() - t0, ok: true });
      return values;
    } catch (e) {
      const err = e instanceof GeminiError ? e : (e as Error).name === "TimeoutError" || (e as Error).name === "AbortError" ? new GeminiTimeoutError("embed", env.GEMINI_EMBED_MODEL) : new GeminiError("NETWORK", (e as Error).message, env.GEMINI_EMBED_MODEL);
      await logCall({ model: env.GEMINI_EMBED_MODEL, purpose: "embed", latencyMs: performance.now() - t0, ok: false });
      lastErr = err;
      if (err.kind === "AUTH" || err.kind === "MODEL_GONE" || err.kind === "SCHEMA") break;
      if (i === 0) await sleep(jitter());
    }
  }
  throw lastErr ?? new GeminiError("UPSTREAM", "embedding failed");
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

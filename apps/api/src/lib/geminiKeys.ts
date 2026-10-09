// Gemini key rotation. Put several keys in GEMINI_API_KEYS (comma separated; GEMINI_API_KEY is still read and
// goes first). When a key runs out (429 quota/rate limit) or is refused (401/403), the same request is retried
// with the next key, and the bad key is skipped for a while. The key travels in a header, never in the URL, so
// it cannot end up in a log line.
import { env } from "../env.js";

const RATE_COOLDOWN_MS = 65_000; // per-minute limit: try again after the minute rolls over
const DENIED_COOLDOWN_MS = 60 * 60_000; // invalid / disabled / daily quota: park it for an hour

export const parseKeys = (single: string, many: string): string[] =>
  [...new Set([single, ...many.split(",")].map((k) => k.trim()).filter(Boolean))];

export const geminiKeys: string[] = parseKeys(env.GEMINI_API_KEY, env.GEMINI_API_KEYS);
export const hasGeminiKey = geminiKeys.length > 0;

const parkedUntil = new Map<string, number>();
let current = 0;

function order(keys: string[], now: number): string[] {
  const rotated = [...keys.slice(current % keys.length), ...keys.slice(0, current % keys.length)];
  const live = rotated.filter((k) => (parkedUntil.get(k) ?? 0) <= now);
  // If every key is parked, still try them, soonest-to-recover first, rather than failing without a call.
  return live.length ? live : [...rotated].sort((a, b) => (parkedUntil.get(a) ?? 0) - (parkedUntil.get(b) ?? 0));
}

const isQuotaDaily = (body: string) => /per\s*day|daily|PerDay/i.test(body);

export async function geminiFetch(url: string, init: RequestInit = {}, keys: string[] = geminiKeys): Promise<Response> {
  if (!keys.length) throw new Error("No Gemini API key configured");
  const now = Date.now();
  let last: Response | null = null;
  for (const key of order(keys, now)) {
    const res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), "x-goog-api-key": key } });
    if (res.ok || ![401, 403, 429].includes(res.status) && !(res.status === 400)) {
      current = keys.indexOf(key); // stay on the key that works
      return res;
    }
    const text = await res.clone().text();
    if (res.status === 400 && !/API key not valid|API_KEY_INVALID/i.test(text)) return res; // a real bad request, not a key problem
    const long = res.status !== 429 || isQuotaDaily(text);
    parkedUntil.set(key, Date.now() + (long ? DENIED_COOLDOWN_MS : RATE_COOLDOWN_MS));
    console.warn(`[gemini] key #${keys.indexOf(key) + 1}/${keys.length} ${res.status}; switching to the next key`);
    last = res;
  }
  return last as Response; // every key failed: hand back the last answer so the caller reports it as before
}

export const _resetKeyStateForTests = () => { parkedUntil.clear(); current = 0; };

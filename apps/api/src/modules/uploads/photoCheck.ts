// Is this a real photograph of a real place? A best-effort gate on what citizens attach. It does three things:
//
//   1. Reuse: the very same picture (same bytes) already sent by ANOTHER person is refused. One person adding the same
//      picture to their own report again is fine.
//   2. The file's own label: if the app saw that the ORIGINAL file says it was made by an AI tool (metadata written by
//      image generators), the picture is refused. (The app reads this before it shrinks the picture, because shrinking
//      wipes the metadata.)
//   3. Gemini looks at the picture like an image-forensics analyst and says whether it is a genuine camera photo, or an
//      AI-generated image, an illustration or 3D render, or a screenshot or stock picture. A picture is refused ONLY
//      when the model says so confidently TWICE in a row; one doubtful answer makes it "unclear", which is accepted
//      but marked, so an official sees it.
//
// Honest limits, measured: Gemini catches obvious drawings, renders and screenshots, but it MISSES good AI pictures.
// Tried on a street picture made by Gemini itself, it called it a real photo 8 times out of 9, with confident
// reasons that were wrong. So the file's own label (step 2) is the dependable catch, and it can be stripped by a
// screenshot or a re-save. This whole check is a speed bump plus a note for officials, never proof that a photo is
// genuine. When Gemini cannot be reached (or there is no key) the photo is accepted and marked "unchecked", because
// a citizen with a real problem must never be blocked by our outage.
import { createHash } from "node:crypto";
import { env } from "../../env.js";
import { pool } from "../../db/client.js";
import { generateJsonSafe } from "../../lib/gemini.js";

export type PhotoVerdict = "real_photo" | "ai_generated" | "illustration_or_render" | "screenshot_or_stock" | "unclear" | "unchecked";
export interface PhotoAssessment { allowed: boolean; verdict: PhotoVerdict; confidence: number | null; reason: string; sha256: string; refusal?: "AI" | "REUSED" }
type Look = Pick<PhotoAssessment, "verdict" | "confidence" | "reason">;

/** Refuse only when the model is at least this sure it is NOT a real photo. */
export const REFUSE_CONFIDENCE = 0.85;
const REFUSED: ReadonlySet<PhotoVerdict> = new Set(["ai_generated", "illustration_or_render", "screenshot_or_stock"]);
/** A little thinking helps with drawings and renders; more did not help with good AI pictures (see above) and made the wait longer. */
const THINKING_TOKENS = 512;
const CHECK_TIMEOUT_MS = 25_000;

const SYSTEM = `You are an image forensics analyst. A citizen of an Indian city attached this picture to a complaint about a local problem (road, street light, garbage, water, drain, tree, animal, building, electricity). Decide whether it is a GENUINE CAMERA PHOTOGRAPH of a real scene, or something else:
- "real_photo": taken with a phone or camera of a real place. Ordinary noise, blur, bad light and clutter are normal.
- "ai_generated": made by an image-generation model.
- "illustration_or_render": a drawing, cartoon, painting, vector art or 3D render.
- "screenshot_or_stock": a screenshot of a phone or website, or a clean professional stock picture.
- "unclear": you cannot tell.
Work through these checks and write down what you actually see in "evidence":
(1) Text, signs, number plates and shop boards: legible and consistent in the right script, or garbled, malformed or too perfect.
(2) Structure of people, faces, hands, vehicles, animals, poles and wires: correct shapes, connections and counts, or merged, deformed or impossible.
(3) Light, shadows and reflections: one consistent light source, or contradictions.
(4) Surface texture: real wear, dirt and sensor noise, or smooth, waxy, over-detailed or painterly.
(5) Composition: a casual cluttered phone snap, or staged, symmetrical, cinematic and "perfect".
(6) Depth of field and perspective: natural lens behaviour.
(7) The problem shown: a real physical object with believable damage, or an idealised picture of one.
Be fair: most pictures people send are real, and a blurry or dark picture is not a fake. Say ai_generated, illustration_or_render or screenshot_or_stock only when you can point to clear signs, and make your confidence (0 to 1) match how sure you are. Keep "evidence" to three short sentences in English.`;

const SCHEMA = {
  type: "object",
  properties: {
    evidence: { type: "string" },
    verdict: { type: "string", enum: ["real_photo", "ai_generated", "illustration_or_render", "screenshot_or_stock", "unclear"] },
    confidence: { type: "number" },
  },
  required: ["evidence", "verdict", "confidence"],
};

// The same picture is checked once, not on every screen: the app asks when the photo is chosen and again when it is saved.
const cache = new Map<string, { at: number; v: Look }>();
const CACHE_MS = 2 * 3_600_000;
const CACHE_MAX = 500;

export const sha256Of = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

/** Pure decision, kept apart so it can be tested without a database or a model. */
export const isRefusal = (v: Pick<PhotoAssessment, "verdict" | "confidence">): boolean => REFUSED.has(v.verdict) && (v.confidence ?? 0) >= REFUSE_CONFIDENCE;

/** Two looks become one answer: refuse only when BOTH say "not a real photo" confidently. */
export function combine(first: Look, second: Look | null): Look {
  if (!isRefusal(first)) return first;
  if (second && isRefusal(second)) return first.confidence! >= second.confidence! ? first : second;
  // the second look doubted the first: do not accuse anyone, but do mark it
  return { verdict: "unclear", confidence: Math.min(first.confidence ?? 0, second?.confidence ?? 0), reason: `Possibly not a real photo (second look disagreed). ${first.reason}`.slice(0, 300) };
}

async function look(bytes: Buffer, mime: string, temperature: number): Promise<Look | null> {
  const r = await generateJsonSafe<{ evidence: string; verdict: Exclude<PhotoVerdict, "unchecked">; confidence: number }>({
    model: env.GEMINI_MODEL_VISION,
    purpose: "photo_check",
    systemPrompt: SYSTEM,
    userContent: "Analyse the picture and answer in the JSON format.",
    image: { mimeType: mime, dataBase64: bytes.toString("base64") },
    responseSchema: SCHEMA,
    temperature,
    thinkingBudget: THINKING_TOKENS,
    timeoutMs: CHECK_TIMEOUT_MS,
    validate: (v) => { if (typeof v.confidence !== "number" || v.confidence < 0 || v.confidence > 1) throw new Error("confidence out of range"); },
    mockResult: () => ({ evidence: "no AI key", verdict: "unclear" as const, confidence: 0 }),
  });
  if (!r.ok || r.model === "mock") return null;
  return { verdict: r.value.verdict, confidence: Math.round(r.value.confidence * 100) / 100, reason: String(r.value.evidence).slice(0, 300) };
}

async function askGemini(bytes: Buffer, mime: string, sha: string): Promise<Look> {
  const hit = cache.get(sha);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.v;
  const first = await look(bytes, mime, 0);
  if (!first) return { verdict: "unchecked", confidence: null, reason: "The AI check was not available." };
  const second = isRefusal(first) ? await look(bytes, mime, 0.4) : null; // a refusal needs two confident looks
  const v = combine(first, second);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(sha, { at: Date.now(), v });
  return v;
}

export interface AssessOptions { /** The app saw AI-tool metadata in the original file. */ aiMarker?: boolean }

export async function assessPhoto(bytes: Buffer, mime: string, citizenId: string, opts: AssessOptions = {}): Promise<PhotoAssessment> {
  const sha = sha256Of(bytes);
  const other = await pool.query(`SELECT 1 FROM media_blobs WHERE sha256 = $1 AND citizen_id IS DISTINCT FROM $2 LIMIT 1`, [sha, citizenId]);
  if (other.rowCount) return { allowed: false, verdict: "unchecked", confidence: null, reason: "This exact picture was already sent by someone else.", sha256: sha, refusal: "REUSED" };
  if (opts.aiMarker) return { allowed: false, verdict: "ai_generated", confidence: 1, reason: "The file itself says it was made by an AI tool.", sha256: sha, refusal: "AI" };
  const v = await askGemini(bytes, mime, sha);
  const refused = isRefusal(v);
  return { allowed: !refused, ...v, sha256: sha, ...(refused ? { refusal: "AI" as const } : {}) };
}

// The whole Closure Court run for one proof submission: contract -> gates -> (maybe) two passes -> verdict -> ledger.
import { pool } from "../../db/client.js";
import { appendEvent } from "../lifecycle/transition.js";
import type { ActorType } from "../lifecycle/types.js";
import { ensureContract, contractIntact, type CompileDeps } from "./compile.js";
import { assess, classifyInstructionInImage, type AssessDeps, type Image } from "./assess.js";
import { runGates, readExif, type GateResult, type ProofFile, type Reference } from "./gates.js";
import { hashSet, sha256Hex } from "./hashes.js";
import { computeVerdict, VERDICT_EVENT, type Merged, type Verdict } from "./verdict.js";

export interface IncomingFile { name: string; mime: string; base64: string }
export interface SubmitInput { ticketId: string; actor: { type: ActorType; id: string }; files: IncomingFile[]; declaredAt?: string | null; note?: string; kind?: "proof" | "before" | "citizen_counter" }
export interface SubmitResult {
  submissionId: string; verdict: Verdict; rule: string; gates: GateResult[]; merged: Record<string, Merged>; nextEvidence: string[];
  aiCalled: boolean; models: { examiner: string | null; cross: string | null }; failures: string[]; latencyMs: number; contractVersion: number; contractIntact: boolean;
  passA: unknown; passB: unknown; mediaIds: string[];
}
export class CourtInputError extends Error { constructor(public code: string, message: string) { super(message); } }

export const LIMITS = { files: 4, photoBytes: 6_000_000, videoBytes: 14_000_000, totalBytes: 20_000_000 };
const MIMES = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"]);

export function decodeFiles(files: IncomingFile[]): ProofFile[] {
  if (!files.length) throw new CourtInputError("NO_FILES", "Send at least one photo or clip");
  if (files.length > LIMITS.files) throw new CourtInputError("TOO_MANY", `At most ${LIMITS.files} files per submission`);
  let total = 0;
  return files.map((f) => {
    if (!MIMES.has(f.mime)) throw new CourtInputError("BAD_TYPE", `${f.name}: unsupported file type ${f.mime}`);
    const bytes = Buffer.from(f.base64, "base64");
    const isVideo = f.mime.startsWith("video/");
    if (bytes.length === 0) throw new CourtInputError("EMPTY", `${f.name} is empty`);
    if (bytes.length > (isVideo ? LIMITS.videoBytes : LIMITS.photoBytes)) throw new CourtInputError("TOO_BIG", `${f.name} is too large (limit ${isVideo ? "14 MB for a clip" : "6 MB for a photo"})`);
    total += bytes.length;
    if (total > LIMITS.totalBytes) throw new CourtInputError("TOO_BIG", "The files together are too large");
    return { name: f.name.slice(0, 80), mime: f.mime, bytes, isVideo };
  });
}

export async function storeMedia(ticketId: string, kind: "before" | "proof" | "citizen_counter", f: ProofFile, submissionId: string | null): Promise<string> {
  let hashes = null;
  if (!f.isVideo) { try { hashes = await hashSet(f.bytes); } catch { hashes = null; } }
  const exif = await readExif(f);
  const r = await pool.query<{ id: string }>(
    `INSERT INTO court_media (ticket_id, submission_id, kind, name, mime, bytes, sha256, hashes, exif) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [ticketId, submissionId, kind, f.name, f.mime, f.bytes, sha256Hex(f.bytes), hashes ? JSON.stringify(hashes) : null, JSON.stringify({ takenAt: exif.takenAt?.toISOString() ?? null, lat: exif.lat, lng: exif.lng })]);
  return r.rows[0]!.id;
}

export async function submitProof(input: SubmitInput, deps: CompileDeps & AssessDeps = {}): Promise<SubmitResult> {
  const t0 = performance.now();
  const tk = await pool.query<{ lat: number; lng: number }>(`SELECT ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng FROM tickets WHERE id = $1`, [input.ticketId]);
  if (!tk.rows[0]) throw new CourtInputError("NOT_FOUND", "Ticket not found");
  const files = decodeFiles(input.files);
  const stored = await ensureContract(input.ticketId, deps);
  const contract = stored.contract;

  const refRows = await pool.query<{ kind: string; sha256: string; hashes: Reference["hashes"] }>(`SELECT kind, sha256, hashes FROM court_media WHERE ticket_id = $1`, [input.ticketId]);
  const references: Reference[] = refRows.rows.map((r, i) => ({ id: String(i), kind: r.kind === "before" ? "original" : "earlier proof", sha256: r.sha256, hashes: r.hashes }));
  // the citizen's own original photo's perceptual hash, if the app stored one
  const own = await pool.query<{ dhash: string }>(`SELECT dhash::text AS dhash FROM media WHERE ticket_id = $1 AND dhash IS NOT NULL`, [input.ticketId]);
  for (const o of own.rows) references.push({ id: `m${o.dhash}`, kind: "original", sha256: "", hashes: { d: o.dhash, m: o.dhash, c: [] } });

  const declared = input.declaredAt ? new Date(input.declaredAt) : null;
  const gate = await runGates({
    ticket: tk.rows[0], contract, files, references, declaredAt: declared && !isNaN(+declared) ? declared : null,
    classifyInstruction: (f) => classifyInstructionInImage({ name: f.name, mime: f.mime, base64: f.bytes.toString("base64") }, deps),
  });

  const submissionId = (await pool.query<{ id: string }>(`SELECT gen_random_uuid() AS id`)).rows[0]!.id;
  const mediaIds: string[] = [];
  for (const f of files) mediaIds.push(await storeMedia(input.ticketId, input.kind === "citizen_counter" ? "citizen_counter" : "proof", f, submissionId));
  await appendEvent(input.ticketId, "PROOF_SUBMITTED", { type: input.actor.type, id: input.actor.id }, { submission: submissionId, files: files.map((f, i) => ({ name: f.name, sha256: sha256Hex(f.bytes), id: mediaIds[i] })), contract_version: stored.version });

  let merged: Record<string, Merged> = {}; let nextEvidence: string[] = []; let aiCalled = false;
  let passA: unknown = null, passB: unknown = null; let models = { examiner: null as string | null, cross: null as string | null }; let failures: string[] = [];
  let verdict;
  if (gate.hardFail || gate.blockAi) {
    verdict = computeVerdict({ hardGateFailed: gate.hardFail, blockedForReview: gate.blockAi, merged: [] });
    nextEvidence = gate.gates.filter((g) => g.status === "fail" && g.hard).map((g) => `${g.name}: ${g.reason}. Submit a new photo or clip that fixes this.`);
  } else {
    const beforeRows = await pool.query<{ name: string; mime: string; bytes: Buffer }>(`SELECT name, mime, bytes FROM court_media WHERE ticket_id = $1 AND kind = 'before' AND mime LIKE 'image/%' ORDER BY created_at LIMIT 2`, [input.ticketId]);
    const toImg = (name: string, mime: string, b: Buffer): Image => ({ name, mime, base64: b.toString("base64") });
    aiCalled = true;
    const out = await assess(contract, beforeRows.rows.map((r) => toImg(r.name, r.mime, r.bytes)), files.map((f) => toImg(f.name, f.mime, f.bytes)), deps);
    merged = out.merged; nextEvidence = out.nextEvidence; passA = out.passA; passB = out.passB; failures = out.failures;
    models = { examiner: out.modelA, cross: out.modelB };
    verdict = computeVerdict({ hardGateFailed: false, merged: contract.criteria.map((c) => out.merged[c.id]!) });
  }
  const latencyMs = Math.round(performance.now() - t0);
  const intact = contractIntact(stored);
  await pool.query(
    `INSERT INTO court_submissions (id, ticket_id, contract_version, submitted_by, actor_type, note, gates, pass_a, pass_b, merged, verdict, rule, next_evidence, models, latency_ms, ai_called, media_ids)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [submissionId, input.ticketId, stored.version, input.actor.id, input.actor.type, input.note ?? null, JSON.stringify(gate.gates), JSON.stringify(passA), JSON.stringify(passB), JSON.stringify(merged), verdict.verdict, verdict.rule, JSON.stringify(nextEvidence), JSON.stringify(models), latencyMs, aiCalled, mediaIds]);
  await appendEvent(input.ticketId, VERDICT_EVENT[verdict.verdict] as never, { type: "SYSTEM", id: "court" }, { submission: submissionId, verdict: verdict.verdict, merged, gates: gate.gates.map((g) => `${g.id}:${g.status}`) });
  return { submissionId, verdict: verdict.verdict, rule: verdict.rule, gates: gate.gates, merged, nextEvidence, aiCalled, models, failures, latencyMs, contractVersion: stored.version, contractIntact: intact, passA, passB, mediaIds };
}

/** Everything the Court screen needs for one ticket (no file bytes). */
export async function courtView(ticketId: string) {
  const { latestContract } = await import("./compile.js");
  const contract = await latestContract(ticketId);
  const subs = await pool.query(`SELECT id, contract_version, submitted_by, actor_type, note, gates, pass_a, pass_b, merged, verdict, rule, next_evidence, models, latency_ms, ai_called, media_ids, created_at FROM court_submissions WHERE ticket_id = $1 ORDER BY created_at`, [ticketId]);
  const media = await pool.query(`SELECT id, kind, name, mime, sha256, exif, submission_id, created_at, length(bytes) AS size FROM court_media WHERE ticket_id = $1 ORDER BY created_at`, [ticketId]);
  return { contract: contract ? { ...contract, intact: contractIntact(contract) } : null, submissions: subs.rows, media: media.rows };
}

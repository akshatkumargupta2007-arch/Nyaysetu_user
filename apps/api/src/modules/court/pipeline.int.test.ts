import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { buildApp } from "../../app.js";
import { pool } from "../../db/client.js";
import type { AppInstance } from "../../types.js";
import { fileTicket } from "../../test/govBridge.js";
import { officerHeaders } from "../../test/auth.js";
import { ensureContract, contractIntact } from "./compile.js";
import { courtView, storeMedia, submitProof } from "./pipeline.js";
import { PASS_SCHEMA, type PassResult } from "./assess.js";
import type { Status } from "./verdict.js";
import { templateContract } from "./contract.js";

let app: AppInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

async function picture(seed: number): Promise<Buffer> {
  let s = seed >>> 0; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 0xffffffff; };
  const small = Buffer.alloc(16 * 12); for (let i = 0; i < small.length; i++) small[i] = Math.floor(rnd() * 255);
  return sharp(small, { raw: { width: 16, height: 12, channels: 1 } }).resize(480, 360, { kernel: "cubic" }).jpeg({ quality: 90 }).toBuffer();
}
const b64 = (b: Buffer) => b.toString("base64");
const actor = { type: "OFFICER" as const, id: "test-officer" };

/** A scripted model: answers by pass (examiner vs cross-examiner) with the statuses we want. */
function fakeModel(a: Status, b: Status, calls?: string[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (o: any): Promise<any> => {
    calls?.push(o.purpose);
    if (o.purpose === "vision-instruction-scan") return { ok: true as const, value: { contains_instructions: false }, model: "fake", tokens: 0, attempts: 1 };
    if (o.purpose === "contract") return { ok: false as const, degraded: true as const, kind: "TIMEOUT" as const, message: "late", userMessage: "slow" };
    const status = o.purpose === "vision-examiner" ? a : b;
    const mock = (await o.mockResult()) as PassResult;
    const value = { ...mock, assessments: mock.assessments.map((x) => ({ ...x, status, observation: "fake observation", limits: "fake limits", next_evidence: status === "supported" ? null : "a clearer photo", confidence: 0.8 })), strongest_objection: "none" };
    o.validate?.(value);
    return { ok: true as const, value, model: o.purpose === "vision-examiner" ? "model-a" : "model-b", tokens: 1, attempts: 1 };
  };
}

describe("Closure Court pipeline (real database, scripted model)", () => {
  it("the contract is frozen once, hashed into the ledger, and is the template when Gemini is late", async () => {
    const { ticketId } = await fileTicket(app);
    const c = await ensureContract(ticketId, { generate: fakeModel("supported", "supported") });
    expect(c.version).toBe(1); expect(c.source).toBe("template"); expect(contractIntact(c)).toBe(true);
    expect((await ensureContract(ticketId)).sha256).toBe(c.sha256); // idempotent
    const ev = await pool.query("SELECT payload FROM events WHERE ticket_id = $1 AND type = 'PROOF_CONTRACT_FROZEN'", [ticketId]);
    expect(ev.rowCount).toBe(1); expect(ev.rows[0].payload.sha256).toBe(c.sha256);
    await pool.query("UPDATE proof_contracts SET contract = jsonb_set(contract, '{claim}', '\"changed\"') WHERE ticket_id = $1", [ticketId]);
    expect(contractIntact((await ensureContract(ticketId)))).toBe(false); // tampering is detectable
  });

  it("reusing the original photo is REJECTED by a gate and no model is called", async () => {
    const { ticketId } = await fileTicket(app);
    const before = await picture(1);
    await storeMedia(ticketId, "before", { name: "before.jpg", mime: "image/jpeg", bytes: before, isVideo: false }, null);
    const calls: string[] = [];
    const mirrored = await sharp(before).flop().jpeg({ quality: 80 }).toBuffer();
    const r = await submitProof({ ticketId, actor, files: [{ name: "mirrored.jpg", mime: "image/jpeg", base64: b64(mirrored) }] }, { generate: fakeModel("supported", "supported", calls) as never });
    expect(r.verdict).toBe("REJECTED"); expect(r.aiCalled).toBe(false);
    expect(calls.filter((c) => c.startsWith("vision-examiner") || c.startsWith("vision-cross"))).toHaveLength(0);
    expect(r.gates.find((g) => g.id === "G2")!.status).toBe("fail");
  });

  it("both opinions supported and no gate failed: EVIDENCE_PASSED, and the ticket state does NOT change", async () => {
    const { ticketId } = await fileTicket(app);
    const stateBefore = (await pool.query("SELECT state FROM tickets WHERE id = $1", [ticketId])).rows[0].state;
    await storeMedia(ticketId, "before", { name: "before.jpg", mime: "image/jpeg", bytes: await picture(5), isVideo: false }, null);
    const r = await submitProof({ ticketId, actor, files: [{ name: "after.jpg", mime: "image/jpeg", base64: b64(await picture(6)) }], declaredAt: new Date().toISOString() }, { generate: fakeModel("supported", "supported") as never });
    // a streetlight contract needs darkness: with a daylight clock the sun gate rejects it (no AI); otherwise both opinions pass it
    if (r.gates.find((g) => g.id === "G5")!.status === "fail") { expect(r.verdict).toBe("REJECTED"); expect(r.aiCalled).toBe(false); }
    else { expect(r.aiCalled).toBe(true); expect(r.verdict).toBe("EVIDENCE_PASSED"); }
    expect((await pool.query("SELECT state FROM tickets WHERE id = $1", [ticketId])).rows[0].state).toBe(stateBefore);
  });

  it("the two opinions disagreeing sends it to a person; one opinion missing never passes", async () => {
    const { ticketId } = await fileTicket(app);
    // use a ticket whose contract has no darkness need by forcing a road contract
    await pool.query("INSERT INTO proof_contracts (ticket_id, version, contract, sha256, source) VALUES ($1, 1, $2, 'x', 'template') ON CONFLICT DO NOTHING", [ticketId, JSON.stringify(templateContract(ticketId, "ROAD_POTHOLE", ""))]);
    const { contractHash } = await import("./contract.js");
    await pool.query("UPDATE proof_contracts SET sha256 = $2 WHERE ticket_id = $1", [ticketId, contractHash(templateContract(ticketId, "ROAD_POTHOLE", ""))]);
    const file = [{ name: "x.jpg", mime: "image/jpeg", base64: b64(await picture(7)) }];
    const split = await submitProof({ ticketId, actor, files: file }, { generate: fakeModel("supported", "not_demonstrated") as never });
    expect(split.verdict).toBe("NEEDS_HUMAN_REVIEW");
    const half = await submitProof({ ticketId, actor, files: [{ name: "y.jpg", mime: "image/jpeg", base64: b64(await picture(8)) }] }, { generate: (async (o: { purpose: string }) => (o.purpose === "vision-cross" ? { ok: false, degraded: true, kind: "TIMEOUT", message: "t", userMessage: "t" } : o.purpose === "vision-instruction-scan" ? { ok: true, value: { contains_instructions: false }, model: "f", tokens: 0, attempts: 1 } : (fakeModel("supported", "supported") as never as (o: unknown) => unknown)(o))) as never });
    expect(half.verdict).toBe("NEEDS_HUMAN_REVIEW");
    const failed = await submitProof({ ticketId, actor, files: [{ name: "z.jpg", mime: "image/jpeg", base64: b64(await picture(9)) }] }, { generate: fakeModel("contradicted", "supported") as never });
    expect(failed.verdict).toBe("FAILED"); expect(failed.nextEvidence.length).toBeGreaterThan(0);
    const more = await submitProof({ ticketId, actor, files: [{ name: "w.jpg", mime: "image/jpeg", base64: b64(await picture(10)) }] }, { generate: fakeModel("not_demonstrated", "not_demonstrated") as never });
    expect(more.verdict).toBe("NEEDS_MORE_EVIDENCE");
    const view = await courtView(ticketId);
    expect(view.submissions.length).toBe(4); // every attempt is kept, each against the same contract version
    expect(new Set(view.submissions.map((s: { contract_version: number }) => s.contract_version)).size).toBe(1);
  });

  it("the ledger records the court events and its hash chain is unbroken", async () => {
    const { ticketId } = await fileTicket(app);
    await storeMedia(ticketId, "before", { name: "b.jpg", mime: "image/jpeg", bytes: await picture(40), isVideo: false }, null);
    await submitProof({ ticketId, actor, files: [{ name: "a.jpg", mime: "image/jpeg", base64: b64(await picture(41)) }], declaredAt: new Date().toISOString() }, { generate: fakeModel("supported", "supported") as never });
    const ev = (await pool.query("SELECT seq, type, prev_hash, hash FROM events WHERE ticket_id = $1 ORDER BY seq", [ticketId])).rows;
    expect(ev.some((e) => e.type === "PROOF_CONTRACT_FROZEN")).toBe(true);
    expect(ev.some((e) => e.type === "PROOF_SUBMITTED")).toBe(true);
    for (let i = 1; i < ev.length; i++) expect(ev[i].prev_hash).toBe(ev[i - 1].hash);
  });

  it("routes: officers submit, nobody else does; bad files are refused cleanly", async () => {
    const { ticketId, citizen } = await fileTicket(app);
    const body = { files: [{ name: "a.jpg", mime: "image/jpeg", base64: b64(await picture(50)) }] };
    expect((await app.inject({ method: "POST", url: `/tickets/${ticketId}/proof`, payload: body })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: `/tickets/${ticketId}/proof`, headers: citizen.headers, payload: body })).statusCode).toBe(401);
    const bad = await app.inject({ method: "POST", url: `/tickets/${ticketId}/proof`, headers: officerHeaders(app), payload: { files: [{ name: "x.exe", mime: "application/octet-stream", base64: "AAAAAAAAAA" }] } });
    expect(bad.statusCode).toBe(400); expect(bad.json().code).toBe("BAD_TYPE");
    expect((await app.inject({ method: "POST", url: `/tickets/not-a-uuid/proof`, headers: officerHeaders(app), payload: body })).statusCode).toBe(404);
    // the owner can read the court view; a stranger cannot
    const own = await app.inject({ method: "GET", url: `/tickets/${ticketId}/court`, headers: citizen.headers });
    expect(own.statusCode).toBe(200); expect(own.json().contract.contract.criteria.length).toBeGreaterThanOrEqual(2);
    const { createTestCitizen } = await import("../../test/auth.js");
    const other = await createTestCitizen(app);
    expect((await app.inject({ method: "GET", url: `/tickets/${ticketId}/court`, headers: other.headers })).statusCode).toBe(404);
  });
});
void PASS_SCHEMA;

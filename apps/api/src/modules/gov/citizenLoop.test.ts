// CA5 + CA6 + CA7: the citizen's side of the "please verify" loop.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { buildApp } from "../../app.js";
import { pool } from "../../db/client.js";
import type { AppInstance } from "../../types.js";
import { buildBridgeApp, CLOSE_REQUEST_PATH } from "./bridge.js";
import { signRequest } from "./signing.js";
import { verifyEventChain } from "../lifecycle/verify.js";
import { createTestCitizen } from "../../test/auth.js";
import { fileTicket, moveToWorkDone, ticketState } from "../../test/govBridge.js";

const GOV_PRIV = process.env.TEST_GOV_WRITEBACK_PRIVATE_KEY!;
let app: AppInstance;
let bridge: Awaited<ReturnType<typeof buildBridgeApp>>;
let base = "";

beforeAll(async () => {
  app = await buildApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  bridge = await buildBridgeApp();
  await bridge.ready();
});
afterAll(async () => {
  await bridge.close();
  await app.close();
});

const govAsks = (ticketId: string, over: Record<string, unknown> = {}) => {
  const raw = JSON.stringify({ ticket_id: ticketId, gov_user_id: "u1", gov_user_name: "Officer A", note: "Please check the lamp", idempotency_key: randomUUID(), ...over });
  return bridge.inject({ method: "POST", url: CLOSE_REQUEST_PATH, payload: raw, headers: { "content-type": "application/json", ...signRequest(GOV_PRIV, "POST", CLOSE_REQUEST_PATH, raw) } });
};
const myReports = async (headers: Record<string, string>) => (await app.inject({ method: "GET", url: "/me/reports", headers })).json() as any[];
const answer = (ticketId: string, headers: Record<string, string>, body: object) =>
  app.inject({ method: "POST", url: `/reports/${ticketId}/confirm-closure`, headers, payload: body });
async function waitingTicket() {
  const t = await fileTicket(app);
  await moveToWorkDone(t.ticketId);
  return t;
}

describe("CA6 /me/reports: pending_close_request", () => {
  it("is null until an official asks, then carries the note and the official's name", async () => {
    const { ticketId, citizen } = await waitingTicket();
    const card = async () => (await myReports(citizen.headers)).find((r) => r.ticketId === ticketId);
    expect((await card()).pending_close_request).toBeNull();
    expect((await govAsks(ticketId)).statusCode).toBe(200);
    expect((await card()).pending_close_request).toEqual({ requested_at: expect.any(String), note: "Please check the lamp", official_name: "Officer A" });
  });

  it("only the citizens who reported that ticket see the request", async () => {
    const { ticketId } = await waitingTicket();
    await govAsks(ticketId);
    const stranger = await createTestCitizen(app);
    expect((await myReports(stranger.headers)).find((r) => r.ticketId === ticketId)).toBeUndefined();
  });

  it("goes away once the citizen says YES (ticket closes)", async () => {
    const { ticketId, citizen } = await waitingTicket();
    await govAsks(ticketId);
    expect((await answer(ticketId, citizen.headers, { confirmed: true })).statusCode).toBe(200);
    expect((await ticketState(ticketId)).state).toBe("CLOSED_CONFIRMED");
    expect((await myReports(citizen.headers)).find((r) => r.ticketId === ticketId).pending_close_request).toBeNull();
  });

  it("goes away once the citizen says NO, and an old request never shows again on the next round of work", async () => {
    const { ticketId, citizen } = await waitingTicket();
    await govAsks(ticketId);
    await answer(ticketId, citizen.headers, { confirmed: false, note: "still dark" });
    expect((await myReports(citizen.headers)).find((r) => r.ticketId === ticketId).pending_close_request).toBeNull();
    await moveToWorkDone(ticketId); // work is reported done a second time
    expect((await ticketState(ticketId)).state).toBe("WORK_DONE_PENDING_CONFIRMATION");
    expect((await myReports(citizen.headers)).find((r) => r.ticketId === ticketId).pending_close_request).toBeNull(); // the old request does not come back
  });
});

describe("CA7 'No, it is still broken' reopens the SAME ticket (Bible test 10)", () => {
  it("same ticket and code, escalated by one level, back to REOPENED, ledger chain valid", async () => {
    const { ticketId, publicCode, citizen } = await waitingTicket();
    const before = await ticketState(ticketId);
    const res = await answer(ticketId, citizen.headers, { confirmed: false, note: "The light works for a minute and goes out again" });
    expect(res.statusCode).toBe(200);
    expect(res.json().state).toBe("REOPENED");
    const after = await ticketState(ticketId);
    expect(after.state).toBe("REOPENED");
    expect(after.escalation_level).toBe(before.escalation_level + 1);
    expect((await pool.query("SELECT public_code FROM tickets WHERE id = $1", [ticketId])).rows[0].public_code).toBe(publicCode);
    expect((await pool.query("SELECT count(*)::int AS n FROM tickets WHERE public_code = $1", [publicCode])).rows[0].n).toBe(1); // no second ticket
    expect(await verifyEventChain(ticketId)).toMatchObject({ ok: true });
    const ev = await pool.query("SELECT payload FROM events WHERE ticket_id = $1 AND to_state = 'REOPENED'", [ticketId]);
    expect(ev.rows[0].payload).toMatchObject({ note: "The light works for a minute and goes out again" });
  });

  it("a new photo is attached to the same ticket as 'reopen' media", async () => {
    const { ticketId, citizen } = await waitingTicket();
    await answer(ticketId, citizen.headers, { confirmed: false, note: "still broken", photoPublicId: "nyaysetu/reports/new-photo-1" });
    const m = await pool.query("SELECT kind, ticket_id, uploader_type, uploader_id, cloudinary_public_id FROM media WHERE ticket_id = $1 AND kind = 'reopen'", [ticketId]);
    expect(m.rows).toEqual([{ kind: "reopen", ticket_id: ticketId, uploader_type: "CITIZEN", uploader_id: citizen.id, cloudinary_public_id: "nyaysetu/reports/new-photo-1" }]);
  });

  it("a different citizen cannot answer for someone else's complaint", async () => {
    const { ticketId } = await waitingTicket();
    const stranger = await createTestCitizen(app);
    expect((await answer(ticketId, stranger.headers, { confirmed: true })).statusCode).toBe(403);
    expect((await ticketState(ticketId)).state).toBe("WORK_DONE_PENDING_CONFIRMATION");
  });
});

describe("CA5 /me/stream", () => {
  async function open(token: string) {
    const ctl = new AbortController();
    const res = await fetch(`${base}/me/stream?token=${token}`, { signal: ctl.signal });
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const until = async (needle: string, ms = 4000) => {
      const t0 = Date.now();
      while (!buf.includes(needle)) {
        if (Date.now() - t0 > ms) throw new Error(`timed out waiting for "${needle}"; got: ${buf}`);
        const r = await Promise.race([reader.read(), new Promise<null>((ok) => setTimeout(() => ok(null), 200))]);
        if (r && !r.done) buf += dec.decode(r.value);
      }
      return buf;
    };
    return { res, until, close: () => ctl.abort() };
  }

  it("needs a login", async () => {
    const res = await fetch(`${base}/me/stream`);
    expect(res.status).toBe(401);
  });

  it("an official's request reaches the citizen's open app within moments, with no refresh", async () => {
    const { ticketId, citizen, publicCode } = await waitingTicket();
    const s = await open(citizen.token);
    expect(s.res.headers.get("content-type")).toContain("text/event-stream");
    expect(s.res.headers.get("cache-control")).toContain("no-cache");
    await s.until("event: ready");
    await govAsks(ticketId);
    const got = await s.until("event: close_request");
    expect(got).toContain(`"ticketCode":"${publicCode}"`);
    expect(got).toContain('"officialName":"Officer A"');
    expect(got).toContain("Please check the lamp");
    s.close();
  });

  it("state changes of the citizen's own tickets are pushed too", async () => {
    const { ticketId, citizen } = await fileTicket(app).then(async (t) => ({ ...t }));
    const s = await open(citizen.token);
    await s.until("event: ready");
    await moveToWorkDone(ticketId);
    const got = await s.until('"state":"WORK_DONE_PENDING_CONFIRMATION"');
    expect(got).toContain("event: state");
    s.close();
  });

  it("a citizen never hears about someone else's tickets", async () => {
    const { ticketId } = await waitingTicket();
    const stranger = await createTestCitizen(app);
    const s = await open(stranger.token);
    await s.until("event: ready");
    await govAsks(ticketId);
    await expect(s.until("close_request", 800)).rejects.toThrow(/timed out/);
    s.close();
  });
});

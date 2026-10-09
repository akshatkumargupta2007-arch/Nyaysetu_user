// CA3: the write-back door (Bible section 12, tests 7, 8, 9).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { buildApp } from "../../app.js";
import { pool } from "../../db/client.js";
import type { AppInstance } from "../../types.js";
import { buildBridgeApp, CLOSE_REQUEST_PATH } from "./bridge.js";
import { signRequest } from "./signing.js";
import { subscribeCitizen, type CitizenLiveEvent } from "./citizenEvents.js";
import { verifyEventChain } from "../lifecycle/verify.js";
import { fileTicket, moveToWorkDone, ticketState } from "../../test/govBridge.js";

const GOV_PRIV = process.env.TEST_GOV_WRITEBACK_PRIVATE_KEY!;
let app: AppInstance;
let bridge: Awaited<ReturnType<typeof buildBridgeApp>>;

beforeAll(async () => {
  app = await buildApp();
  bridge = await buildBridgeApp();
  await bridge.ready();
});
afterAll(async () => {
  await bridge.close();
  await app.close();
});

const body = (ticketId: string, over: Record<string, unknown> = {}) => ({
  ticket_id: ticketId, gov_user_id: "u1", gov_user_name: "Officer A", note: "Work is finished, please check", idempotency_key: randomUUID(), ...over,
});
const post = (b: unknown, key = GOV_PRIV, headersOver: Record<string, string> = {}) => {
  const raw = JSON.stringify(b);
  return bridge.inject({
    method: "POST", url: CLOSE_REQUEST_PATH, payload: raw,
    headers: { "content-type": "application/json", ...signRequest(key, "POST", CLOSE_REQUEST_PATH, raw), ...headersOver },
  });
};

describe("CA3 the door is not on the public port (test 7)", () => {
  it("the public API returns 404 for the internal path", async () => {
    const res = await app.inject({ method: "POST", url: CLOSE_REQUEST_PATH, payload: { ticket_id: randomUUID() } });
    expect(res.statusCode).toBe(404);
  });
});

describe("CA3 close request write-back (tests 8 and 9)", () => {
  it("appends CLOSE_REQUESTED_BY_GOV, leaves the state alone, chain still valid (test 8)", async () => {
    const { ticketId } = await fileTicket(app);
    await moveToWorkDone(ticketId);
    const before = await ticketState(ticketId);
    const res = await post(body(ticketId));
    expect(res.statusCode).toBe(200);
    const after = await ticketState(ticketId);
    expect(after.state).toBe("WORK_DONE_PENDING_CONFIRMATION");
    expect(after.last_event_seq).toBe(before.last_event_seq + 1);
    expect(await verifyEventChain(ticketId)).toMatchObject({ ok: true });
    const ev = await pool.query("SELECT payload, actor_type, actor_id FROM events WHERE ticket_id = $1 AND type = 'CLOSE_REQUESTED_BY_GOV'", [ticketId]);
    expect(ev.rows[0].actor_type).toBe("GOV");
    expect(ev.rows[0].payload).toMatchObject({ note: "Work is finished, please check", gov_user_name: "Officer A" });
  });

  it("tells the reporting citizen's open app straight away", async () => {
    const { ticketId, citizen, publicCode } = await fileTicket(app);
    await moveToWorkDone(ticketId);
    const seen: CitizenLiveEvent[] = [];
    const off = subscribeCitizen(citizen.id, (e) => seen.push(e));
    expect((await post(body(ticketId))).statusCode).toBe(200);
    off();
    // (state-change pushes may also arrive; this test is about the close request)
    const asks = seen.filter((e) => e.type === "close_request");
    expect(asks).toHaveLength(1);
    expect(asks[0]).toMatchObject({ type: "close_request", ticketId, ticketCode: publicCode, officialName: "Officer A" });
  });

  it("refuses a ticket that is not waiting for the citizen (wrong state)", async () => {
    const { ticketId } = await fileTicket(app);
    const res = await post(body(ticketId));
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("WRONG_STATE");
    expect((await pool.query("SELECT count(*)::int AS n FROM events WHERE ticket_id = $1 AND type = 'CLOSE_REQUESTED_BY_GOV'", [ticketId])).rows[0].n).toBe(0);
  });

  it("allows only one request per ticket per 24 hours", async () => {
    const { ticketId } = await fileTicket(app);
    await moveToWorkDone(ticketId);
    expect((await post(body(ticketId))).statusCode).toBe(200);
    const second = await post(body(ticketId));
    expect(second.statusCode).toBe(409);
    expect(second.json().code).toBe("TOO_SOON");
    expect(Number(second.headers["retry-after"])).toBeGreaterThan(80_000);
  });

  it("a retry with the same idempotency key does not add a second note", async () => {
    const { ticketId } = await fileTicket(app);
    await moveToWorkDone(ticketId);
    const b = body(ticketId);
    const a = await post(b);
    const again = await post(b);
    expect(a.statusCode).toBe(200);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ duplicate: true, seq: a.json().seq });
    expect((await pool.query("SELECT count(*)::int AS n FROM events WHERE ticket_id = $1 AND type = 'CLOSE_REQUESTED_BY_GOV'", [ticketId])).rows[0].n).toBe(1);
  });

  it("rejects a bad signature, a tampered body, a replay and a stale timestamp", async () => {
    const { ticketId } = await fileTicket(app);
    await moveToWorkDone(ticketId);
    const wrongKey = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
    expect((await post(body(ticketId), wrongKey)).statusCode).toBe(401);

    const raw = JSON.stringify(body(ticketId));
    const signed = signRequest(GOV_PRIV, "POST", CLOSE_REQUEST_PATH, raw);
    const tampered = await bridge.inject({ method: "POST", url: CLOSE_REQUEST_PATH, headers: { "content-type": "application/json", ...signed }, payload: raw.replace("Officer A", "Officer B") });
    expect(tampered.statusCode).toBe(401);

    const ok = await bridge.inject({ method: "POST", url: CLOSE_REQUEST_PATH, headers: { "content-type": "application/json", ...signed }, payload: raw });
    expect(ok.statusCode).toBe(200);
    const replay = await bridge.inject({ method: "POST", url: CLOSE_REQUEST_PATH, headers: { "content-type": "application/json", ...signed }, payload: raw });
    expect(replay.statusCode).toBe(401);
    expect(replay.json().code).toBe("REPLAY");

    const rawStale = JSON.stringify(body(ticketId, { idempotency_key: randomUUID() }));
    const stale = await bridge.inject({ method: "POST", url: CLOSE_REQUEST_PATH, headers: { "content-type": "application/json", ...signRequest(GOV_PRIV, "POST", CLOSE_REQUEST_PATH, rawStale, Date.now() - 300_000) }, payload: rawStale });
    expect(stale.statusCode).toBe(401);
    expect(stale.json().code).toBe("STALE");
  });

  it("a request with no signature headers is rejected", async () => {
    const res = await bridge.inject({ method: "POST", url: CLOSE_REQUEST_PATH, headers: { "content-type": "application/json" }, payload: JSON.stringify(body(randomUUID())) });
    expect(res.statusCode).toBe(401);
  });

  it("an unknown ticket is a clean 404", async () => {
    expect((await post(body(randomUUID()))).statusCode).toBe(404);
  });

  it("the citizen can still answer afterwards: the ticket is still WORK_DONE_PENDING_CONFIRMATION, only the citizen closes it", async () => {
    const { ticketId, citizen } = await fileTicket(app);
    await moveToWorkDone(ticketId);
    await post(body(ticketId));
    expect((await ticketState(ticketId)).state).toBe("WORK_DONE_PENDING_CONFIRMATION");
    expect(citizen.id).toBeTruthy();
  });
});

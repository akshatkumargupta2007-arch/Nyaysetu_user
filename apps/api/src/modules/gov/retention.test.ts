// CA8: the 7-day confirmation timeout and the 180-day phone erasure.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { buildApp } from "../../app.js";
import { pool } from "../../db/client.js";
import type { AppInstance } from "../../types.js";
import { processPhoneErasure, processUnconfirmedTimeouts } from "../lifecycle/worker.js";
import { transition } from "../lifecycle/transition.js";
import { verifyEventChain } from "../lifecycle/verify.js";
import { buildTicketPayloads } from "./sync.js";
import { buildBridgeApp, CLOSE_REQUEST_PATH } from "./bridge.js";
import { signRequest } from "./signing.js";
import { fileTicket, moveToWorkDone, ticketState } from "../../test/govBridge.js";

let app: AppInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

const DAY = 24 * 3_600_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const setResolved = (id: string, at: Date) => pool.query("UPDATE tickets SET resolved_at = $2 WHERE id = $1", [id, at]);
const setClosed = (id: string, at: Date) => pool.query("UPDATE tickets SET closed_at = $2 WHERE id = $1", [id, at]);

describe("CA8 seven-day confirmation timeout", () => {
  it("closes an unanswered ticket as CLOSED_UNCONFIRMED (never as confirmed) after 7 days, by the system", async () => {
    const { ticketId } = await fileTicket(app);
    await moveToWorkDone(ticketId);
    await setResolved(ticketId, ago(8));
    await processUnconfirmedTimeouts();
    expect((await ticketState(ticketId)).state).toBe("CLOSED_UNCONFIRMED");
    const e = await pool.query("SELECT actor_type, actor_id, payload FROM events WHERE ticket_id = $1 AND to_state = 'CLOSED_UNCONFIRMED'", [ticketId]);
    expect(e.rows[0]).toMatchObject({ actor_type: "SYSTEM", actor_id: "confirmation-timeout" });
    expect(await verifyEventChain(ticketId)).toMatchObject({ ok: true });
  });

  it("leaves a ticket alone at 6 days, and tickets that are not waiting for the citizen", async () => {
    const waiting = await fileTicket(app);
    await moveToWorkDone(waiting.ticketId);
    await setResolved(waiting.ticketId, ago(6));
    const dispatched = await fileTicket(app);
    await processUnconfirmedTimeouts();
    expect((await ticketState(waiting.ticketId)).state).toBe("WORK_DONE_PENDING_CONFIRMATION");
    expect((await ticketState(dispatched.ticketId)).state).not.toBe("CLOSED_UNCONFIRMED");
  });

  it("a government 'please verify' request does NOT extend the 7 days (it counts from when the work was marked done)", async () => {
    const { ticketId } = await fileTicket(app);
    await moveToWorkDone(ticketId);
    await setResolved(ticketId, ago(8));
    const bridge = await buildBridgeApp();
    const raw = JSON.stringify({ ticket_id: ticketId, gov_user_id: "u1", gov_user_name: "A", note: null, idempotency_key: randomUUID() });
    const res = await bridge.inject({ method: "POST", url: CLOSE_REQUEST_PATH, payload: raw, headers: { "content-type": "application/json", ...signRequest(process.env.TEST_GOV_WRITEBACK_PRIVATE_KEY!, "POST", CLOSE_REQUEST_PATH, raw) } });
    await bridge.close();
    expect(res.statusCode).toBe(200); // the request was accepted a moment ago...
    await processUnconfirmedTimeouts();
    expect((await ticketState(ticketId)).state).toBe("CLOSED_UNCONFIRMED"); // ...but the deadline had already passed
  });

  it("is safe to run twice", async () => {
    const { ticketId } = await fileTicket(app);
    await moveToWorkDone(ticketId);
    await setResolved(ticketId, ago(9));
    await processUnconfirmedTimeouts();
    await expect(processUnconfirmedTimeouts()).resolves.toBeGreaterThanOrEqual(0);
    expect((await ticketState(ticketId)).state).toBe("CLOSED_UNCONFIRMED");
  });
});

describe("CA8 180-day phone erasure", () => {
  async function closedTicket(daysAgo: number, how: "CLOSED_CONFIRMED" | "CLOSED_UNCONFIRMED" = "CLOSED_CONFIRMED") {
    const t = await fileTicket(app);
    await moveToWorkDone(t.ticketId);
    await transition(t.ticketId, how, how === "CLOSED_CONFIRMED" ? { type: "CITIZEN", id: t.citizen.id } : { type: "SYSTEM", id: "x" }, {});
    await setClosed(t.ticketId, ago(daysAgo));
    return t;
  }
  const phoneOf = async (citizenId: string) => (await pool.query("SELECT phone_enc, phone_hash FROM citizens WHERE id = $1", [citizenId])).rows[0];

  it("erases the number 180 days after closure, appends a ledger note, and the next gov sync carries an empty phone", async () => {
    const t = await closedTicket(181);
    expect((await phoneOf(t.citizen.id)).phone_enc).not.toBeNull();
    await processPhoneErasure();
    expect(await phoneOf(t.citizen.id)).toEqual({ phone_enc: null, phone_hash: null });
    const ev = await pool.query("SELECT actor_type, payload FROM events WHERE ticket_id = $1 AND type = 'PHONE_ERASED'", [t.ticketId]);
    expect(ev.rows).toHaveLength(1);
    expect(ev.rows[0]).toMatchObject({ actor_type: "SYSTEM", payload: { retention_days: 180 } });
    expect(await verifyEventChain(t.ticketId)).toMatchObject({ ok: true });
    const [payload] = await buildTicketPayloads([t.ticketId]);
    expect(payload!.phone_cipher).toBeNull();
    expect(payload!.phone_masked).toBeNull();
    expect(payload!.reporters.every((r: any) => r.phone_cipher === null)).toBe(true);
  });

  it("keeps the number at 100 days, and while ANY of the citizen's tickets is still open", async () => {
    const recent = await closedTicket(100);
    await processPhoneErasure();
    expect((await phoneOf(recent.citizen.id)).phone_enc).not.toBeNull();

    // same citizen, one old closed ticket + one new open ticket => keep
    const old = await closedTicket(200);
    const u = await app.inject({ method: "POST", url: "/reports/understand", payload: { text: `another problem ${Date.now()} near the bus stand`, lang: "en", lat: 21.185, lng: 81.33 } });
    const c = await app.inject({ method: "POST", url: "/reports/confirm", headers: old.citizen.headers, payload: { draftId: u.json().draftId } });
    expect(c.statusCode).toBe(201);
    await processPhoneErasure();
    expect((await phoneOf(old.citizen.id)).phone_enc).not.toBeNull();
  });

  it("works the same for tickets that closed by the timeout, and is safe to run twice", async () => {
    const t = await closedTicket(190, "CLOSED_UNCONFIRMED");
    await processPhoneErasure();
    await processPhoneErasure();
    expect((await phoneOf(t.citizen.id)).phone_enc).toBeNull();
    expect((await pool.query("SELECT count(*)::int AS n FROM events WHERE ticket_id = $1 AND type = 'PHONE_ERASED'", [t.ticketId])).rows[0].n).toBe(1); // not twice
  });
});

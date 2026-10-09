// CA4: the gov-sync push (citizen -> gov). The gov portal is replaced by a stub `fetch` here; the real
// end-to-end run against the actual gov receiver is scripts/e2e.mjs (GX3).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../app.js";
import { pool } from "../../db/client.js";
import type { AppInstance } from "../../types.js";
import { buildTicketPayloads, pendingTicketIds, pushOnce, SYNC_PATH } from "./sync.js";
import { verifySignedRequest } from "./signing.js";
import { openSealedPhone } from "./phoneSeal.js";
import { decryptPhone } from "../session/phone.js";
import { appendEvent } from "../lifecycle/transition.js";
import { fileTicket, moveToWorkDone } from "../../test/govBridge.js";
import { sweepOnce } from "./syncTrigger.js";

const SYNC_PUB = process.env.TEST_SYNC_SIGNING_PUBLIC_KEY!;
const SEAL_PRIV = process.env.TEST_GOV_PHONE_SEAL_PRIVATE_KEY!;
let app: AppInstance;

beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});
afterEach(() => vi.unstubAllGlobals());

type Sent = { url: string; headers: Record<string, string>; raw: string };
function stubGov(reply: (body: any) => { status?: number; json?: unknown }) {
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", async (url: string, init: { headers: Record<string, string>; body: string }) => {
    sent.push({ url, headers: init.headers, raw: init.body });
    const r = reply(JSON.parse(init.body));
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  });
  return sent;
}
const ackAll = (b: any) => ({ json: { acked: b.tickets.map((t: any) => ({ ticket_id: t.ticket_id, seq: t.last_event_seq })), rejected: [] } });
// Only look at the ticket(s) this test created, not whatever else is in the shared test database.
const mine = (b: any, id: string) => b.tickets.find((t: any) => t.ticket_id === id);

describe("CA4 gov-sync payload", () => {
  it("a new ticket is pending, and its payload carries everything gov needs, signed", async () => {
    const { ticketId, publicCode } = await fileTicket(app);
    expect(await pendingTicketIds(5000)).toContain(ticketId);

    const sent = stubGov(ackAll);
    const r = await pushOnce({ forceReference: true });
    expect(r.ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe(`http://gov.test:8091${SYNC_PATH}`);
    expect(verifySignedRequest(SYNC_PUB, "POST", SYNC_PATH, sent[0]!.headers, sent[0]!.raw)).toMatchObject({ ok: true });

    const body = JSON.parse(sent[0]!.raw);
    expect(body.reference.categories.length).toBeGreaterThan(5);
    expect(body.reference.boundaries.length).toBeGreaterThan(0);
    const t = mine(body, ticketId);
    expect(t).toMatchObject({ public_code: publicCode, tenant_id: "cg.bhilai", escalation_level: 0 });
    expect(typeof t.lat).toBe("number");
    expect(t.category_l1).toBeTruthy();
    expect(t.events.length).toBeGreaterThan(0);
  });

  it("the phone goes out only sealed + masked; the gov private key opens it, nothing else shows it", async () => {
    const { ticketId, citizen } = await fileTicket(app);
    const sent = stubGov(ackAll);
    await pushOnce();
    const raw = sent[0]!.raw;
    const digits = citizen.phone.replace(/\D/g, "").slice(-10);
    expect(raw).not.toContain(digits); // the plain number is never on the wire
    expect(raw).not.toContain(citizen.phone);
    const t = mine(JSON.parse(raw), ticketId);
    expect(t.phone_masked).toBe(`${digits.slice(0, 2)}XXXXXX${digits.slice(8)}`);
    expect(t.reporters[0].phone_last4).toBe(digits.slice(-4));
    expect(openSealedPhone(SEAL_PRIV, t.phone_cipher)).toBe(digits);
    // sanity: the citizen row really does decrypt to that number on this side
    const row = await pool.query("SELECT phone_enc FROM citizens WHERE id = $1", [citizen.id]);
    expect(decryptPhone(row.rows[0].phone_enc)?.endsWith(digits)).toBe(true);
  });

  it("an erased phone (180 days after closure) is sent as null", async () => {
    const { ticketId, citizen } = await fileTicket(app);
    await pool.query("UPDATE citizens SET phone_enc = NULL WHERE id = $1", [citizen.id]);
    const [t] = await buildTicketPayloads([ticketId]);
    expect(t!.phone_cipher).toBeNull();
    expect(t!.phone_masked).toBeNull();
  });

  it("only the close-request note's payload is shared; other event payloads stay here", async () => {
    const { ticketId } = await fileTicket(app);
    await moveToWorkDone(ticketId);
    await appendEvent(ticketId, "CLOSE_REQUESTED_BY_GOV", { type: "GOV", id: "gov:u1" }, { note: "check it", gov_user_name: "Officer A" });
    await appendEvent(ticketId, "OFFICER_NOTE_ADDED", { type: "OFFICER", id: "o1" }, { note: "SECRET INTERNAL NOTE" });
    const [t] = await buildTicketPayloads([ticketId]);
    const json = JSON.stringify(t);
    expect(json).not.toContain("SECRET INTERNAL NOTE");
    expect(t!.events.find((e: any) => e.type === "CLOSE_REQUESTED_BY_GOV")!.payload).toMatchObject({ note: "check it" });
  });
});

describe("CA4 the background sweep never takes the API down", () => {
  it("a database error (for example: not migrated yet, or the database restarting) is swallowed, not thrown", async () => {
    const spy = vi.spyOn(pool, "query").mockRejectedValue(new Error('relation "tickets" does not exist'));
    try {
      await expect(sweepOnce()).resolves.toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });

  it("an unreachable gov portal is also just a retry", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("connect ECONNREFUSED");
    });
    await expect(sweepOnce()).resolves.toBeUndefined();
  });
});

describe("CA4 cursor and retries", () => {
  it("the cursor advances only for acknowledged tickets, then the ticket is no longer pending", async () => {
    const { ticketId } = await fileTicket(app);
    stubGov(ackAll);
    await pushOnce();
    const c = await pool.query("SELECT acked_seq FROM gov_sync_cursor WHERE ticket_id = $1", [ticketId]);
    const t = await pool.query("SELECT last_event_seq FROM tickets WHERE id = $1", [ticketId]);
    expect(c.rows[0].acked_seq).toBe(t.rows[0].last_event_seq);
    expect(await pendingTicketIds(5000)).not.toContain(ticketId);
  });

  it("a ticket gov rejected is NOT acknowledged, and backs off instead of being re-sent every sweep", async () => {
    const { ticketId } = await fileTicket(app);
    stubGov((b) => ({ json: { acked: [], rejected: b.tickets.map((t: any) => ({ ticket_id: t.ticket_id, reason: "unknown_tenant" })) } }));
    await pushOnce();
    const c = (await pool.query("SELECT acked_seq, reject_count, reject_reason, rejected_until > now() AS waiting FROM gov_sync_cursor WHERE ticket_id = $1", [ticketId])).rows[0];
    expect(c).toMatchObject({ acked_seq: 0, reject_count: 1, reject_reason: "unknown_tenant", waiting: true });
    expect(await pendingTicketIds(5000)).not.toContain(ticketId); // waiting, so the next sweep does not send it again
    // when the wait is over it is tried again, and a second rejection waits LONGER
    await pool.query("UPDATE gov_sync_cursor SET rejected_until = now() - interval '1 second' WHERE ticket_id = $1", [ticketId]);
    expect(await pendingTicketIds(5000)).toContain(ticketId);
    await pushOnce();
    const c2 = (await pool.query("SELECT reject_count, rejected_until - now() AS wait FROM gov_sync_cursor WHERE ticket_id = $1", [ticketId])).rows[0];
    expect(c2.reject_count).toBe(2);
    expect(c2.wait.minutes).toBeGreaterThanOrEqual(3); // 4 minutes (2^2), not the first 2
  });

  it("a rejected ticket does not crowd out newer tickets, and a later acknowledgement clears the backoff", async () => {
    const bad = await fileTicket(app);
    stubGov((b) => ({ json: { acked: [], rejected: b.tickets.filter((t: any) => t.ticket_id === bad.ticketId).map((t: any) => ({ ticket_id: t.ticket_id, reason: "x" })) } }));
    await pushOnce(); // the bad ticket is now waiting
    const good = await fileTicket(app);
    const ids = await pendingTicketIds(1); // a batch of ONE: the waiting ticket must not take the slot
    expect(ids).not.toContain(bad.ticketId);
    expect(await pendingTicketIds(5000)).toContain(good.ticketId);
    // gov fixes its side: the next attempt is accepted and the backoff disappears
    await pool.query("UPDATE gov_sync_cursor SET rejected_until = now() - interval '1 second' WHERE ticket_id = $1", [bad.ticketId]);
    stubGov(ackAll);
    await pushOnce();
    const c = (await pool.query("SELECT reject_count, rejected_until, reject_reason FROM gov_sync_cursor WHERE ticket_id = $1", [bad.ticketId])).rows[0];
    expect(c).toEqual({ reject_count: 0, rejected_until: null, reject_reason: null });
  });

  it("when gov is down nothing is lost: error reported, ticket still pending, next push re-sends", async () => {
    const { ticketId } = await fileTicket(app);
    vi.stubGlobal("fetch", async () => {
      throw new Error("connect ECONNREFUSED");
    });
    const down = await pushOnce();
    expect(down.ok).toBe(false);
    expect(down.error).toContain("unreachable");
    expect(await pendingTicketIds(5000)).toContain(ticketId);
    const sent = stubGov(ackAll);
    expect((await pushOnce()).ok).toBe(true);
    expect(mine(JSON.parse(sent[0]!.raw), ticketId)).toBeTruthy();
  });

  it("a gov 401 (bad key) is reported and nothing is acknowledged", async () => {
    const { ticketId } = await fileTicket(app);
    stubGov(() => ({ status: 401, json: { code: "BAD_SIGNATURE" } }));
    const r = await pushOnce();
    expect(r.ok).toBe(false);
    expect(await pendingTicketIds(5000)).toContain(ticketId);
  });

  it("a new ledger event makes an acknowledged ticket pending again and only the NEW events are sent", async () => {
    const { ticketId } = await fileTicket(app);
    stubGov(ackAll);
    await pushOnce();
    await moveToWorkDone(ticketId);
    expect(await pendingTicketIds(5000)).toContain(ticketId);
    const sent = stubGov(ackAll);
    await pushOnce();
    const t = mine(JSON.parse(sent[0]!.raw), ticketId);
    expect(t.state).toBe("WORK_DONE_PENDING_CONFIRMATION");
    expect(t.events.every((e: any) => e.seq > 1)).toBe(true);
    expect(t.events.some((e: any) => e.to_state === "WORK_DONE_PENDING_CONFIRMATION")).toBe(true);
  });
});

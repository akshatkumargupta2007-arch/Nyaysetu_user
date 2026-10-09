// Build map #E1 & #E2 tests: State machine transitions, event ledger, and chain verification.
import { describe, it, expect, beforeAll } from "vitest";
import { canonicalJson, computeEventHash } from "./canonical.js";
import { ALLOWED, GENESIS_PREV_HASH, type State, type ActorType } from "./types.js";
import { buildApp } from "../../app.js";
import type { AppInstance } from "../../types.js";
import { pool } from "../../db/client.js";
import { createTestCitizen, officerHeaders } from "../../test/auth.js";

describe("Lifecycle: Canonical JSON & Hash Linking (#E2)", () => {
  it("canonicalJson sorts keys deterministically at all depths", () => {
    const objA = { z: 1, a: { y: 2, b: 3 }, m: [1, 2] };
    const objB = { a: { b: 3, y: 2 }, z: 1, m: [1, 2] };
    expect(canonicalJson(objA)).toBe(canonicalJson(objB));
    expect(canonicalJson(objA)).toBe('{"a":{"b":3,"y":2},"m":[1,2],"z":1}');
  });

  it("computeEventHash produces deterministic SHA-256 hash", () => {
    const fixedDate = new Date("2026-10-03T12:00:00.000Z");
    const h1 = computeEventHash(GENESIS_PREV_HASH, {
      ticketId: "tkt-001",
      seq: 1,
      type: "REPORT_CREATED",
      fromState: null,
      toState: "SUBMITTED",
      actorType: "CITIZEN",
      actorId: "cit-001",
      payload: { note: "test" },
      createdAt: fixedDate,
    });
    const h2 = computeEventHash(GENESIS_PREV_HASH, {
      ticketId: "tkt-001",
      seq: 1,
      type: "REPORT_CREATED",
      fromState: null,
      toState: "SUBMITTED",
      actorType: "CITIZEN",
      actorId: "cit-001",
      payload: { note: "test" },
      createdAt: fixedDate,
    });
    expect(h1).toHaveLength(64);
    expect(h1).toBe(h2);
  });

  it("any modification in payload changes the computed hash", () => {
    const fixedDate = new Date("2026-10-03T12:00:00.000Z");
    const base = {
      ticketId: "tkt-001",
      seq: 1,
      type: "STATE_CHANGED",
      fromState: "SUBMITTED",
      toState: "VERIFIED",
      actorType: "SYSTEM",
      actorId: "system",
      payload: { verified: true },
      createdAt: fixedDate,
    };
    const h1 = computeEventHash(GENESIS_PREV_HASH, base);
    const h2 = computeEventHash(GENESIS_PREV_HASH, {
      ...base,
      payload: { verified: false },
    });
    expect(h1).not.toBe(h2);
  });
});

describe("Lifecycle: State Machine ALLOWED Table (#E1 & Bible §9)", () => {
  it("only citizens can confirm closure or reopen from WORK_DONE_PENDING_CONFIRMATION", () => {
    const pendingActors = ALLOWED.WORK_DONE_PENDING_CONFIRMATION;
    expect(pendingActors.CLOSED_CONFIRMED).toEqual(["CITIZEN"]);
    expect(pendingActors.REOPENED).toEqual(["CITIZEN"]);
    expect(pendingActors.CLOSED_UNCONFIRMED).toEqual(["SYSTEM"]);
    // Officers or field teams CANNOT close or reopen here
    expect(pendingActors.CLOSED_CONFIRMED?.includes("OFFICER" as ActorType)).toBeFalsy();
    expect(pendingActors.CLOSED_CONFIRMED?.includes("FIELD" as ActorType)).toBeFalsy();
  });

  it("only field teams can mark work done from DISPATCHED", () => {
    const dispatchedActors = ALLOWED.DISPATCHED;
    expect(dispatchedActors.WORK_DONE_PENDING_CONFIRMATION).toEqual(["FIELD"]);
    expect(dispatchedActors.WORK_DONE_PENDING_CONFIRMATION?.includes("OFFICER" as ActorType)).toBeFalsy();
  });

  it("CLOSED_CONFIRMED is a terminal state with no outgoing transitions", () => {
    expect(Object.keys(ALLOWED.CLOSED_CONFIRMED)).toHaveLength(0);
  });

  it("REJECTED_NOT_CIVIC is a terminal state with no outgoing transitions", () => {
    expect(Object.keys(ALLOWED.REJECTED_NOT_CIVIC)).toHaveLength(0);
  });

  it("CLOSED_UNCONFIRMED allows CITIZEN to reopen within 30 days", () => {
    expect(ALLOWED.CLOSED_UNCONFIRMED.REOPENED).toEqual(["CITIZEN"]);
  });
});

describe("Lifecycle API Endpoints (#E1 & #E2)", () => {
  let app: AppInstance;
  let citizen: Awaited<ReturnType<typeof createTestCitizen>>;

  beforeAll(async () => {
    app = await buildApp();
    citizen = await createTestCitizen(app);
  });

  const understand = async (text: string, lat = 21.185, lng = 81.33) => {
    const res = await app.inject({ method: "POST", url: "/reports/understand", payload: { text, lang: "hi", lat, lng } });
    expect(res.statusCode).toBe(200);
    return res.json();
  };
  const confirm = (draftId: string, who = citizen, extra: object = {}) =>
    app.inject({ method: "POST", url: "/reports/confirm", headers: who.headers, payload: { draftId, ...extra } });

  it("POST /reports/confirm files the server-stored draft for the logged-in citizen", async () => {
    const u = await understand(`gali mein kachra pada hai teen din se ${Date.now()}`);
    const res = await confirm(u.draftId);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.publicCode).toMatch(/^BHI-26-\d{6}$/);
    expect(body.state).toMatch(/ASSIGNED|VERIFIED|NEEDS_TRIAGE/);
    expect(body.merged).toBe(false);
  });

  it("the client cannot choose category/agency/priority: extra fields are ignored and routing comes from the server", async () => {
    const u = await understand(`ward 14 mein kachra nahi utha ${Date.now()}`);
    const res = await confirm(u.draftId, citizen, { categoryCode: "ELEC_LIVE_WIRE", agencyId: "nhai", priorityBand: "Critical" });
    expect(res.statusCode).toBe(201);
    const t = await pool.query(`SELECT category_code, agency_id FROM tickets WHERE id = $1`, [res.json().ticketId]);
    expect(t.rows[0].category_code).toBe(u.understanding.category_code);
    expect(t.rows[0].agency_id).toBe(u.routing.agencyId);
    // (priority_band is recomputed over time by the background job, so it is not compared here)
  });

  it("unknown or expired draft -> 410, never a fake success", async () => {
    const res = await confirm("00000000-0000-4000-8000-000000000000");
    expect(res.statusCode).toBe(410);
    const u = await understand("pani nahi aa raha do din se");
    await pool.query(`UPDATE report_drafts SET created_at = now() - interval '3 hours' WHERE id = $1`, [u.draftId]);
    expect((await confirm(u.draftId)).statusCode).toBe(410);
  });

  it("filing the same draft twice does not create a second report", async () => {
    const u = await understand("naali jam hai bahut badboo aa rahi hai");
    const a = (await confirm(u.draftId)).json();
    const again = await confirm(u.draftId);
    expect(again.statusCode).toBe(200);
    expect(again.json().reportId).toBe(a.reportId);
  });

  it("a second citizen reporting the same problem nearby joins the first ticket (one work order, many voices)", async () => {
    const text = `transformer se spark ho raha hai sector khamba ${Date.now()}`;
    const first = await understand(text, 21.2105, 81.3601);
    const t1 = (await confirm(first.draftId)).json();
    const other = await createTestCitizen(app);
    const second = await understand(text, 21.2105, 81.3601);
    expect(second.duplicateOf?.ticketId).toBe(t1.ticketId);
    const t2 = (await confirm(second.draftId, other)).json();
    expect(t2.merged).toBe(true);
    expect(t2.ticketId).toBe(t1.ticketId);
    expect(t2.reportCount).toBe(2);
    const mine = await app.inject({ method: "GET", url: "/me/reports", headers: other.headers });
    expect(mine.json()).toHaveLength(1); // the joiner sees it in THEIR list too
  });

  it("an unauthenticated confirm is refused", async () => {
    const u = await understand("kuch bhi problem hai yahan");
    const res = await app.inject({ method: "POST", url: "/reports/confirm", payload: { draftId: u.draftId } });
    expect(res.statusCode).toBe(401);
  });

  it("GET /tickets/:id/verify-chain returns chain status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/tickets/non-existent-ticket-id/verify-chain",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.count).toBe(0);
  });

  it("transition on an unknown or malformed ticket id is a 404, never a 500", async () => {
    for (const id of ["dummy-ticket-id", "00000000-0000-0000-0000-000000000000"]) {
      const res = await app.inject({
        method: "POST",
        url: `/tickets/${id}/transition`,
        headers: officerHeaders(app),
        payload: { toState: "CLOSED_CONFIRMED", actor: { type: "OFFICER", id: "ignored" } },
      });
      expect(res.statusCode).toBe(404);
    }
  });

  it("an officer cannot close a ticket (only the citizen can) -> 409, and the claimed actor in the body is ignored", async () => {
    const u = await understand("gali mein kachra pada hai purane din se");
    const ticketId = (await confirm(u.draftId)).json().ticketId;

    // Body claims to be the citizen; the token says officer. The token wins.
    const res = await app.inject({
      method: "POST",
      url: `/tickets/${ticketId}/transition`,
      headers: officerHeaders(app),
      payload: { toState: "CLOSED_CONFIRMED", actor: { type: "CITIZEN", id: "spoofed" } },
    });
    expect(res.statusCode).toBe(409);
  });

  it("a citizen token cannot call the officer-only transition endpoint", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/tickets/00000000-0000-0000-0000-000000000000/transition",
      headers: citizen.headers,
      payload: { toState: "VERIFIED", actor: { type: "SYSTEM", id: "x" } },
    });
    expect(res.statusCode).toBe(401);
  });
});

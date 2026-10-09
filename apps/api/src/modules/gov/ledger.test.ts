// CA1: a GOV actor can append a note to the ledger, but the ticket's state never changes.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { pool } from "../../db/client.js";
import type { AppInstance } from "../../types.js";
import { appendEvent } from "../lifecycle/transition.js";
import { ALLOWED } from "../lifecycle/types.js";
import { verifyEventChain } from "../lifecycle/verify.js";
import { fileTicket, moveToWorkDone, ticketState } from "../../test/govBridge.js";

let app: AppInstance;
beforeAll(async () => {
  app = await buildApp();
});
afterAll(async () => {
  await app.close();
});

describe("CA1 ledger append for GOV", () => {
  it("appends CLOSE_REQUESTED_BY_GOV, keeps the hash chain valid and does not touch the state", async () => {
    const { ticketId } = await fileTicket(app);
    await moveToWorkDone(ticketId);
    const before = await ticketState(ticketId);
    expect(before.state).toBe("WORK_DONE_PENDING_CONFIRMATION");

    const r = await appendEvent(ticketId, "CLOSE_REQUESTED_BY_GOV", { type: "GOV", id: "gov:u1" }, { note: "please check", gov_user_name: "Officer A" });
    expect(r.seq).toBe(before.last_event_seq + 1);

    const after = await ticketState(ticketId);
    expect(after.state).toBe("WORK_DONE_PENDING_CONFIRMATION");
    expect(after.escalation_level).toBe(before.escalation_level);
    expect(after.last_event_seq).toBe(r.seq);
    expect(await verifyEventChain(ticketId)).toMatchObject({ ok: true });

    const ev = await pool.query("SELECT type, actor_type, actor_id, from_state, to_state FROM events WHERE ticket_id = $1 AND seq = $2", [ticketId, r.seq]);
    expect(ev.rows[0]).toEqual({ type: "CLOSE_REQUESTED_BY_GOV", actor_type: "GOV", actor_id: "gov:u1", from_state: "WORK_DONE_PENDING_CONFIRMATION", to_state: "WORK_DONE_PENDING_CONFIRMATION" });
  });

  it("GOV is not an allowed actor for ANY state transition", () => {
    for (const [from, targets] of Object.entries(ALLOWED)) {
      for (const [to, actors] of Object.entries(targets ?? {})) {
        expect(actors as string[], `${from} -> ${to}`).not.toContain("GOV");
      }
    }
  });
});

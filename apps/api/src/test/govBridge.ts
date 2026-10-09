// Test helpers for the gov bridge: file a real ticket through the public routes, then walk it through
// LEGAL transitions (no direct SQL state writes) to the state a test needs.
import { pool } from "../db/client.js";
import { transition } from "../modules/lifecycle/transition.js";
import type { State } from "../modules/lifecycle/types.js";
import type { AppInstance } from "../types.js";
import { createTestCitizen } from "./auth.js";

export async function fileTicket(app: AppInstance, text = `streetlight is not working near the park ${Date.now()}-${Math.random()}`) {
  const citizen = await createTestCitizen(app);
  const u = await app.inject({ method: "POST", url: "/reports/understand", payload: { text, lang: "en", lat: 21.185, lng: 81.33 } });
  if (u.statusCode !== 200) throw new Error(`understand failed: ${u.statusCode} ${u.body}`);
  const c = await app.inject({ method: "POST", url: "/reports/confirm", headers: citizen.headers, payload: { draftId: u.json().draftId } });
  if (c.statusCode !== 201) throw new Error(`confirm failed: ${c.statusCode} ${c.body}`);
  const body = c.json() as { ticketId: string; publicCode: string };
  return { citizen, ticketId: body.ticketId, publicCode: body.publicCode };
}

const NEXT: Partial<Record<State, { to: State; actor: "SYSTEM" | "OFFICER" | "FIELD" }>> = {
  SUBMITTED: { to: "VERIFIED", actor: "SYSTEM" },
  NEEDS_TRIAGE: { to: "VERIFIED", actor: "OFFICER" },
  REOPENED: { to: "ASSIGNED", actor: "SYSTEM" }, // a reopened ticket goes back to the department
  VERIFIED: { to: "ASSIGNED", actor: "SYSTEM" },
  ASSIGNED: { to: "DISPATCHED", actor: "OFFICER" },
  DISPATCHED: { to: "WORK_DONE_PENDING_CONFIRMATION", actor: "FIELD" },
};

export async function moveToWorkDone(ticketId: string): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const { rows } = await pool.query<{ state: State }>("SELECT state FROM tickets WHERE id = $1", [ticketId]);
    const state = rows[0]!.state;
    if (state === "WORK_DONE_PENDING_CONFIRMATION") return;
    const step = NEXT[state];
    if (!step) throw new Error(`cannot move on from ${state}`);
    await transition(ticketId, step.to, { type: step.actor, id: `test-${step.actor.toLowerCase()}` }, { test: true });
  }
}

export const ticketState = async (ticketId: string) =>
  (await pool.query<{ state: string; last_event_seq: number; escalation_level: number }>("SELECT state, last_event_seq, escalation_level FROM tickets WHERE id = $1", [ticketId])).rows[0]!;

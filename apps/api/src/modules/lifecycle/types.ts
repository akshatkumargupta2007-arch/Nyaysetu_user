// Build map #E1 & Bible §9 — State Machine and Event Ledger types.

export type State =
  | "SUBMITTED"
  | "VERIFIED"
  | "NEEDS_TRIAGE"
  | "ASSIGNED"
  | "TRANSFERRED"
  | "DISPATCHED"
  | "WORK_DONE_PENDING_CONFIRMATION"
  | "CLOSED_CONFIRMED"
  | "CLOSED_UNCONFIRMED"
  | "REOPENED"
  | "REJECTED_NOT_CIVIC";

// GOV = an official using the separate government portal. It can append notes to the ledger but is never an
// allowed actor in the ALLOWED transition table: the portal cannot move a ticket between states.
export type ActorType = "SYSTEM" | "CITIZEN" | "OFFICER" | "FIELD" | "GOV";

export type EventType =
  | "REPORT_CREATED"
  | "TICKET_CREATED"
  | "REPORT_MERGED"
  | "REPORT_UNMERGED"
  | "STATE_CHANGED"
  | "PRIORITY_RECOMPUTED"
  | "SLA_BREACHED"
  | "ESCALATED"
  | "TRANSFER_REQUESTED"
  | "TEAM_POSITION"
  | "PROOF_REJECTED_REUSED"
  | "PROOF_ACCEPTED"
  | "CITIZEN_CONFIRMED"
  | "CITIZEN_REJECTED"
  | "CITIZEN_NOTE_ADDED"
  | "OFFICER_NOTE_ADDED"
  | "PRIORITY_OVERRIDDEN"
  | "CLOSE_REQUESTED_BY_GOV"
  | "PHONE_ERASED";

export interface Actor {
  type: ActorType;
  id: string;
}

export const GENESIS_PREV_HASH = "0".repeat(64);

/**
 * Bible §9 — Allowed state transitions and valid actors for each transition.
 * No other state transition is allowed in the system.
 */
export const ALLOWED: Record<State, Partial<Record<State, ActorType[]>>> = {
  SUBMITTED: {
    VERIFIED: ["SYSTEM", "OFFICER"],
    NEEDS_TRIAGE: ["SYSTEM"],
    REJECTED_NOT_CIVIC: ["OFFICER"],
  },
  NEEDS_TRIAGE: {
    VERIFIED: ["OFFICER"],
    REJECTED_NOT_CIVIC: ["OFFICER"],
  },
  VERIFIED: {
    ASSIGNED: ["SYSTEM", "OFFICER"],
  },
  ASSIGNED: {
    DISPATCHED: ["FIELD", "OFFICER"],
    TRANSFERRED: ["OFFICER"],
  },
  TRANSFERRED: {
    ASSIGNED: ["SYSTEM", "OFFICER"],
  },
  DISPATCHED: {
    WORK_DONE_PENDING_CONFIRMATION: ["FIELD"], // + proof gates
  },
  WORK_DONE_PENDING_CONFIRMATION: {
    CLOSED_CONFIRMED: ["CITIZEN"],
    REOPENED: ["CITIZEN"],
    CLOSED_UNCONFIRMED: ["SYSTEM"],
  },
  REOPENED: {
    ASSIGNED: ["SYSTEM"],
  },
  CLOSED_UNCONFIRMED: {
    REOPENED: ["CITIZEN"], // Citizen can still reopen within 30 days
  },
  CLOSED_CONFIRMED: {},
  REJECTED_NOT_CIVIC: {},
};

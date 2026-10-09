// Build map #E3 — Citizen stage mapping and timeline

import type { State, EventType } from "./types.js";

export type CitizenStage =
  | "RECEIVED"
  | "VERIFIED"
  | "ASSIGNED"
  | "DISPATCHED"
  | "RESOLVED_PROMPT"
  | "CLOSED";

export interface TimelineEntry {
  icon: string;
  label: { hi: string; en: string };
  actorLabel: { hi: string; en: string } | null;
  timestamp: Date;
  durationMs: number | null;
  isRed?: boolean;
}

export function mapInternalStateToCitizenStage(state: State): CitizenStage {
  switch (state) {
    case "SUBMITTED":
    case "NEEDS_TRIAGE":
      return "RECEIVED";
    case "VERIFIED":
      return "VERIFIED";
    case "ASSIGNED":
    case "TRANSFERRED":
    case "REOPENED":
      return "ASSIGNED";
    case "DISPATCHED":
      return "DISPATCHED";
    case "WORK_DONE_PENDING_CONFIRMATION":
      return "RESOLVED_PROMPT";
    case "CLOSED_CONFIRMED":
    case "CLOSED_UNCONFIRMED":
    case "REJECTED_NOT_CIVIC":
      return "CLOSED";
  }
}

export interface DbEvent {
  type: EventType | string;
  from_state: State | null;
  to_state: State | null;
  actor_type: string;
  actor_id: string;
  payload: Record<string, any>;
  created_at: string | Date;
}

export function buildCitizenTimeline(events: DbEvent[]): TimelineEntry[] {
  const timeline: TimelineEntry[] = [];
  let prevTime: number | null = null;

  for (const ev of events) {
    const ts = new Date(ev.created_at);
    const durationMs = prevTime !== null ? ts.getTime() - prevTime : null;
    prevTime = ts.getTime();

    let entry: TimelineEntry | null = null;

    if (ev.type === "REPORT_CREATED" || ev.type === "TICKET_CREATED") {
      // Often both happen sequentially. If both exist, we might only want to show one "Received", 
      // but let's handle TICKET_CREATED / first transition to SUBMITTED.
      // Wait, TICKET_CREATED is an event type, but STATE_CHANGED to SUBMITTED is better.
      // We will rely on STATE_CHANGED or specific events.
    }

    if (ev.type === "STATE_CHANGED") {
      switch (ev.to_state as State) {
        case "SUBMITTED":
          entry = {
            icon: "inbox",
            label: { hi: "मिल गई", en: "Received" },
            actorLabel: null,
            timestamp: ts,
            durationMs,
          };
          break;
        case "VERIFIED":
          entry = {
            icon: "check-circle",
            label: { hi: "जाँच हो गई", en: "Verified" },
            actorLabel: null,
            timestamp: ts,
            durationMs,
          };
          break;
        case "ASSIGNED":
          // Avoid duplicate ASSIGNED if coming from TRANSFERRED which adds its own row.
          // Wait, TRANSFERRED to ASSIGNED is automatic in ALLOWED? No, TRANSFERRED -> ASSIGNED is the flow.
          // Actually, ASSIGNED is the state. If from_state is VERIFIED or TRANSFERRED or REOPENED.
          if (ev.from_state !== "TRANSFERRED") {
            const agency = ev.payload?.agencyName || ev.payload?.agencyId || "";
            const dept = ev.payload?.departmentName || "";
            const actorHi = agency && dept ? `${agency} — ${dept}` : (agency || dept || null);
            entry = {
              icon: "briefcase",
              label: { hi: "विभाग को सौंपी", en: "Assigned" },
              actorLabel: actorHi ? { hi: actorHi, en: actorHi } : null,
              timestamp: ts,
              durationMs,
            };
          }
          break;
        case "TRANSFERRED":
          {
            const fromDept = ev.payload?.fromDepartment || "Other";
            const toDept = ev.payload?.toDepartment || "Other";
            const reason = ev.payload?.reason || "";
            entry = {
              icon: "arrow-right-left",
              label: { 
                hi: `सही विभाग को भेजी गई: ${fromDept} → ${toDept} (कारण: ${reason})`,
                en: `Sent to the right department: ${fromDept} → ${toDept} (Reason: ${reason})`
              },
              actorLabel: null,
              timestamp: ts,
              durationMs,
            };
          }
          break;
        case "DISPATCHED":
          entry = {
            icon: "truck",
            label: { hi: "टीम रवाना", en: "Team dispatched" },
            actorLabel: null,
            timestamp: ts,
            durationMs,
          };
          break;
        case "WORK_DONE_PENDING_CONFIRMATION":
          entry = {
            icon: "image",
            label: { hi: "टीम का कहना है काम हो गया", en: "Team says it's done" },
            actorLabel: null,
            timestamp: ts,
            durationMs,
          };
          break;
        case "CLOSED_CONFIRMED":
          entry = {
            icon: "check-circle-2",
            label: { hi: "ठीक हुआ (आपकी पुष्टि)", en: "Fixed (confirmed by you)" },
            actorLabel: null,
            timestamp: ts,
            durationMs,
          };
          break;
        case "CLOSED_UNCONFIRMED":
          entry = {
            icon: "check",
            label: { hi: "ठीक माना गया", en: "Marked resolved" },
            actorLabel: null,
            timestamp: ts,
            durationMs,
          };
          break;
        case "REOPENED":
          entry = {
            icon: "alert-circle",
            label: { hi: "दोबारा खोली गई (अधिकारी को भेजी गई)", en: "Reopened (Escalated)" },
            actorLabel: null,
            timestamp: ts,
            durationMs,
            isRed: true,
          };
          break;
        case "REJECTED_NOT_CIVIC":
          entry = {
            icon: "x-circle",
            label: { hi: "नगर निगम का काम नहीं (अस्वीकृत)", en: "Not a civic issue (Rejected)" },
            actorLabel: null,
            timestamp: ts,
            durationMs,
            isRed: true,
          };
          break;
      }
    } else if (ev.type === "REPORT_MERGED") {
      entry = {
        icon: "users",
        label: { hi: "एक और शिकायत जोड़ी गई", en: "Another report attached" },
        actorLabel: null,
        timestamp: ts,
        durationMs,
      };
    } else if (ev.type === "ESCALATED") {
      const level = ev.payload?.escalationLevel || "higher";
      entry = {
        icon: "trending-up",
        label: { hi: "वरिष्ठ अधिकारी को भेजी गई", en: `Escalated (Level ${level})` },
        actorLabel: null,
        timestamp: ts,
        durationMs,
        isRed: true,
      };
    }

    if (entry) {
      timeline.push(entry);
    }
  }

  return timeline;
}

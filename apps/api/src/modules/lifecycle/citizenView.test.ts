import { describe, it, expect } from "vitest";
import { mapInternalStateToCitizenStage, buildCitizenTimeline } from "./citizenView.js";
import type { DbEvent } from "./citizenView.js";

describe("Citizen Stage Mapping & Timeline (#E3)", () => {
  it("maps internal states to correct citizen stages", () => {
    expect(mapInternalStateToCitizenStage("SUBMITTED")).toBe("RECEIVED");
    expect(mapInternalStateToCitizenStage("NEEDS_TRIAGE")).toBe("RECEIVED");
    expect(mapInternalStateToCitizenStage("VERIFIED")).toBe("VERIFIED");
    expect(mapInternalStateToCitizenStage("ASSIGNED")).toBe("ASSIGNED");
    expect(mapInternalStateToCitizenStage("TRANSFERRED")).toBe("ASSIGNED");
    expect(mapInternalStateToCitizenStage("REOPENED")).toBe("ASSIGNED");
    expect(mapInternalStateToCitizenStage("DISPATCHED")).toBe("DISPATCHED");
    expect(mapInternalStateToCitizenStage("WORK_DONE_PENDING_CONFIRMATION")).toBe("RESOLVED_PROMPT");
    expect(mapInternalStateToCitizenStage("CLOSED_CONFIRMED")).toBe("CLOSED");
    expect(mapInternalStateToCitizenStage("CLOSED_UNCONFIRMED")).toBe("CLOSED");
    expect(mapInternalStateToCitizenStage("REJECTED_NOT_CIVIC")).toBe("CLOSED");
  });

  it("builds timeline entries correctly with durations", () => {
    const t0 = new Date("2026-10-01T10:00:00Z");
    const t1 = new Date("2026-10-01T10:02:00Z"); // +2 mins
    const t2 = new Date("2026-10-01T10:40:00Z"); // +38 mins
    const t3 = new Date("2026-10-01T11:00:00Z"); // +20 mins
    const t4 = new Date("2026-10-01T11:15:00Z"); // +15 mins
    const t5 = new Date("2026-10-01T12:00:00Z"); // +45 mins

    const events: DbEvent[] = [
      {
        type: "STATE_CHANGED",
        from_state: null,
        to_state: "SUBMITTED",
        actor_type: "SYSTEM",
        actor_id: "sys",
        payload: {},
        created_at: t0,
      },
      {
        type: "STATE_CHANGED",
        from_state: "SUBMITTED",
        to_state: "VERIFIED",
        actor_type: "SYSTEM",
        actor_id: "sys",
        payload: {},
        created_at: t1,
      },
      {
        type: "STATE_CHANGED",
        from_state: "VERIFIED",
        to_state: "ASSIGNED",
        actor_type: "SYSTEM",
        actor_id: "sys",
        payload: { agencyName: "Nagar Nigam", departmentName: "Vidyut" },
        created_at: t2,
      },
      {
        type: "STATE_CHANGED",
        from_state: "ASSIGNED",
        to_state: "TRANSFERRED",
        actor_type: "OFFICER",
        actor_id: "off1",
        payload: { fromDepartment: "PWD", toDepartment: "NHAI", reason: "national highway" },
        created_at: t3,
      },
      {
        type: "STATE_CHANGED",
        from_state: "TRANSFERRED",
        to_state: "ASSIGNED",
        actor_type: "SYSTEM",
        actor_id: "sys",
        payload: {}, // should be skipped since from_state is TRANSFERRED
        created_at: t3,
      },
      {
        type: "STATE_CHANGED",
        from_state: "ASSIGNED",
        to_state: "DISPATCHED",
        actor_type: "FIELD",
        actor_id: "fld1",
        payload: {},
        created_at: t4,
      },
      {
        type: "STATE_CHANGED",
        from_state: "DISPATCHED",
        to_state: "WORK_DONE_PENDING_CONFIRMATION",
        actor_type: "FIELD",
        actor_id: "fld1",
        payload: {},
        created_at: t5,
      }
    ];

    const timeline = buildCitizenTimeline(events);
    expect(timeline).toHaveLength(6); // 1 skipped
    expect(timeline[0]!.durationMs).toBeNull();
    expect(timeline[1]!.durationMs).toBe(2 * 60 * 1000);
    expect(timeline[2]!.actorLabel?.hi).toBe("Nagar Nigam — Vidyut");
    expect(timeline[3]!.label.hi).toContain("PWD → NHAI");
    expect(timeline[3]!.label.hi).toContain("national highway");
    expect(timeline[5]!.icon).toBe("image"); // WORK_DONE
  });
});

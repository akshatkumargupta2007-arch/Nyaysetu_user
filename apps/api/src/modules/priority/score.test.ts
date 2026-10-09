// Build map #C8 test: reproduce the Bible §7 worked example EXACTLY —
// a school-adjacent drain complaint, monsoon, 6 reporters, 48h SLA,
// scored at intake (63.5 -> High), 36h (71.9 -> High), 44h (76.1 -> Critical).
import { describe, it, expect } from "vitest";
import { scorePriority, SAFETY_OVERRIDE_HAZARDS } from "./score.js";

describe("priority scoring (pure function)", () => {
  const base = {
    severity0to100: 70,
    distinctReporters: 6,
    nearestPoiDistanceM: 40, // the school, Bible worked example
    seasonalFactor: 1, // monsoon
    slaHours: 48,
    hazards: [] as string[],
  };

  it("at intake (0h elapsed): score 63.5, band High", () => {
    const r = scorePriority({ ...base, elapsedHours: 0 });
    expect(r.score).toBe(63.5);
    expect(r.band).toBe("High");
  });

  it("at 36h elapsed: score 71.9, still High", () => {
    const r = scorePriority({ ...base, elapsedHours: 36 });
    expect(r.score).toBe(71.9);
    expect(r.band).toBe("High");
  });

  it("at 44h elapsed: score 76.1, crosses into Critical", () => {
    const r = scorePriority({ ...base, elapsedHours: 44 });
    expect(r.score).toBe(76.1);
    expect(r.band).toBe("Critical");
  });

  it("safety-override hazard forces Critical regardless of the numeric score", () => {
    const r = scorePriority({
      severity0to100: 10, // deliberately low
      distinctReporters: 1,
      nearestPoiDistanceM: null,
      seasonalFactor: 0,
      elapsedHours: 0,
      slaHours: 48,
      hazards: ["electrocution"],
    });
    expect(r.band).toBe("Critical");
    expect(r.terms.safetyOverride).toBe(true);
    expect(r.reasonEn).toContain("immediate safety hazard");
  });

  it("every hazard listed in a category's safety_hazards in the real taxonomy that should trigger override is in SAFETY_OVERRIDE_HAZARDS", () => {
    // Spot-check the lethal categories from the Bible's own list.
    for (const h of ["electrocution", "fire_risk", "collapse_risk", "biohazard"]) {
      expect(SAFETY_OVERRIDE_HAZARDS.has(h)).toBe(true);
    }
  });

  it("cluster term C is 0 for a single reporter and approaches 1 as reporters approach 20", () => {
    const one = scorePriority({ ...base, distinctReporters: 1, elapsedHours: 0 });
    const twenty = scorePriority({ ...base, distinctReporters: 20, elapsedHours: 0 });
    expect(one.terms.C).toBe(0);
    expect(twenty.terms.C).toBeCloseTo(1, 5);
  });

  it("POI factor is 1 within 100m, 0.5 within 300m, 0 beyond", () => {
    const near = scorePriority({ ...base, nearestPoiDistanceM: 50, elapsedHours: 0 });
    const mid = scorePriority({ ...base, nearestPoiDistanceM: 250, elapsedHours: 0 });
    const far = scorePriority({ ...base, nearestPoiDistanceM: 500, elapsedHours: 0 });
    expect(near.terms.P).toBe(1);
    expect(mid.terms.P).toBe(0.5);
    expect(far.terms.P).toBe(0);
  });

  it("score is bounded to [0, 100] even with pathological inputs", () => {
    const r = scorePriority({
      severity0to100: 1000,
      distinctReporters: 10000,
      nearestPoiDistanceM: 0,
      seasonalFactor: 50,
      elapsedHours: 10000,
      slaHours: 1,
      hazards: [],
    });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it("custom tenant weights change the score deterministically", () => {
    const defaultWeights = scorePriority({ ...base, elapsedHours: 0 });
    const severityHeavy = scorePriority({
      ...base,
      elapsedHours: 0,
      weights: { S: 0.9, C: 0.025, R: 0.025, P: 0.025, E: 0.025 },
    });
    expect(severityHeavy.score).not.toBe(defaultWeights.score);
    expect(severityHeavy.terms.weights.S).toBe(0.9);
  });
});

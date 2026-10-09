import { describe, it, expect } from "vitest";
import { solarElevation, isDark, isDaylight } from "./sun.js";
import { computeVerdict, mergeCriterion, type Merged, type Status } from "./verdict.js";
import { contractHash, contractSchema, templateContract, validateContractMeaning } from "./contract.js";
import { familyOf, templateCriteria } from "./catalogue.js";

describe("sun position (gate G5)", () => {
  const bhilai = { lat: 21.21, lng: 81.38 };
  it("noon in Bhilai is daylight, the middle of the night is dark", () => {
    const noon = new Date("2026-10-09T06:30:00Z"); // 12:00 IST
    const night = new Date("2026-10-09T17:30:00Z"); // 23:00 IST
    expect(solarElevation(noon, bhilai.lat, bhilai.lng)).toBeGreaterThan(50);
    expect(isDaylight(noon, bhilai.lat, bhilai.lng)).toBe(true);
    expect(isDark(night, bhilai.lat, bhilai.lng)).toBe(true);
    expect(solarElevation(night, bhilai.lat, bhilai.lng)).toBeLessThan(-30);
  });
  it("dusk is neither daylight nor dark enough", () => {
    const dusk = new Date("2026-10-09T12:35:00Z"); // 18:05 IST, sunset about 17:35 IST
    expect(isDaylight(dusk, bhilai.lat, bhilai.lng)).toBe(false);
    expect(isDark(dusk, bhilai.lat, bhilai.lng)).toBe(false);
  });
  it("sunrise and sunset fall at the right hour (Bhilai, 9 Oct 2026: sunrise about 06:00 IST, sunset about 17:40 IST)", () => {
    const at = (h: number, m: number) => new Date(Date.UTC(2026, 9, 9, h, m) - 5.5 * 3600_000); // IST clock time
    expect(solarElevation(at(5, 30), bhilai.lat, bhilai.lng)).toBeLessThan(0);
    expect(solarElevation(at(6, 30), bhilai.lat, bhilai.lng)).toBeGreaterThan(0);
    expect(solarElevation(at(17, 15), bhilai.lat, bhilai.lng)).toBeGreaterThan(0);
    expect(solarElevation(at(18, 15), bhilai.lat, bhilai.lng)).toBeLessThan(0);
  });
});

describe("merge and verdict rules (pure code)", () => {
  const S: Status[] = ["supported", "partially_supported", "not_demonstrated", "contradicted"];
  it("merges every pair of opinions as documented", () => {
    for (const a of S) for (const b of S) {
      const m = mergeCriterion(a, b);
      if (a === "supported" && b === "supported") expect(m).toBe("supported");
      else if (a === "contradicted" || b === "contradicted") expect(m).toBe("contradicted");
      else if (a !== b) expect(m).toBe("contested");
      else expect(m).toBe(a);
    }
    expect(mergeCriterion(undefined, "supported")).toBe("unavailable");
    expect(mergeCriterion("supported", undefined)).toBe("unavailable");
  });
  it("a hard gate failure is always REJECTED, whatever else is true", () => {
    expect(computeVerdict({ hardGateFailed: true, merged: ["supported", "supported"] }).verdict).toBe("REJECTED");
  });
  it("EVIDENCE_PASSED needs every criterion supported on both opinions and no gate failure", () => {
    const all: Merged[] = ["supported", "partially_supported", "not_demonstrated", "contradicted", "contested", "unavailable"];
    for (const a of all) for (const b of all) for (const hard of [false, true]) for (const block of [false, true]) {
      const v = computeVerdict({ hardGateFailed: hard, blockedForReview: block, merged: [a, b] }).verdict;
      const expectPass = !hard && !block && a === "supported" && b === "supported";
      expect(v === "EVIDENCE_PASSED").toBe(expectPass);
    }
  });
  it("orders the outcomes: failed beats contested beats needs-more", () => {
    expect(computeVerdict({ hardGateFailed: false, merged: ["contradicted", "contested"] }).verdict).toBe("FAILED");
    expect(computeVerdict({ hardGateFailed: false, merged: ["contested", "not_demonstrated"] }).verdict).toBe("NEEDS_HUMAN_REVIEW");
    expect(computeVerdict({ hardGateFailed: false, merged: ["supported", "not_demonstrated"] }).verdict).toBe("NEEDS_MORE_EVIDENCE");
    expect(computeVerdict({ hardGateFailed: false, merged: ["supported", "unavailable"] }).verdict).toBe("NEEDS_HUMAN_REVIEW");
    expect(computeVerdict({ hardGateFailed: false, merged: [] }).verdict).toBe("NEEDS_HUMAN_REVIEW");
    expect(computeVerdict({ hardGateFailed: false, blockedForReview: true, merged: ["supported"] }).verdict).toBe("NEEDS_HUMAN_REVIEW");
  });
});

describe("proof contract catalogue and validation", () => {
  it("maps categories to families", () => {
    expect(familyOf("LIGHT_AREA_DARK")).toBe("light");
    expect(familyOf("DRAIN_BLOCKED")).toBe("drain");
    expect(familyOf("ROAD_WATERLOGGING")).toBe("drain");
    expect(familyOf("ROAD_POTHOLE")).toBe("road");
    expect(familyOf("PARK_UNKEMPT")).toBe("generic");
  });
  it("every family's template is a valid contract that passes the meaning checks", () => {
    for (const code of ["ROAD_POTHOLE", "DRAIN_BLOCKED", "LIGHT_AREA_DARK", "PARK_UNKEMPT"]) {
      const c = templateContract("00000000-0000-4000-8000-000000000001", code, "");
      const d = contractSchema.parse({ claim: c.claim, criteria: c.criteria, falsifier: c.falsifier });
      expect(() => validateContractMeaning(d, familyOf(code), "the drain is blocked and the street floods")).not.toThrow();
    }
  });
  const base = () => { const c = templateContract("00000000-0000-4000-8000-000000000001", "DRAIN_BLOCKED", ""); return { claim: c.claim, criteria: c.criteria.map((x) => ({ ...x })), falsifier: c.falsifier }; };
  it("rejects invented criterion types, bad counts and missing outcome", () => {
    const bad = base(); (bad.criteria[1] as { type: string }).type = "vibes";
    expect(() => contractSchema.parse(bad)).toThrow();
    expect(() => contractSchema.parse({ ...base(), criteria: base().criteria.slice(0, 1) })).toThrow();
    const noOutcome = contractSchema.parse({ ...base(), criteria: base().criteria.filter((c) => c.type !== "outcome") });
    expect(() => validateContractMeaning(noOutcome, "drain", "paani sadak par bhar raha hai")).toThrow(/consequence/);
    const wrongFamily = contractSchema.parse(base());
    expect(() => validateContractMeaning(wrongFamily, "light", "the streetlight is dead")).toThrow();
  });
  it("a streetlight contract must require darkness", () => {
    const c = templateCriteria("light").map((x) => ({ ...x, needs_darkness: false }));
    const d = contractSchema.parse({ claim: "The light works at night", criteria: c, falsifier: "A dark lane after repair" });
    expect(() => validateContractMeaning(d, "light", "streetlight not working")).toThrow(/darkness/);
  });
  it("the hash is stable and changes when anything changes", () => {
    const a = templateContract("00000000-0000-4000-8000-000000000001", "LIGHT_AREA_DARK", "x");
    expect(contractHash(a)).toBe(contractHash(JSON.parse(JSON.stringify(a))));
    const b = JSON.parse(JSON.stringify(a)); b.criteria[1].requirement += "!";
    expect(contractHash(b)).not.toBe(contractHash(a));
  });
});

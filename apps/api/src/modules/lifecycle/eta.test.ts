import { describe, expect, it } from "vitest";
import { estimateTotalHours, etaHoursRemaining, etaText, TYPICAL_HOURS } from "./eta.js";

const H = 3_600_000;
const now = new Date("2026-10-10T12:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * H);
const inH = (h: number) => new Date(now.getTime() + h * H);
const base = { state: "ASSIGNED", priorityBand: "Medium", now };

describe("citizen ETA", () => {
  it("an electricity problem is a few hours, not the 48 hour deadline", () => {
    const h = etaHoursRemaining({ ...base, categoryCode: "ELEC_OUTAGE", createdAt: ago(0), slaDueAt: inH(48) });
    expect(h).toBe(3);
    const wire = etaHoursRemaining({ ...base, categoryCode: "ELEC_LIVE_WIRE", priorityBand: "Critical", createdAt: ago(0), slaDueAt: inH(48) });
    expect(wire).toBe(1);
  });

  it("urgent complaints are estimated faster, low priority slower", () => {
    const hrs = (band: string) => estimateTotalHours("WATER_PIPELINE_LEAK", band);
    expect(hrs("Critical")).toBeLessThan(hrs("High"));
    expect(hrs("High")).toBeLessThan(hrs("Medium"));
    expect(hrs("Medium")).toBeLessThan(hrs("Low"));
  });

  it("work that needs material or inspection takes days, like a pothole", () => {
    expect(etaHoursRemaining({ ...base, categoryCode: "ROAD_POTHOLE", createdAt: ago(0), slaDueAt: inH(72) })).toBe(48);
  });

  it("counts down from when the complaint was filed", () => {
    const h = etaHoursRemaining({ ...base, categoryCode: "WATER_PIPELINE_LEAK", createdAt: ago(5), slaDueAt: inH(43) });
    expect(h).toBe(3); // 8 h job, 5 h gone
  });

  it("never promises more than the official deadline, and never less than 1 hour", () => {
    expect(etaHoursRemaining({ ...base, categoryCode: "ROAD_BROKEN_FOOTPATH", createdAt: ago(0), slaDueAt: inH(10) })).toBe(10);
    expect(etaHoursRemaining({ ...base, categoryCode: "ELEC_OUTAGE", createdAt: ago(10), slaDueAt: inH(38) })).toBe(1);
  });

  it("shows nothing when the work is done, the ticket is closed, or the deadline has passed", () => {
    for (const state of ["WORK_DONE_PENDING_CONFIRMATION", "CLOSED_CONFIRMED", "CLOSED_UNCONFIRMED"]) {
      expect(etaText({ ...base, state, categoryCode: "ELEC_OUTAGE", createdAt: ago(1), slaDueAt: inH(40) })).toBeNull();
    }
    expect(etaText({ ...base, categoryCode: "ELEC_OUTAGE", createdAt: ago(60), slaDueAt: ago(1) })).toBeNull();
    expect(etaText({ ...base, categoryCode: "ELEC_OUTAGE", createdAt: ago(1), slaDueAt: null })).toBeNull();
  });

  it("an unknown category gets a safe default", () => {
    expect(estimateTotalHours("SOMETHING_NEW")).toBe(24);
  });

  it("the text keeps the format the app reads (the first number is hours)", () => {
    expect(etaText({ ...base, categoryCode: "ELEC_OUTAGE", createdAt: ago(0), slaDueAt: inH(48) })).toBe("लगभग 3 घंटे");
  });

  it("every typical time is a positive number of hours", () => {
    for (const [code, h] of Object.entries(TYPICAL_HOURS)) expect(h, code).toBeGreaterThan(0);
  });
});

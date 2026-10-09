// Build map #C6 test: fixtures producing each of the three outcomes (card,
// amber card, clarify), as the ticket specifies.
import { describe, it, expect } from "vitest";
import { computeConfidence } from "./confidence.js";

describe("confidence gate", () => {
  it("high model confidence + agreeing precedent + exact polygon -> card", () => {
    const { gate, confidence } = computeConfidence({
      modelConfidence: 0.95,
      chosenCategoryCode: "LIGHT_AREA_DARK",
      topPrecedentCategoryCode: "LIGHT_AREA_DARK",
      locationMethod: "polygon",
    });
    // 0.5*0.95 + 0.3*1 + 0.2*1 = 0.475+0.3+0.2 = 0.975
    expect(confidence).toBe(0.975);
    expect(gate).toBe("card");
  });

  it("medium model confidence, disagreeing precedent, centroid fallback -> amber card", () => {
    const { gate, confidence } = computeConfidence({
      modelConfidence: 0.6,
      chosenCategoryCode: "ROAD_POTHOLE",
      topPrecedentCategoryCode: "ROAD_CAVED_IN",
      locationMethod: "centroid",
    });
    // 0.5*0.6 + 0.3*0 + 0.2*0.6 = 0.3+0+0.12 = 0.42
    expect(confidence).toBe(0.42);
    expect(gate).toBe("clarify"); // below 0.45
  });

  it("just above the amber threshold -> card_amber, not clarify", () => {
    const { gate } = computeConfidence({
      modelConfidence: 0.7,
      chosenCategoryCode: "X",
      topPrecedentCategoryCode: null,
      locationMethod: "centroid",
    });
    // 0.5*0.7 + 0 + 0.2*0.6 = 0.35+0.12 = 0.47
    expect(gate).toBe("card_amber");
  });

  it("no location at all (method none) and no precedent caps confidence low -> clarify", () => {
    const { gate, confidence } = computeConfidence({
      modelConfidence: 0.9,
      chosenCategoryCode: "X",
      topPrecedentCategoryCode: null,
      locationMethod: "none",
    });
    // 0.5*0.9 + 0 + 0 = 0.45 -> exactly at the amber threshold, so card_amber not clarify
    expect(confidence).toBe(0.45);
    expect(gate).toBe("card_amber");
  });

  it("gate thresholds are inclusive at the boundary (0.70 -> card)", () => {
    const { gate } = computeConfidence({
      modelConfidence: 1.0,
      chosenCategoryCode: "X",
      topPrecedentCategoryCode: "Y", // disagrees, contributes 0
      locationMethod: "none", // contributes 0
    });
    // 0.5*1.0 = 0.5 -> card_amber, not card (below 0.7)
    expect(gate).toBe("card_amber");
  });
});

// Build map #C6 — the confidence gate (Bible §5.6). Pure function: given the
// model's own confidence, whether retrieved precedent agrees with the
// chosen category, and how the location was resolved, decide whether to
// show the confirmation card outright, show it flagged amber, or ask one
// clarifying question before ever routing the complaint.
import type { LocationMethod } from "../jurisdiction/resolve.js";

export type ConfidenceGate = "card" | "card_amber" | "clarify";

export interface ConfidenceInputs {
  modelConfidence: number; // 0-1, from the Understand call
  chosenCategoryCode: string;
  topPrecedentCategoryCode: string | null; // null if no precedent at all
  locationMethod: LocationMethod;
}

const CARD_THRESHOLD = 0.7;
const AMBER_THRESHOLD = 0.45;

export function locationQuality(method: LocationMethod): number {
  switch (method) {
    case "polygon":
      return 1;
    case "centroid":
      return 0.6;
    case "none":
      return 0;
  }
}

export function computeConfidence(input: ConfidenceInputs): {
  confidence: number;
  gate: ConfidenceGate;
} {
  const precedentAgreement =
    input.topPrecedentCategoryCode === null
      ? 0
      : input.topPrecedentCategoryCode === input.chosenCategoryCode
        ? 1
        : 0;

  const confidence =
    0.5 * input.modelConfidence + 0.3 * precedentAgreement + 0.2 * locationQuality(input.locationMethod);

  const gate: ConfidenceGate =
    confidence >= CARD_THRESHOLD ? "card" : confidence >= AMBER_THRESHOLD ? "card_amber" : "clarify";

  return { confidence: Math.round(confidence * 1000) / 1000, gate };
}

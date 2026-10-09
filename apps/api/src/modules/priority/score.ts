// Build map #C8 — priority scoring. A pure function (Bible §7): anyone can
// recompute it by hand from the stored terms and argue with it. The weights
// are policy, not ML, and are read from tenant config (falling back to the
// Bible's defaults) rather than hardcoded.

export interface PriorityWeights {
  S: number;
  C: number;
  R: number;
  P: number;
  E: number;
}

export const DEFAULT_WEIGHTS: PriorityWeights = { S: 0.45, C: 0.2, R: 0.15, P: 0.1, E: 0.1 };

// Hazards that force Critical regardless of the numeric score — lethal or
// near-lethal categories where "wait for the formula" is the wrong answer.
export const SAFETY_OVERRIDE_HAZARDS = new Set([
  "electrocution",
  "fire_risk",
  "collapse_risk",
  "biohazard",
  "disease_risk",
]);

export interface PriorityInputs {
  severity0to100: number;
  distinctReporters: number;
  elapsedHours: number;
  slaHours: number;
  /** Distance in metres to the nearest sensitive POI (school/hospital/bus stand), or null if none within range. */
  nearestPoiDistanceM: number | null;
  /** The category's seasonal multiplier for right now (0 if not in season). */
  seasonalFactor: number;
  hazards: string[];
  weights?: PriorityWeights;
}

export interface PriorityResult {
  score: number;
  band: "Critical" | "High" | "Medium" | "Low";
  terms: {
    S: number;
    C: number;
    R: number;
    P: number;
    E: number;
    weights: PriorityWeights;
    safetyOverride: boolean;
  };
  reasonEn: string;
  reasonHi: string;
}

function bandFor(score: number): PriorityResult["band"] {
  if (score >= 75) return "Critical";
  if (score >= 55) return "High";
  if (score >= 30) return "Medium";
  return "Low";
}

export function scorePriority(input: PriorityInputs): PriorityResult {
  const weights = input.weights ?? DEFAULT_WEIGHTS;

  const S = clamp01(input.severity0to100 / 100);
  const C =
    input.distinctReporters <= 1
      ? 0
      : clamp01(Math.log(input.distinctReporters) / Math.log(20));
  const R = clamp01(Math.pow(input.elapsedHours / input.slaHours, 2));
  const P = poiFactor(input.nearestPoiDistanceM);
  const E = clamp01(input.seasonalFactor);

  const score = round1(100 * (weights.S * S + weights.C * C + weights.R * R + weights.P * P + weights.E * E));

  const safetyOverride = input.hazards.some((h) => SAFETY_OVERRIDE_HAZARDS.has(h));
  const band = safetyOverride ? "Critical" : bandFor(score);

  const { reasonEn, reasonHi } = buildReason({ S, C, R, P, E, input, safetyOverride, band });

  return {
    score,
    band,
    terms: { S, C, R, P, E, weights, safetyOverride },
    reasonEn,
    reasonHi,
  };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function poiFactor(distanceM: number | null): number {
  if (distanceM === null) return 0;
  if (distanceM <= 100) return 1;
  if (distanceM <= 300) return 0.5;
  return 0;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function buildReason(params: {
  S: number;
  C: number;
  R: number;
  P: number;
  E: number;
  input: PriorityInputs;
  safetyOverride: boolean;
  band: PriorityResult["band"];
}): { reasonEn: string; reasonHi: string } {
  const { input, safetyOverride, band } = params;

  if (safetyOverride) {
    return {
      reasonEn: `Critical priority: an immediate safety hazard was detected (${input.hazards.join(", ")}).`,
      reasonHi: `अति आवश्यक प्राथमिकता: तुरंत सुरक्षा खतरा पाया गया (${input.hazards.join(", ")})।`,
    };
  }

  const parts: string[] = [];
  const partsHi: string[] = [];
  if (input.severity0to100 >= 50) {
    parts.push(`visual/textual severity ${input.severity0to100}`);
    partsHi.push(`गंभीरता ${input.severity0to100}`);
  }
  if (input.distinctReporters > 1) {
    parts.push(`${input.distinctReporters} citizens reported it`);
    partsHi.push(`${input.distinctReporters} लोगों ने रिपोर्ट किया`);
  }
  if (input.nearestPoiDistanceM !== null && input.nearestPoiDistanceM <= 300) {
    parts.push(`${Math.round(input.nearestPoiDistanceM)}m from a sensitive location`);
    partsHi.push(`एक संवेदनशील स्थान से ${Math.round(input.nearestPoiDistanceM)} मीटर दूर`);
  }
  if (input.seasonalFactor > 0) {
    parts.push("heightened seasonal risk");
    partsHi.push("मौसमी जोखिम बढ़ा हुआ");
  }
  if (input.elapsedHours >= input.slaHours * 0.7) {
    parts.push("approaching its SLA deadline");
    partsHi.push("तय समय सीमा के करीब");
  }

  const reasonEn =
    parts.length > 0
      ? `${band} priority (score ${roundDisplay(params)}): ${parts.join(", ")}.`
      : `${band} priority (score ${roundDisplay(params)}): no elevated risk factors detected.`;
  const reasonHi =
    partsHi.length > 0
      ? `${band === "High" ? "उच्च" : band === "Medium" ? "मध्यम" : "कम"} प्राथमिकता: ${partsHi.join(", ")}।`
      : `${band === "High" ? "उच्च" : band === "Medium" ? "मध्यम" : "कम"} प्राथमिकता: कोई बड़ा जोखिम नहीं मिला।`;

  return { reasonEn, reasonHi };
}

function roundDisplay(params: { S: number; C: number; R: number; P: number; E: number; input: PriorityInputs }): number {
  const w = params.input.weights ?? DEFAULT_WEIGHTS;
  return round1(100 * (w.S * params.S + w.C * params.C + w.R * params.R + w.P * params.P + w.E * params.E));
}

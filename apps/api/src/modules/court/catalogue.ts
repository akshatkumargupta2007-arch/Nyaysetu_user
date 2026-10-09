// Closure Court: what a proof contract may contain. Gemini chooses and parameterises criteria from THIS catalogue; it
// cannot invent a criterion type or an evidence kind. Everything here is plain data owned by our code.
export const CRITERION_TYPES = ["identity", "hazard_removed", "outcome", "operation", "permanence_hint"] as const;
export type CriterionType = (typeof CRITERION_TYPES)[number];

export const EVIDENCE_KINDS = [
  "wide_photo_with_landmark", "closeup_of_fix", "street_condition_photo", "night_photo", "night_video", "before_after_pair",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const INSUFFICIENT_KINDS = [
  "closeup_without_surroundings", "daylight_photo", "bulb_visible_but_road_dark", "clean_drain_but_street_flooded",
  "patched_edges_but_hole_remains", "unrelated_scene", "blurry_or_dark_image",
] as const;
export type InsufficientKind = (typeof INSUFFICIENT_KINDS)[number];

export type Family = "road" | "drain" | "light" | "generic";

/** Which family a category code belongs to (the codes come from the tenant taxonomy). */
export function familyOf(categoryCode: string): Family {
  if (/^LIGHT_|^ELEC_OUTAGE/.test(categoryCode)) return "light";
  if (/^DRAIN_|WATERLOGGING|^SEWER/.test(categoryCode)) return "drain";
  if (/^ROAD_/.test(categoryCode)) return "road";
  return "generic";
}

export const ALLOWED_TYPES: Record<Family, CriterionType[]> = {
  road: ["identity", "hazard_removed", "outcome", "permanence_hint"],
  drain: ["identity", "hazard_removed", "outcome", "permanence_hint"],
  light: ["identity", "operation", "outcome"],
  generic: ["identity", "hazard_removed", "outcome", "permanence_hint"],
};

export interface Criterion {
  id: string;
  type: CriterionType;
  requirement: string;
  required_evidence: EvidenceKind[];
  insufficient_if: InsufficientKind[];
  needs_darkness?: boolean;
}
export interface Contract {
  contract_version: number;
  ticket_id: string;
  category: string;
  claim: string;
  criteria: Criterion[];
  falsifier: string;
}

const identity = (what: string): Criterion => ({
  id: "c1", type: "identity", requirement: `The evidence shows ${what} at the place that was reported`,
  required_evidence: ["wide_photo_with_landmark"], insufficient_if: ["closeup_without_surroundings", "unrelated_scene"],
});

/** The category templates: used when Gemini is late or unavailable, and as the validation baseline. */
export function templateCriteria(family: Family): Criterion[] {
  switch (family) {
    case "road":
      return [
        identity("the reported spot on the road"),
        { id: "c2", type: "hazard_removed", requirement: "The reported hole or damage is gone from the road surface", required_evidence: ["closeup_of_fix"], insufficient_if: ["patched_edges_but_hole_remains", "blurry_or_dark_image"] },
        { id: "c3", type: "outcome", requirement: "The road at the reported spot is level and usable", required_evidence: ["street_condition_photo"], insufficient_if: ["closeup_without_surroundings"] },
      ];
    case "drain":
      return [
        identity("the reported drain or street"),
        { id: "c2", type: "hazard_removed", requirement: "The reported blockage is removed and the drain is clear", required_evidence: ["closeup_of_fix"], insufficient_if: ["blurry_or_dark_image"] },
        { id: "c3", type: "outcome", requirement: "The street is no longer waterlogged at the reported place", required_evidence: ["street_condition_photo"], insufficient_if: ["clean_drain_but_street_flooded", "closeup_without_surroundings"] },
      ];
    case "light":
      return [
        identity("the reported streetlight on the reported lane"),
        { id: "c2", type: "operation", requirement: "The light is on and lights the road after dark", required_evidence: ["night_photo", "night_video"], insufficient_if: ["daylight_photo", "bulb_visible_but_road_dark", "blurry_or_dark_image"], needs_darkness: true },
      ];
    default:
      return [
        identity("the reported problem"),
        { id: "c2", type: "hazard_removed", requirement: "The reported problem is no longer visible", required_evidence: ["closeup_of_fix"], insufficient_if: ["blurry_or_dark_image"] },
        { id: "c3", type: "outcome", requirement: "The situation the citizen complained about has improved", required_evidence: ["street_condition_photo"], insufficient_if: ["closeup_without_surroundings"] },
      ];
  }
}

export const defaultClaim = (family: Family, text: string): string =>
  ({ road: "A road defect at the reported spot is repaired", drain: "A blocked drain at the reported place is cleared and the street no longer floods", light: "The streetlight on the reported lane lights the road at night", generic: "The reported civic problem is resolved" })[family] +
  (text ? ` (citizen's words: "${text.slice(0, 140)}")` : "");

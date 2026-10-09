// Layer 2 merge and Layer 3 verdict: PURE CODE. The model produces per-criterion opinions; this file, and only this
// file, turns them into a verdict. Nothing here can close a complaint.
export type Status = "supported" | "partially_supported" | "not_demonstrated" | "contradicted";
export type Merged = "supported" | "partially_supported" | "not_demonstrated" | "contradicted" | "contested" | "unavailable";
export type Verdict = "REJECTED" | "FAILED" | "NEEDS_HUMAN_REVIEW" | "NEEDS_MORE_EVIDENCE" | "EVIDENCE_PASSED";

/** Two independent opinions about one criterion become one status. A missing opinion is "unavailable". */
export function mergeCriterion(a: Status | undefined, b: Status | undefined): Merged {
  if (!a || !b) return "unavailable";
  if (a === "supported" && b === "supported") return "supported";
  if (a === "contradicted" || b === "contradicted") return "contradicted";
  if (a !== b) return "contested";
  return a; // both not_demonstrated, or both partially_supported
}

export interface VerdictInput { hardGateFailed: boolean; blockedForReview?: boolean; merged: Merged[] }
export interface VerdictOutput { verdict: Verdict; rule: string }

export function computeVerdict(i: VerdictInput): VerdictOutput {
  if (i.hardGateFailed) return { verdict: "REJECTED", rule: "A hard gate failed (reused, wrong time of day, or similar): rejected before any AI reasoning" };
  if (i.blockedForReview) return { verdict: "NEEDS_HUMAN_REVIEW", rule: "The image contains instructions aimed at a reader or an AI: a person must look" };
  if (!i.merged.length || i.merged.some((m) => m === "unavailable")) return { verdict: "NEEDS_HUMAN_REVIEW", rule: "Two independent AI opinions were not both available: a single opinion never passes" };
  if (i.merged.some((m) => m === "contradicted")) return { verdict: "FAILED", rule: "At least one criterion is contradicted: the reported problem appears to remain" };
  if (i.merged.some((m) => m === "contested")) return { verdict: "NEEDS_HUMAN_REVIEW", rule: "The two AI opinions disagree on at least one criterion" };
  if (i.merged.some((m) => m === "not_demonstrated" || m === "partially_supported")) return { verdict: "NEEDS_MORE_EVIDENCE", rule: "At least one criterion is not yet demonstrated by the evidence" };
  return { verdict: "EVIDENCE_PASSED", rule: "Every criterion is supported by both opinions and no gate failed. This does not close the complaint: the citizen decides" };
}

export const VERDICT_EVENT: Record<Verdict, string> = {
  REJECTED: "PROOF_REJECTED_REUSED",
  FAILED: "PROOF_FAILED",
  NEEDS_HUMAN_REVIEW: "PROOF_CONTESTED",
  NEEDS_MORE_EVIDENCE: "PROOF_NEEDS_MORE",
  EVIDENCE_PASSED: "PROOF_PASSED",
};

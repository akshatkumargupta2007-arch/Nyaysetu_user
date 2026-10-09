// Build map #C11 — the eval baseline: a faithful port of the ORIGINAL
// NyaySetu prototype's backend/ai/analyzer.js (legacy/ in this repo), kept
// alive only so `npm run eval` can print "Keywords: X%. Our engine: Y%."
// with a real number behind it. It is not used anywhere in the live app.
//
// It only ever recognised 4 categories (English keywords only), which is
// the whole point: this is what the product used to do.

export type BaselineL1 = "WATER_SUPPLY" | "ROADS_FOOTPATHS" | "ELECTRICITY" | "SOLID_WASTE" | null;

export function analyzeComplaintBaseline(text: string): { l1: BaselineL1; priority: string } {
  const complaint = text.toLowerCase();
  let l1: BaselineL1 = null;

  if (
    complaint.includes("water") ||
    complaint.includes("pipe") ||
    complaint.includes("tap") ||
    complaint.includes("supply")
  ) {
    l1 = "WATER_SUPPLY";
  } else if (
    complaint.includes("road") ||
    complaint.includes("pothole") ||
    complaint.includes("street")
  ) {
    l1 = "ROADS_FOOTPATHS";
  } else if (
    complaint.includes("electricity") ||
    complaint.includes("power") ||
    complaint.includes("transformer")
  ) {
    l1 = "ELECTRICITY";
  } else if (
    complaint.includes("garbage") ||
    complaint.includes("waste") ||
    complaint.includes("clean")
  ) {
    l1 = "SOLID_WASTE";
  }

  let priority = "Medium";
  if (
    complaint.includes("emergency") ||
    complaint.includes("danger") ||
    complaint.includes("accident") ||
    complaint.includes("fire") ||
    complaint.includes("life threatening")
  ) {
    priority = "Critical";
  } else if (
    complaint.includes("urgent") ||
    complaint.includes("days") ||
    complaint.includes("weeks") ||
    complaint.includes("unsafe")
  ) {
    priority = "High";
  } else if (complaint.includes("minor") || complaint.includes("small")) {
    priority = "Low";
  }

  return { l1, priority };
}

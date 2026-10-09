// Build map #C10 — the /reports/understand orchestrator. Wires together
// every CORE module built so far into the pipeline from Bible §3:
//
//   jurisdiction ‖ embed -> retrieve -> understand -> route ‖ dedup
//   -> priority -> confidence -> card
//
// This function does NOT write to the database — it produces a draft the
// citizen confirms ("Looks right") before anything is committed (Bible
// §2.2's "What we understood" card is a preview, not a submission). That
// commit step (creating the report/ticket rows) is Phase E's lifecycle
// state machine, not this ticket.
import { randomUUID } from "node:crypto";
import { embedText } from "../../lib/gemini.js";
import { pool } from "../../db/client.js";
import { resolveJurisdiction } from "../jurisdiction/resolve.js";
import { retrieveKnowledge, retrievePrecedent } from "./retrieve.js";
import { understand, type Understanding } from "./understand.js";
import { speak } from "../voice/tts.js";
import { routeComplaint, type RoutingResult } from "../routing/route.js";
import { findDuplicateTicket, type DedupCandidate } from "../dedup/find.js";
import { scorePriority, type PriorityResult } from "../priority/score.js";
import { computeConfidence, type ConfidenceGate } from "./confidence.js";

export interface UnderstandRequest {
  text: string;
  lang: string;
  lat: number;
  lng: number;
  /** "voice" when the text came from speech-to-text, otherwise "text". */
  inputMode?: "voice" | "text";
  photoBase64?: { mimeType: string; dataBase64: string };
}

export interface UnderstandResponse {
  draftId: string;
  gate: ConfidenceGate;
  confidence: number;
  understanding: Understanding;
  routing: RoutingResult;
  priority: PriorityResult;
  duplicateOf: DedupCandidate | null;
  tenantId: string | null;
  boundaryId: string | null;
  ttsUrl: string | null;
  timings: Record<string, number>;
}

interface CategoryRow {
  names: { hi: string; en: string };
  default_severity: number;
  dedup_radius_m: number;
  dedup_window_h: number;
  seasonal: Record<string, number>;
}

async function getCategory(code: string): Promise<CategoryRow | null> {
  const res = await pool.query<CategoryRow>(
    `SELECT names, default_severity, dedup_radius_m, dedup_window_h, seasonal FROM categories WHERE code = $1`,
    [code],
  );
  return res.rows[0] ?? null;
}

function currentSeasonalFactor(seasonal: Record<string, number>): number {
  // A real seasonal calendar (monsoon months, heatwave months, etc.) is a
  // tenant-config concern deferred to a later ticket; for now treat any
  // non-empty seasonal map as "in season" at its declared weight, which is
  // enough for the priority formula's E term to be exercised and tested.
  const values = Object.values(seasonal);
  return values.length > 0 ? Math.max(...values) : 0;
}

export async function understandReport(req: UnderstandRequest): Promise<UnderstandResponse> {
  const t0 = performance.now();
  const timings: Record<string, number> = {};
  const mark = (label: string, start: number) => {
    timings[label] = Math.round(performance.now() - start);
  };

  // Stage 1 (parallel): jurisdiction resolution needs no AI.
  const jStart = performance.now();
  const jurisdiction = await resolveJurisdiction(req.lat, req.lng);
  mark("jurisdiction_ms", jStart);

  if (!jurisdiction.tenantId) {
    // Outside every seeded tenant: there is no routing/taxonomy to apply.
    // The orchestrator still returns a best-effort draft; the API layer
    // (not built in this ticket) decides how to surface that to the
    // citizen (Bible's "no match" fallback).
    throw new Error("No tenant covers this location (jurisdiction method 'none').");
  }

  // Stage 2: retrieval (KB + precedent), in parallel.
  const rStart = performance.now();
  const [knowledge, precedent] = await Promise.all([
    retrieveKnowledge(jurisdiction.tenantId, req.text, 6),
    retrievePrecedent(jurisdiction.tenantId, req.text, 3),
  ]);
  mark("retrieve_ms", rStart);

  // Stage 3: the single multimodal structured call.
  const uStart = performance.now();
  const u = await understand({
    tenantId: jurisdiction.tenantId,
    text: req.text,
    lang: req.lang,
    jurisdiction,
    knowledge,
    precedent,
    photoBase64: req.photoBase64,
  });
  mark("understand_ms", uStart);

  // Stage 4: deterministic routing (SQL only, no AI).
  const routeStart = performance.now();
  const routing = await routeComplaint(jurisdiction.tenantId, u.category_code, jurisdiction.boundaryId);
  mark("route_ms", routeStart);

  // Stage 5: dedup candidate search, scoped by the category's own radius/window.
  const category = await getCategory(u.category_code);
  const dedupStart = performance.now();
  const duplicateOf = category
    ? await findDuplicateTicket({
        tenantId: jurisdiction.tenantId,
        lat: req.lat,
        lng: req.lng,
        categoryCode: u.category_code,
        queryText: req.text,
        radiusM: category.dedup_radius_m,
        windowHours: category.dedup_window_h,
      })
    : null;
  mark("dedup_ms", dedupStart);

  // Stage 6: priority scoring (pure function).
  const priorityStart = performance.now();
  const nearestPoi = jurisdiction.nearbyPois[0]?.distanceM ?? null;
  const priority = scorePriority({
    severity0to100: u.photo.visual_severity_0_100
      ? Math.round((u.severity_0_100 + u.photo.visual_severity_0_100) / 2)
      : u.severity_0_100,
    distinctReporters: duplicateOf ? 2 : 1, // this report would be the 2nd on that ticket
    elapsedHours: 0, // at intake; the SLA/escalation job recomputes this over time (Phase E)
    slaHours: 48, // category-specific SLA lookup is wired in Phase E alongside ticket creation
    nearestPoiDistanceM: nearestPoi,
    seasonalFactor: category ? currentSeasonalFactor(category.seasonal) : 0,
    hazards: u.hazards,
  });
  mark("priority_ms", priorityStart);

  // Stage 7: the confidence gate.
  const { confidence, gate } = computeConfidence({
    modelConfidence: u.model_confidence,
    chosenCategoryCode: u.category_code,
    topPrecedentCategoryCode: precedent[0]?.categoryCode ?? null,
    locationMethod: jurisdiction.method,
  });

  // Stage 8: G6 - Spoken confirmation
  const ttsStart = performance.now();
  let ttsUrl: string | null = null;
  try {
    const lang = req.lang === "hi" ? "hi" : "en";
    
    let wardText = jurisdiction.boundaryName?.[lang];
    if (!wardText) {
      wardText = lang === "hi" ? "आपके क्षेत्र" : "your area";
    }

    let categoryText = category?.names[lang] || u.category_code;
    let agencyText = routing.department?.[lang] || "संबन्धित विभाग";
    if (lang === "en" && !routing.department?.en) agencyText = "the relevant department";

    const ttsText = lang === "hi"
      ? `मैंने समझा: ${wardText} में ${categoryText}। ${agencyText} को भेज रहे हैं। सही है?`
      : `I understood: ${categoryText} in ${wardText}. Sending it to ${agencyText}. Is that right?`;

    ttsUrl = await speak(ttsText, lang, false);
  } catch (err) {
    console.error("Failed to generate TTS for confirmation card:", err);
  }
  mark("tts_ms", ttsStart);

  mark("total_ms", t0);

  const draftId = randomUUID();
  const response: UnderstandResponse = {
    draftId,
    gate,
    confidence,
    understanding: u,
    routing,
    priority,
    duplicateOf,
    tenantId: jurisdiction.tenantId,
    boundaryId: jurisdiction.boundaryId,
    ttsUrl,
    timings,
  };

  // Persist the server's own result. confirm() trusts this row, never the client.
  const embedding = await embedText(req.text);
  await pool.query(`INSERT INTO report_drafts (id, payload) VALUES ($1, $2)`, [
    draftId,
    JSON.stringify({
      request: { text: req.text, lang: req.lang, lat: req.lat, lng: req.lng, inputMode: req.inputMode ?? "text" },
      response,
      locationMethod: jurisdiction.method,
      embedding,
    }),
  ]);

  return response;
}

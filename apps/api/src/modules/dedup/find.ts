// Build map #C7 — duplicate detection and clustering (Bible §6). Cheap
// filters first (H3 ring, then a PostGIS radius check, then a time window),
// expensive semantic comparison last. A match attaches the new report to the
// existing ticket (REPORT_MERGED) instead of creating a new one.
import { pool } from "../../db/client.js";
import { embedText } from "../../lib/gemini.js";
import { h3RingForPoint } from "../../lib/h3.js";

export interface DedupCandidate {
  ticketId: string;
  categoryCode: string;
  cosine: number;
  distanceM: number;
  combinedScore: number;
}

export interface DedupParams {
  tenantId: string;
  lat: number;
  lng: number;
  categoryCode: string;
  queryText: string;
  radiusM: number;
  windowHours: number;
}

const SAME_L1_THRESHOLD = 0.8;
const ANY_CATEGORY_THRESHOLD = 0.9;

export async function findDuplicateTicket(params: DedupParams): Promise<DedupCandidate | null> {
  const ring = h3RingForPoint(params.lat, params.lng);

  // 1. H3 ring pre-filter + open-ticket + time-window filter (cheap, index-backed).
  const candidateRows = await pool.query<{
    id: string;
    category_code: string;
    distance_m: number;
    embedding: string;
  }>(
    `SELECT t.id, t.category_code,
            ST_Distance(t.geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_m,
            t.embedding::text AS embedding
     FROM tickets t
     WHERE t.tenant_id = $3
       AND t.h3_r9 = ANY($4::text[])
       AND t.state NOT IN ('CLOSED_CONFIRMED', 'CLOSED_UNCONFIRMED', 'REJECTED_NOT_CIVIC')
       AND t.created_at > now() - ($5 || ' hours')::interval
       AND ST_DWithin(t.geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $6)`,
    [params.lng, params.lat, params.tenantId, ring, params.windowHours, params.radiusM],
  );

  if (candidateRows.rows.length === 0) return null;

  // 2. semantic comparison — only for the handful of spatial/temporal survivors.
  const queryEmbedding = await embedText(params.queryText);

  const l1Cache = new Map<string, string>();
  async function l1Of(categoryCode: string): Promise<string> {
    if (l1Cache.has(categoryCode)) return l1Cache.get(categoryCode)!;
    const res = await pool.query<{ l1: string }>(`SELECT l1 FROM categories WHERE code = $1`, [
      categoryCode,
    ]);
    const l1 = res.rows[0]?.l1 ?? "";
    l1Cache.set(categoryCode, l1);
    return l1;
  }

  const [queryCategoryL1, candidateL1s] = await Promise.all([
    l1Of(params.categoryCode),
    Promise.all(candidateRows.rows.map((r) => l1Of(r.category_code))),
  ]);

  let best: DedupCandidate | null = null;

  for (let i = 0; i < candidateRows.rows.length; i++) {
    const row = candidateRows.rows[i]!;
    const candidateEmbedding = parsePgVector(row.embedding);
    const cosine = cosineSimilarity(queryEmbedding, candidateEmbedding);
    const sameL1 = candidateL1s[i] === queryCategoryL1;
    const threshold = sameL1 ? SAME_L1_THRESHOLD : ANY_CATEGORY_THRESHOLD;

    if (cosine < threshold) continue;

    const proximityScore = 1 - row.distance_m / params.radiusM;
    const combinedScore = 0.6 * cosine + 0.4 * Math.max(0, proximityScore);

    if (!best || combinedScore > best.combinedScore) {
      best = {
        ticketId: row.id,
        categoryCode: row.category_code,
        cosine,
        distanceM: row.distance_m,
        combinedScore,
      };
    }
  }

  return best;
}

function parsePgVector(text: string): number[] {
  return text
    .slice(1, -1)
    .split(",")
    .map(Number);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

/**
 * Attach a report to an existing ticket as a duplicate: increments
 * report_count only if this citizen hasn't already reported this ticket
 * (the reports table's (ticket_id, citizen_id) unique index enforces that
 * at the data level — this just checks before incrementing the counter).
 */
export async function mergeIntoTicket(ticketId: string, citizenId: string): Promise<{ merged: boolean }> {
  const existing = await pool.query(
    `SELECT 1 FROM reports WHERE ticket_id = $1 AND citizen_id = $2`,
    [ticketId, citizenId],
  );
  if (existing.rows.length > 0) {
    return { merged: false }; // already reported by this citizen — no new count
  }
  await pool.query(`UPDATE tickets SET report_count = report_count + 1 WHERE id = $1`, [ticketId]);
  return { merged: true };
}

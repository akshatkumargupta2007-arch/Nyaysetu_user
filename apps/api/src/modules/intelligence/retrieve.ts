// Build map #C2 — the real RAG layer (Bible §5.2). Two parallel retrievals,
// each itself a hybrid of full-text + vector search merged with Reciprocal
// Rank Fusion, so an exact local word and a paraphrase both surface.
import { pool } from "../../db/client.js";
import { embedText, isMockMode } from "../../lib/gemini.js";

const RRF_K = 60;

/**
 * `plainto_tsquery` ANDs every token together, so a noisy transcript like
 * "naali jam hai" fails to match a KB chunk that contains "naali" but not
 * "jam" or "hai" — exactly the common case here, since chunks list local
 * nouns, not full sentences. OR the tokens instead: ts_rank still rewards
 * matching more of them, but one shared word is enough to surface a match.
 *
 * Tokenize by whitespace and trim only at word boundaries — NOT by
 * matching a `[\p{L}\p{N}]+` character class. A Devanagari conjunct like
 * "गड्ढा" (ग + ड + ् + ढ + ा) contains a virama and a vowel sign, both in
 * Unicode's Mn/Mc combining-mark categories rather than \p{L}, so a
 * character-class match silently fragments it into "गड" + "ढ" — a real
 * bug caught by retrieve.int.test.ts's Devanagari pothole case starting to
 * fail after the KB content changed, not by inspection.
 */
function orTsQuery(text: string): string {
  const words = text
    .normalize("NFC")
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+/u, "").replace(/[^\p{L}\p{N}]+$/u, ""))
    .filter((w) => w.length > 0);
  return words.map((w) => w.replace(/'/g, "''")).join(" | ");
}

function rrfMerge<T extends { id: string | number }>(
  lists: Array<Array<T>>,
): Array<T & { rrfScore: number }> {
  const scores = new Map<string | number, number>();
  const byId = new Map<string | number, T>();
  for (const list of lists) {
    list.forEach((item, rank) => {
      byId.set(item.id, item);
      scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (RRF_K + rank + 1));
    });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ ...(byId.get(id) as T), rrfScore: score }));
}

export interface KbChunkMatch {
  id: number;
  categoryCode: string | null;
  body: string;
}

export async function retrieveKnowledge(
  tenantId: string,
  queryText: string,
  topK = 6,
): Promise<KbChunkMatch[]> {
  const tsQuery = orTsQuery(queryText);
  const toMatch = (r: { id: number; category_code: string | null; body: string }) => ({
    id: r.id,
    categoryCode: r.category_code,
    body: r.body,
  });

  const ftsPromise =
    tsQuery === ""
      ? Promise.resolve({ rows: [] as Array<{ id: number; category_code: string | null; body: string }> })
      : pool.query<{ id: number; category_code: string | null; body: string }>(
          `SELECT id, category_code, body
           FROM kb_chunks
           WHERE (tenant_id = $1 OR tenant_id IS NULL)
             AND tsv @@ to_tsquery('simple', $2)
           ORDER BY ts_rank(tsv, to_tsquery('simple', $2)) DESC
           LIMIT 10`,
          [tenantId, tsQuery],
        );

  if (isMockMode) {
    // Mock embeddings are hash-based noise, not semantics (see lib/gemini.ts).
    // Blending them into ranking would actively outrank correct full-text
    // matches with randomness, so rank on full-text alone until a real key
    // is configured — this was caught by retrieve.int.test.ts, not by
    // inspection: with RRF always-on, Devanagari "गड्ढा" intermittently lost
    // to an unrelated chunk that got lucky in the random vector ordering.
    const fts = await ftsPromise;
    return fts.rows.slice(0, topK).map(toMatch);
  }

  const embedding = await embedText(queryText);
  const vecLiteral = `[${embedding.join(",")}]`;

  const [fts, vec] = await Promise.all([
    ftsPromise,
    pool.query<{ id: number; category_code: string | null; body: string }>(
      `SELECT id, category_code, body
       FROM kb_chunks
       WHERE (tenant_id = $1 OR tenant_id IS NULL)
       ORDER BY embedding <=> $2::vector
       LIMIT 10`,
      [tenantId, vecLiteral],
    ),
  ]);

  const merged = rrfMerge([fts.rows.map(toMatch), vec.rows.map(toMatch)]);
  return merged.slice(0, topK);
}

export interface PrecedentMatch {
  id: string;
  categoryCode: string;
  summaryOfficerEn: string;
  resolveHours: number | null;
}

export async function retrievePrecedent(
  tenantId: string,
  queryText: string,
  topK = 3,
): Promise<PrecedentMatch[]> {
  const embedding = await embedText(queryText);
  const vecLiteral = `[${embedding.join(",")}]`;

  const res = await pool.query<{
    id: string;
    category_code: string;
    summary_officer_en: string;
    resolve_hours: number | null;
  }>(
    `SELECT id, category_code, summary_officer_en,
            EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600 AS resolve_hours
     FROM tickets
     WHERE tenant_id = $1 AND state = 'CLOSED_CONFIRMED'
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [tenantId, vecLiteral, topK],
  );

  return res.rows.map((r) => ({
    id: r.id,
    categoryCode: r.category_code,
    summaryOfficerEn: r.summary_officer_en,
    resolveHours: r.resolve_hours === null ? null : Number(r.resolve_hours),
  }));
}

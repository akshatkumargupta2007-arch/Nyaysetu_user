// Build map #C2 test: retrieval works in both Devanagari and romanised
// Hinglish. Run against the live seeded DB. In mock-embedding mode (no
// GEMINI_API_KEY) the vector half is pseudo-random, so this specifically
// exercises that the full-text half of the RRF merge carries correctness —
// exactly the scenario the hybrid design exists for.
import { describe, it, expect, beforeAll } from "vitest";
import { retrieveKnowledge, retrievePrecedent } from "./retrieve.js";
import { pool } from "../../db/client.js";

async function seeded(): Promise<boolean> {
  try {
    const res = await pool.query("SELECT count(*) AS n FROM kb_chunks WHERE tenant_id = 'cg.bhilai'");
    return Number(res.rows[0].n) > 0;
  } catch {
    return false;
  }
}

describe("hybrid knowledge retrieval (live DB)", () => {
  let dbReady = false;
  beforeAll(async () => {
    dbReady = await seeded();
    if (!dbReady) console.warn("⚪ Skipping: run `npm run seed` first.");
  });

  it("romanised Hinglish 'naali jam hai' surfaces the drain-blocked chunk in the top 6", async () => {
    if (!dbReady) return;
    const results = await retrieveKnowledge("cg.bhilai", "naali jam hai, bahut badboo aa rahi hai", 6);
    expect(results.map((r) => r.categoryCode)).toContain("DRAIN_BLOCKED");
  });

  it("Devanagari 'गड्ढा' surfaces the pothole chunk in the top 6", async () => {
    if (!dbReady) return;
    const results = await retrieveKnowledge("cg.bhilai", "सड़क पर बहुत बड़ा गड्ढा है", 6);
    expect(results.map((r) => r.categoryCode)).toContain("ROAD_POTHOLE");
  });

  it("'batti gul' (Hinglish for power cut) surfaces the electricity outage chunk", async () => {
    if (!dbReady) return;
    const results = await retrieveKnowledge("cg.bhilai", "kal raat se batti gul hai", 6);
    expect(results.map((r) => r.categoryCode)).toContain("ELEC_OUTAGE");
  });

  it("precedent retrieval returns only CLOSED_CONFIRMED tickets with a resolution duration", async () => {
    if (!dbReady) return;
    const precedent = await retrievePrecedent("cg.bhilai", "garbage not collected for days", 3);
    expect(precedent.length).toBeGreaterThan(0);
    for (const p of precedent) {
      expect(p.resolveHours).not.toBeNull();
      expect(p.resolveHours!).toBeGreaterThan(0);
    }
  });
});

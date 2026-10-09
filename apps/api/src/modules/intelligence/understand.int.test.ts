// Build map #C4 test (mock-mode slice): category_code is always one of the
// tenant's real categories (schema-enum constraint holds even in mock
// mode), is_civic_issue/clarifying_question behave sensibly, and the
// understanding derived from Hindi/Hinglish/Devanagari text picks the
// category that real retrieval (already verified) surfaces.
import { describe, it, expect, beforeAll } from "vitest";
import { understand } from "./understand.js";
import { retrieveKnowledge, retrievePrecedent } from "./retrieve.js";
import { resolveJurisdiction } from "../jurisdiction/resolve.js";
import { pool } from "../../db/client.js";

async function seeded(): Promise<boolean> {
  try {
    const res = await pool.query("SELECT count(*) AS n FROM categories");
    return Number(res.rows[0].n) > 0;
  } catch {
    return false;
  }
}

async function run(text: string, lang = "hi") {
  const jurisdiction = await resolveJurisdiction(21.185, 81.33); // Ward 14
  const [knowledge, precedent] = await Promise.all([
    retrieveKnowledge("cg.bhilai", text, 6),
    retrievePrecedent("cg.bhilai", text, 3),
  ]);
  return understand({ tenantId: "cg.bhilai", text, lang, jurisdiction, knowledge, precedent });
}

describe("understand() — mock mode (no GEMINI_API_KEY)", () => {
  let dbReady = false;
  beforeAll(async () => {
    dbReady = await seeded();
  });

  it("'सड़क पर बहुत बड़ा गड्ढा है' -> ROAD_POTHOLE, a real tenant category", async () => {
    if (!dbReady) return;
    const u = await run("सड़क पर बहुत बड़ा गड्ढा है");
    expect(u.category_code).toBe("ROAD_POTHOLE");
    expect(u.is_civic_issue).toBe(true);
    expect(u.clarifying_question).toBeNull();
  });

  it("'kal raat se batti gul hai' -> ELEC_OUTAGE", async () => {
    if (!dbReady) return;
    const u = await run("kal raat se batti gul hai, koi sunwai nahi ho rahi");
    expect(u.category_code).toBe("ELEC_OUTAGE");
  });

  it("gibberish with no retrieval match falls back to OTHER_CIVIC with a clarifying question", async () => {
    if (!dbReady) return;
    const u = await run("xyzxyz qqqqq zzzz unrelated nonsense zzzz qqqqq");
    expect(u.category_code).toBe("OTHER_CIVIC");
    expect(u.clarifying_question).not.toBeNull();
    expect(u.model_confidence).toBeLessThan(0.5);
  });

  it("category_code is always a real category code known to the tenant (schema-enum holds in mock mode too)", async () => {
    if (!dbReady) return;
    const texts = [
      "poora mohalla andhere mein hai",
      "pani ki pipeline phat gayi",
      "aawara kutte ne kaat liya",
      "park ka jhoola toot gaya hai",
    ];
    const allCodes = (await pool.query<{ code: string }>("SELECT code FROM categories")).rows.map(
      (r) => r.code,
    );
    for (const text of texts) {
      const u = await run(text);
      expect(allCodes).toContain(u.category_code);
    }
  });

  it("severity and confidence are within their declared bounds", async () => {
    if (!dbReady) return;
    const u = await run("transformer se spark ho raha hai, aag lag sakti hai");
    expect(u.severity_0_100).toBeGreaterThanOrEqual(0);
    expect(u.severity_0_100).toBeLessThanOrEqual(100);
    expect(u.model_confidence).toBeGreaterThanOrEqual(0);
    expect(u.model_confidence).toBeLessThanOrEqual(1);
  });
});

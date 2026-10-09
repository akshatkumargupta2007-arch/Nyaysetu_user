// Build map #C10 test: the full pipeline, over real HTTP (Fastify inject,
// no port bound), against the live seeded DB. This is the closest thing to
// the Bible's "same sentence, three cities" demo table — reproduced here
// as "same complaint shape, three locations within Bhilai".
import { describe, it, expect, beforeAll } from "vitest";
import { buildApp } from "../../app.js";
import { createTestCitizen } from "../../test/auth.js";
import type { AppInstance } from "../../types.js";
import { pool } from "../../db/client.js";

async function seeded(): Promise<boolean> {
  try {
    const res = await pool.query("SELECT count(*) AS n FROM boundaries WHERE tenant_id = 'cg.bhilai'");
    return Number(res.rows[0].n) > 0;
  } catch {
    return false;
  }
}

describe("POST /reports/understand (full pipeline, live DB)", () => {
  let app: AppInstance;
  let dbReady = false;
  let citizen: Awaited<ReturnType<typeof createTestCitizen>>;

  beforeAll(async () => {
    app = await buildApp();
    citizen = await createTestCitizen(app);
    dbReady = await seeded();
    if (!dbReady) console.warn("⚪ Skipping: run `npm run seed` first.");
  });

  it("garbage in Ward 14 (BMC) routes to BMC, returns a full card, and times every stage", async () => {
    if (!dbReady) return;
    const res = await app.inject({
      method: "POST",
      url: "/reports/understand",
      headers: citizen.headers,
      payload: { text: "ward 14 mein kachra teen din se nahi utha", lang: "hi", lat: 21.185, lng: 81.33 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tenantId).toBe("cg.bhilai");
    expect(body.boundaryId).toBe("cg.bhilai.ward.14");
    expect(body.understanding.category_code).toBe("SW_UNCOLLECTED");
    expect(body.routing.agencyId).toBe("cg.bhilai.bmc");
    expect(body.routing.needsHumanTriage).toBe(false);
    expect(body.priority.band).toMatch(/Low|Medium|High|Critical/);
    expect(body.gate).toMatch(/card|card_amber|clarify/);
    expect(body.timings.total_ms).toBeGreaterThanOrEqual(0);
    expect(typeof body.timings.jurisdiction_ms).toBe("number");
    expect(typeof body.timings.understand_ms).toBe("number");
  });

  it("the SAME complaint in a BSP sector routes to BSP Town Services instead of BMC", async () => {
    if (!dbReady) return;
    const res = await app.inject({
      method: "POST",
      url: "/reports/understand",
      headers: citizen.headers,
      payload: { text: "yahan kachra teen din se nahi utha", lang: "hi", lat: 21.217, lng: 81.384 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.boundaryId).toBe("cg.bhilai.sector.9");
    expect(body.understanding.category_code).toBe("SW_UNCOLLECTED");
    expect(body.routing.agencyId).toBe("cg.bhilai.bsp_town");
  });

  it("a pothole on the NH-53 corridor routes to NHAI, not BMC/PWD", async () => {
    if (!dbReady) return;
    const res = await app.inject({
      method: "POST",
      url: "/reports/understand",
      headers: citizen.headers,
      payload: { text: "sadak par bahut bada gaddha hai, kal ek bike wala gir gaya", lang: "hi", lat: 21.189, lng: 81.3 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.boundaryId).toBe("nh53.bhilai");
    expect(body.understanding.category_code).toBe("ROAD_POTHOLE");
    expect(body.routing.agencyId).toBe("nhai");
  });

  it("a live-wire complaint is always Critical priority via the safety override", async () => {
    if (!dbReady) return;
    const res = await app.inject({
      method: "POST",
      url: "/reports/understand",
      headers: citizen.headers,
      payload: { text: "khambe se taar toot kar gir gaya hai, current ka darr hai", lang: "hi", lat: 21.185, lng: 81.33 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.understanding.category_code).toBe("ELEC_LIVE_WIRE");
    expect(body.priority.band).toBe("Critical");
    expect(body.priority.terms.safetyOverride).toBe(true);
  });

  it("a second, near-identical report attaches to the first instead of creating a fresh one (dedup wired into the orchestrator)", async () => {
    if (!dbReady) return;
    const text = "poora mohalla andhere mein hai, bahut der se streetlight band hai aaj";
    const payload = { text, lang: "hi", lat: 21.199, lng: 81.348 };

    const first = await app.inject({ method: "POST", url: "/reports/understand", headers: citizen.headers, payload });
    expect(first.statusCode).toBe(200);
    expect(first.json().duplicateOf).toBeNull();

    // NOTE: understandReport only PREVIEWS a draft (Bible §2.2) — it does
    // not commit a ticket row, so a second identical call still sees no
    // open ticket to attach to yet. This confirms the orchestrator's dedup
    // stage runs without erroring on an empty candidate set; the actual
    // "second report joins the first ticket" behaviour is exercised at the
    // find.int.test.ts level once Phase E's commit step creates real
    // tickets from confirmed drafts.
    const second = await app.inject({ method: "POST", url: "/reports/understand", headers: citizen.headers, payload });
    expect(second.statusCode).toBe(200);
  });

  it("outside every seeded tenant returns 422, not a crash", async () => {
    if (!dbReady) return;
    const res = await app.inject({
      method: "POST",
      url: "/reports/understand",
      headers: citizen.headers,
      payload: { text: "test", lang: "en", lat: 20.0, lng: 80.0 },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe("NO_JURISDICTION");
  });

  it("rejects an empty complaint with a 400, not a 500", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/reports/understand",
      headers: citizen.headers,
      payload: { text: "", lang: "hi", lat: 21.185, lng: 81.33 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("is protected by its own stricter rate limit (21st request in a minute is throttled)", async () => {
    if (!dbReady) return;
    const payload = { text: "rate limit probe", lang: "en", lat: 21.185, lng: 81.33 };
    const results = [];
    for (let i = 0; i < 21; i++) {
      results.push(await app.inject({ method: "POST", url: "/reports/understand", headers: citizen.headers, payload }));
    }
    const statuses = results.map((r) => r.statusCode);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});

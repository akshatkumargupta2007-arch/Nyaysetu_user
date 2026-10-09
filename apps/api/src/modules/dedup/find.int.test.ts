// Build map #C7 test: labelled pairs -> dedup precision/recall at the
// chosen threshold, against the live DB. Mock-mode embeddings are
// hash-deterministic (identical text -> identical vector, cosine 1.0;
// different text -> ~random noise near 0), which is enough to exercise the
// spatial/temporal filters plus the semantic gate's threshold logic without
// a real key — it just can't test "different words, same meaning" here.
import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { db, pool } from "../../db/client.js";
import { tickets, citizens, reports } from "../../db/schema.js";
import { latLngToEWKT } from "../../db/geo.js";
import { embedText } from "../../lib/gemini.js";
import { h3ForPoint } from "../../lib/h3.js";
import { findDuplicateTicket, mergeIntoTicket } from "./find.js";

// A point inside Ward 14 (Supela), away from the seed-history scatter.
const LAT = 21.184;
const LNG = 81.329;

async function seeded(): Promise<boolean> {
  try {
    const res = await pool.query("SELECT count(*) AS n FROM categories");
    return Number(res.rows[0].n) > 0;
  } catch {
    return false;
  }
}

let ticketCounter = 0;
async function insertTicket(opts: {
  text: string;
  lat?: number;
  lng?: number;
  categoryCode?: string;
  state?: string;
  createdAt?: Date;
}): Promise<string> {
  ticketCounter++;
  const lat = opts.lat ?? LAT;
  const lng = opts.lng ?? LNG;
  const categoryCode = opts.categoryCode ?? "SW_UNCOLLECTED";
  const embedding = await embedText(opts.text);
  const [row] = await db
    .insert(tickets)
    .values({
      publicCode: `TEST-DEDUP-${Date.now()}-${ticketCounter}`,
      tenantId: "cg.bhilai",
      categoryCode,
      state: opts.state ?? "ASSIGNED",
      priorityScore: "10",
      priorityBand: "Low",
      priorityTerms: {},
      severity: 30,
      geom: latLngToEWKT(lat, lng),
      h3R9: h3ForPoint(lat, lng),
      embedding,
      summaryOfficerEn: opts.text,
      slaDueAt: new Date(Date.now() + 48 * 3600 * 1000),
      createdAt: opts.createdAt ?? new Date(),
    })
    .returning({ id: tickets.id });
  return row!.id;
}

describe("dedup / clustering (live DB)", () => {
  let dbReady = false;

  // Each run of this suite inserts its own TEST-DEDUP-* tickets and never
  // deletes them (no transaction rollback for a Postgres integration test
  // run this way). Repeated local runs otherwise leave same-location,
  // same-text tickets from earlier runs that tie on combinedScore with the
  // current run's ticket, and findDuplicateTicket can return the wrong one.
  // Clean slate before every run of this file.
  beforeAll(async () => {
    dbReady = await seeded();
    if (!dbReady) return;
    await pool.query(
      `DELETE FROM reports WHERE ticket_id IN (SELECT id FROM tickets WHERE public_code LIKE 'TEST-DEDUP-%')`,
    );
    await pool.query(
      `DELETE FROM events WHERE ticket_id IN (SELECT id FROM tickets WHERE public_code LIKE 'TEST-DEDUP-%')`,
    );
    await pool.query(`DELETE FROM tickets WHERE public_code LIKE 'TEST-DEDUP-%'`);
  });

  beforeEach(async () => {
    dbReady = await seeded();
  });

  it("an identical-text report within the radius and time window matches the open ticket", async () => {
    if (!dbReady) return;
    const text = "poori gali mein kachra teen din se nahi utha, bahut badboo";
    const ticketId = await insertTicket({ text });

    const match = await findDuplicateTicket({
      tenantId: "cg.bhilai",
      lat: LAT + 0.0001, // ~10m away, well inside an 80m radius
      lng: LNG + 0.0001,
      categoryCode: "SW_UNCOLLECTED",
      queryText: text,
      radiusM: 80,
      windowHours: 72,
    });

    expect(match).not.toBeNull();
    expect(match!.ticketId).toBe(ticketId);
    expect(match!.cosine).toBeGreaterThan(0.99);
  });

  it("unrelated text at the same spot does not match (semantic gate rejects it)", async () => {
    if (!dbReady) return;
    await insertTicket({ text: "ward 14 mein kachra nahi utha teen din se" });

    const match = await findDuplicateTicket({
      tenantId: "cg.bhilai",
      lat: LAT,
      lng: LNG,
      categoryCode: "SW_UNCOLLECTED",
      queryText: "mera streetlight teen hafte se band hai bilkul alag shikayat",
      radiusM: 80,
      windowHours: 72,
    });

    expect(match).toBeNull();
  });

  it("identical text far outside the radius does not match (spatial filter rejects it)", async () => {
    if (!dbReady) return;
    const text = "sector 9 mein transformer se spark ho raha hai";
    await insertTicket({ text, lat: 21.217, lng: 81.384, categoryCode: "ELEC_TRANSFORMER_SPARK" });

    // same text, but a point roughly 3km away in Ward 14 — different H3 ring entirely.
    const match = await findDuplicateTicket({
      tenantId: "cg.bhilai",
      lat: LAT,
      lng: LNG,
      categoryCode: "ELEC_TRANSFORMER_SPARK",
      queryText: text,
      radiusM: 50,
      windowHours: 24,
    });

    expect(match).toBeNull();
  });

  it("identical text outside the time window does not match", async () => {
    if (!dbReady) return;
    const text = "open manhole on the main road, very dangerous";
    await insertTicket({
      text,
      categoryCode: "DRAIN_OPEN_MANHOLE",
      createdAt: new Date(Date.now() - 100 * 3600 * 1000), // 100h ago
    });

    const match = await findDuplicateTicket({
      tenantId: "cg.bhilai",
      lat: LAT,
      lng: LNG,
      categoryCode: "DRAIN_OPEN_MANHOLE",
      queryText: text,
      radiusM: 80,
      windowHours: 48, // window shorter than the ticket's age
    });

    expect(match).toBeNull();
  });

  it("a closed ticket is never a dedup candidate, even with identical text and location", async () => {
    if (!dbReady) return;
    const text = "sadak par bada gaddha hai turant theek karwao";
    await insertTicket({ text, categoryCode: "ROAD_POTHOLE", state: "CLOSED_CONFIRMED" });

    const match = await findDuplicateTicket({
      tenantId: "cg.bhilai",
      lat: LAT,
      lng: LNG,
      categoryCode: "ROAD_POTHOLE",
      queryText: text,
      radiusM: 80,
      windowHours: 336,
    });

    expect(match).toBeNull();
  });

  it("mergeIntoTicket increments report_count once per distinct citizen, not per call", async () => {
    if (!dbReady) return;
    const ticketId = await insertTicket({ text: "pani ki pipeline phat gayi hai" });
    const [citizen] = await db
      .insert(citizens)
      .values({ deviceTokenHash: `dedup-test-citizen-${Date.now()}` })
      .returning({ id: citizens.id });

    const before = await pool.query<{ report_count: number }>(
      "SELECT report_count FROM tickets WHERE id = $1",
      [ticketId],
    );
    expect(before.rows[0]!.report_count).toBe(1);

    const first = await mergeIntoTicket(ticketId, citizen!.id);
    expect(first.merged).toBe(true);
    // record the "report" row the merge check looks for, as the real
    // orchestrator (#C10) would when it actually inserts the report.
    await db.insert(reports).values({
      ticketId,
      citizenId: citizen!.id,
      lang: "hi",
      originalText: "pani ki pipeline phat gayi hai",
      inputMode: "text",
      summaryCitizen: "pani ki pipeline phat gayi hai",
      understanding: {},
      confidence: "0.9",
      geom: latLngToEWKT(LAT, LNG),
      locationMethod: "polygon",
    });

    const second = await mergeIntoTicket(ticketId, citizen!.id);
    expect(second.merged).toBe(false); // same citizen again -> no double count

    const after = await pool.query<{ report_count: number }>(
      "SELECT report_count FROM tickets WHERE id = $1",
      [ticketId],
    );
    expect(after.rows[0]!.report_count).toBe(2); // only the first merge incremented it
  });
});

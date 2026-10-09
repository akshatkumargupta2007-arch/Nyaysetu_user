// Build map #D9 — "Your complaints" list is scoped to the logged-in phone account (#D8).
import { describe, it, expect, beforeAll } from "vitest";
import { buildApp } from "../../app.js";
import type { AppInstance } from "../../types.js";
import { db, pool } from "../../db/client.js";
import { tickets, reports } from "../../db/schema.js";
import { latLngToEWKT } from "../../db/geo.js";
import { h3ForPoint } from "../../lib/h3.js";
import { createTestCitizen } from "../../test/auth.js";

describe("GET /me/reports (#D9)", () => {
  let app: AppInstance;
  beforeAll(async () => {
    app = await buildApp();
  });

  it("a new account sees an empty list", async () => {
    const c = await createTestCitizen(app);
    const res = await app.inject({ method: "GET", url: "/me/reports", headers: c.headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("users only see complaints associated with their own phone account", async () => {
    const mine = await createTestCitizen(app);
    const theirs = await createTestCitizen(app);
    const [ticket] = await db
      .insert(tickets)
      .values({
        publicCode: `TEST-ME-${Date.now()}`,
        tenantId: "cg.bhilai",
        categoryCode: "SW_UNCOLLECTED",
        state: "ASSIGNED",
        priorityScore: "10",
        priorityBand: "Low",
        priorityTerms: {},
        severity: 10,
        geom: latLngToEWKT(21.185, 81.33),
        h3R9: h3ForPoint(21.185, 81.33),
        embedding: new Array(768).fill(0.01),
        summaryOfficerEn: "me-reports test",
        slaDueAt: new Date(Date.now() + 3600_000),
      })
      .returning({ id: tickets.id });
    await db.insert(reports).values({
      ticketId: ticket!.id,
      citizenId: mine.id,
      lang: "hi",
      originalText: "kachra",
      inputMode: "text",
      summaryCitizen: "kachra nahi utha",
      understanding: {},
      confidence: "0.9",
      geom: latLngToEWKT(21.185, 81.33),
      locationMethod: "polygon",
    });

    const a = await app.inject({ method: "GET", url: "/me/reports", headers: mine.headers });
    expect(a.json()).toHaveLength(1);
    expect(a.json()[0].ticketId).toBe(ticket!.id);

    const b = await app.inject({ method: "GET", url: "/me/reports", headers: theirs.headers });
    expect(b.json()).toEqual([]);

    // Another account cannot read, stream, or close it either.
    const track = await app.inject({ method: "GET", url: `/tickets/${ticket!.id}/tracking`, headers: theirs.headers });
    expect(track.statusCode).toBe(403);
    const close = await app.inject({
      method: "POST",
      url: `/reports/${ticket!.id}/confirm-closure`,
      headers: theirs.headers,
      payload: { confirmed: true },
    });
    expect(close.statusCode).toBe(403);
    const ownTrack = await app.inject({ method: "GET", url: `/tickets/${ticket!.id}/tracking`, headers: mine.headers });
    expect(ownTrack.statusCode).toBe(200);

    await pool.query(`DELETE FROM reports WHERE ticket_id = $1`, [ticket!.id]);
    await pool.query(`DELETE FROM tickets WHERE id = $1`, [ticket!.id]);
  });
});

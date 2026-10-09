// Build map #C9 test: a reused photo (same or near-identical dHash,
// uploaded for a different ticket) is flagged; an unrelated photo is not;
// a stale EXIF timestamp is flagged. Against the live DB.
import { describe, it, expect, beforeAll } from "vitest";
import { db, pool } from "../../db/client.js";
import { tickets, media } from "../../db/schema.js";
import { latLngToEWKT } from "../../db/geo.js";
import { h3ForPoint } from "../../lib/h3.js";
import { checkPhotoIntake } from "./intake.js";

async function seeded(): Promise<boolean> {
  try {
    const res = await pool.query("SELECT count(*) AS n FROM categories");
    return Number(res.rows[0].n) > 0;
  } catch {
    return false;
  }
}

let counter = 0;
async function insertTicketWithMedia(dhash: string): Promise<string> {
  counter++;
  const [ticket] = await db
    .insert(tickets)
    .values({
      publicCode: `TEST-INTAKE-${Date.now()}-${counter}`,
      tenantId: "cg.bhilai",
      categoryCode: "SW_UNCOLLECTED",
      state: "ASSIGNED",
      priorityScore: "10",
      priorityBand: "Low",
      priorityTerms: {},
      severity: 30,
      geom: latLngToEWKT(21.185, 81.33),
      h3R9: h3ForPoint(21.185, 81.33),
      embedding: new Array(768).fill(0.01),
      summaryOfficerEn: "intake test ticket",
      slaDueAt: new Date(Date.now() + 48 * 3600 * 1000),
    })
    .returning({ id: tickets.id });

  await pool.query(
    `INSERT INTO media (ticket_id, kind, cloudinary_public_id, dhash, uploader_type, uploader_id)
     VALUES ($1, 'before', 'test-public-id', $2::bit(64), 'CITIZEN', 'test-citizen')`,
    [ticket!.id, dhash],
  );

  return ticket!.id;
}

function flipBits(hash: string, n: number): string {
  const chars = hash.split("");
  for (let i = 0; i < n; i++) {
    chars[i] = chars[i] === "0" ? "1" : "0";
  }
  return chars.join("");
}

describe("photo intake checks (live DB)", () => {
  let dbReady = false;
  beforeAll(async () => {
    dbReady = await seeded();
    if (!dbReady) return;
    await pool.query(
      `DELETE FROM media WHERE ticket_id IN (SELECT id FROM tickets WHERE public_code LIKE 'TEST-INTAKE-%')`,
    );
    // A background priority-recompute job may have written events on these tickets.
    await pool.query(`DELETE FROM events WHERE ticket_id IN (SELECT id FROM tickets WHERE public_code LIKE 'TEST-INTAKE-%')`);
    await pool.query(`DELETE FROM tickets WHERE public_code LIKE 'TEST-INTAKE-%'`);
  });

  const baseHash = "1".repeat(32) + "0".repeat(32); // an arbitrary but fixed 64-bit pattern

  it("an identical dHash uploaded for a different ticket is flagged reused", async () => {
    if (!dbReady) return;
    const otherTicketId = await insertTicketWithMedia(baseHash);

    const result = await checkPhotoIntake({ tenantId: "cg.bhilai", dhash: baseHash, exifTakenAt: new Date() });

    expect(result.reused).toBe(true);
    expect(result.reusedFromTicketId).toBe(otherTicketId);
    expect(result.reusedDistance).toBe(0);
  });

  it("a slightly different dHash (crop/recompress-level, 4 bits flipped) is still flagged reused", async () => {
    if (!dbReady) return;
    await insertTicketWithMedia(baseHash);
    const nearCopy = flipBits(baseHash, 4);

    const result = await checkPhotoIntake({ tenantId: "cg.bhilai", dhash: nearCopy, exifTakenAt: new Date() });

    expect(result.reused).toBe(true);
    expect(result.reusedDistance).toBe(4);
  });

  it("a genuinely different dHash (20 bits flipped) is NOT flagged reused", async () => {
    if (!dbReady) return;
    await insertTicketWithMedia(baseHash);
    const differentPhoto = flipBits(baseHash, 20);

    const result = await checkPhotoIntake({
      tenantId: "cg.bhilai",
      dhash: differentPhoto,
      exifTakenAt: new Date(),
    });

    expect(result.reused).toBe(false);
    expect(result.reusedFromTicketId).toBeNull();
  });

  it("an EXIF timestamp older than 7 days is flagged stale", async () => {
    if (!dbReady) return;
    const oldDate = new Date(Date.now() - 10 * 24 * 3600 * 1000);
    const result = await checkPhotoIntake({
      tenantId: "cg.bhilai",
      dhash: "0".repeat(64),
      exifTakenAt: oldDate,
    });
    expect(result.staleExif).toBe(true);
  });

  it("a recent EXIF timestamp is not flagged stale, and no EXIF at all is not flagged stale", async () => {
    if (!dbReady) return;
    const recent = await checkPhotoIntake({
      tenantId: "cg.bhilai",
      dhash: "0".repeat(64),
      exifTakenAt: new Date(),
    });
    expect(recent.staleExif).toBe(false);

    const noExif = await checkPhotoIntake({ tenantId: "cg.bhilai", dhash: "0".repeat(64), exifTakenAt: null });
    expect(noExif.staleExif).toBe(false);
  });
});

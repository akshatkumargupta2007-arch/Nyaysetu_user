// Build map #C9 — photo intelligence at intake (Bible §8, the intake half;
// the closure-time before/after AI comparison is Phase F's #F4, blocked on
// the upload flow that doesn't exist yet). At intake we can still run the
// two deterministic checks that don't need a live photo pipeline: has this
// exact photo (or a crop/recompress of it) been uploaded before anywhere in
// the tenant, and is its EXIF timestamp suspiciously old.
import { pool } from "../../db/client.js";
import { hammingDistance, REUSE_CROSS_TICKET_THRESHOLD } from "./dhash.js";

export interface PhotoIntakeFlags {
  reused: boolean;
  reusedFromTicketId: string | null;
  reusedDistance: number | null;
  staleExif: boolean;
}

const REUSE_WINDOW_DAYS = 180;
const STALE_EXIF_DAYS = 7;

export async function checkPhotoIntake(params: {
  tenantId: string;
  dhash: string;
  exifTakenAt: Date | null;
}): Promise<PhotoIntakeFlags> {
  // Compare against every media row uploaded for this tenant in the last
  // 180 days. bit(64) has no native Hamming-distance operator we can index
  // on cheaply at this data volume, so this does the comparison in app code
  // over a bounded, time-windowed candidate set — fine at hackathon scale;
  // worth revisiting with a bit-sampling index if the tenant's media table
  // grows into the millions.
  const res = await pool.query<{ ticket_id: string | null; dhash: string }>(
    `SELECT m.ticket_id, m.dhash::text AS dhash
     FROM media m
     JOIN tickets t ON t.id = m.ticket_id
     WHERE t.tenant_id = $1
       AND m.dhash IS NOT NULL
       AND m.created_at > now() - ($2 || ' days')::interval`,
    [params.tenantId, REUSE_WINDOW_DAYS],
  );

  let reusedFromTicketId: string | null = null;
  let reusedDistance: number | null = null;

  for (const row of res.rows) {
    const distance = hammingDistance(params.dhash, row.dhash);
    if (distance <= REUSE_CROSS_TICKET_THRESHOLD) {
      if (reusedDistance === null || distance < reusedDistance) {
        reusedDistance = distance;
        reusedFromTicketId = row.ticket_id;
      }
    }
  }

  const staleExif = params.exifTakenAt
    ? Date.now() - params.exifTakenAt.getTime() > STALE_EXIF_DAYS * 24 * 3600 * 1000
    : false;

  return {
    reused: reusedFromTicketId !== null,
    reusedFromTicketId,
    reusedDistance,
    staleExif,
  };
}

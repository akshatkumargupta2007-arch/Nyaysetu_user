// Build map #C3 — jurisdiction resolver: (lat, lng) -> the most specific
// containing boundary, with graceful fallback to the nearest centroid, then
// to "none". No AI involved — this is pure PostGIS (Bible §5.1).
import { pool } from "../../db/client.js";
import { latLngToEWKT } from "../../db/geo.js";

export type LocationMethod = "polygon" | "centroid" | "none";

export interface JurisdictionResult {
  tenantId: string | null;
  boundaryId: string | null;
  boundaryName: { hi: string; en: string } | null;
  ownerAgencyId: string | null;
  method: LocationMethod;
  nearbyPois: Array<{ kind: string; name: string; distanceM: number }>;
}

const NEAREST_CENTROID_KM = 2;
const POI_RADIUS_M = 300;

export async function resolveJurisdiction(
  lat: number,
  lng: number,
): Promise<JurisdictionResult> {
  const point = latLngToEWKT(lat, lng);

  // 1. exact: most-specific polygon containing the point.
  const exact = await pool.query<{
    id: string;
    tenant_id: string;
    name: { hi: string; en: string };
    owner_agency_id: string | null;
  }>(
    `SELECT id, tenant_id, name, owner_agency_id
     FROM boundaries
     WHERE ST_Contains(geom, ST_SetSRID(ST_GeomFromEWKT($1), 4326))
     ORDER BY specificity DESC
     LIMIT 1`,
    [point],
  );

  if (exact.rows.length > 0) {
    const row = exact.rows[0]!;
    return {
      tenantId: row.tenant_id,
      boundaryId: row.id,
      boundaryName: row.name,
      ownerAgencyId: row.owner_agency_id,
      method: "polygon",
      nearbyPois: await nearbyPois(lat, lng),
    };
  }

  // 2. fallback: nearest ward/sector centroid within NEAREST_CENTROID_KM.
  const nearest = await pool.query<{
    id: string;
    tenant_id: string;
    name: { hi: string; en: string };
    owner_agency_id: string | null;
    distance_m: number;
  }>(
    `SELECT id, tenant_id, name, owner_agency_id,
            ST_Distance(centroid::geography, ST_SetSRID(ST_GeomFromEWKT($1), 4326)::geography) AS distance_m
     FROM boundaries
     WHERE kind IN ('ward', 'sector')
     ORDER BY centroid <-> ST_SetSRID(ST_GeomFromEWKT($1), 4326)
     LIMIT 1`,
    [point],
  );

  if (nearest.rows.length > 0 && nearest.rows[0]!.distance_m <= NEAREST_CENTROID_KM * 1000) {
    const row = nearest.rows[0]!;
    return {
      tenantId: row.tenant_id,
      boundaryId: row.id,
      boundaryName: row.name,
      ownerAgencyId: row.owner_agency_id,
      method: "centroid",
      nearbyPois: await nearbyPois(lat, lng),
    };
  }

  // 3. no match at all (outside every tenant's seeded area).
  return {
    tenantId: null,
    boundaryId: null,
    boundaryName: null,
    ownerAgencyId: null,
    method: "none",
    nearbyPois: [],
  };
}

async function nearbyPois(
  lat: number,
  lng: number,
): Promise<Array<{ kind: string; name: string; distanceM: number }>> {
  const point = latLngToEWKT(lat, lng);
  const res = await pool.query<{ kind: string; name: string; distance_m: number }>(
    `SELECT kind, name,
            ST_Distance(geom::geography, ST_SetSRID(ST_GeomFromEWKT($1), 4326)::geography) AS distance_m
     FROM pois
     WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_GeomFromEWKT($1), 4326)::geography, $2)
     ORDER BY distance_m ASC`,
    [point, POI_RADIUS_M],
  );
  return res.rows.map((r) => ({ kind: r.kind, name: r.name, distanceM: Math.round(r.distance_m) }));
}

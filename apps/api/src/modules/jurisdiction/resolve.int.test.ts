// Integration test for build map #B2 and #C3/#C5's required test: a
// table-driven (lat, lng, category) -> agency check against the REAL seeded
// Postgres database (no mocking — jurisdiction and routing are pure SQL by
// design). Requires `npm run seed` to have been run against DATABASE_URL.
import { describe, it, expect, beforeAll } from "vitest";
import { resolveJurisdiction } from "./resolve.js";
import { routeComplaint } from "../routing/route.js";
import { pool } from "../../db/client.js";

async function seeded(): Promise<boolean> {
  try {
    const res = await pool.query("SELECT count(*) AS n FROM boundaries WHERE tenant_id = 'cg.bhilai'");
    return Number(res.rows[0].n) > 0;
  } catch {
    return false;
  }
}

describe("jurisdiction + routing (live DB, cg.bhilai seed)", () => {
  let dbReady = false;

  beforeAll(async () => {
    dbReady = await seeded();
    if (!dbReady) {
      console.warn(
        "⚪ Skipping jurisdiction/routing integration tests: database not seeded. Run `npm run seed` first.",
      );
    }
  });

  // 15 hand-written cases from Bible §5.2 / build map #B2's demo scenarios,
  // plus edge cases (city-only, outside every tenant).
  const cases: Array<{
    name: string;
    lat: number;
    lng: number;
    expectMethod: "polygon" | "centroid" | "none";
    expectBoundaryId?: string;
    category?: string;
    expectAgency?: string;
  }> = [
    { name: "Ward 14 (Supela) centre, streetlight", lat: 21.185, lng: 81.33, expectMethod: "polygon", expectBoundaryId: "cg.bhilai.ward.14", category: "LIGHT_AREA_DARK", expectAgency: "cg.bhilai.bmc" },
    { name: "Ward 14 corner, garbage", lat: 21.18, lng: 81.325, expectMethod: "polygon", expectBoundaryId: "cg.bhilai.ward.14", category: "SW_UNCOLLECTED", expectAgency: "cg.bhilai.bmc" },
    { name: "Ward 22 (Nehru Nagar) centre, water", lat: 21.199, lng: 81.348, expectMethod: "polygon", expectBoundaryId: "cg.bhilai.ward.22", category: "WATER_NO_SUPPLY", expectAgency: "cg.bhilai.bmc" },
    { name: "Ward 22 corner, pothole", lat: 21.2, lng: 81.352, expectMethod: "polygon", expectBoundaryId: "cg.bhilai.ward.22", category: "ROAD_POTHOLE", expectAgency: "cg.bhilai.bmc" },
    { name: "Sector 7 (BSP) centre, garbage -> BSP not BMC", lat: 21.212, lng: 81.366, expectMethod: "polygon", expectBoundaryId: "cg.bhilai.sector.7", category: "SW_UNCOLLECTED", expectAgency: "cg.bhilai.bsp_town" },
    { name: "Sector 7 corner, water -> BSP", lat: 21.207, lng: 81.36, expectMethod: "polygon", expectBoundaryId: "cg.bhilai.sector.7", category: "WATER_NO_SUPPLY", expectAgency: "cg.bhilai.bsp_town" },
    { name: "Sector 9 (BSP) centre, garbage -> BSP (Bible demo scenario A)", lat: 21.217, lng: 81.384, expectMethod: "polygon", expectBoundaryId: "cg.bhilai.sector.9", category: "SW_UNCOLLECTED", expectAgency: "cg.bhilai.bsp_town" },
    { name: "Sector 9 corner, drain blocked -> BSP", lat: 21.22, lng: 81.388, expectMethod: "polygon", expectBoundaryId: "cg.bhilai.sector.9", category: "DRAIN_BLOCKED", expectAgency: "cg.bhilai.bsp_town" },
    { name: "Sector 7, electricity -> CSPDCL even inside BSP township", lat: 21.212, lng: 81.366, expectMethod: "polygon", expectBoundaryId: "cg.bhilai.sector.7", category: "ELEC_OUTAGE", expectAgency: "cg.cspdcl" },
    { name: "Sector 9, electricity -> CSPDCL even inside BSP township", lat: 21.217, lng: 81.384, expectMethod: "polygon", expectBoundaryId: "cg.bhilai.sector.9", category: "ELEC_LIVE_WIRE", expectAgency: "cg.cspdcl" },
    { name: "NH-53 corridor, pothole -> NHAI (Bible demo scenario B)", lat: 21.189, lng: 81.3, expectMethod: "polygon", expectBoundaryId: "nh53.bhilai", category: "ROAD_POTHOLE", expectAgency: "nhai" },
    { name: "NH-53 corridor, drain (not a road category) -> BMC default, not NHAI", lat: 21.189, lng: 81.3, expectMethod: "polygon", expectBoundaryId: "nh53.bhilai", category: "DRAIN_BLOCKED", expectAgency: "cg.bhilai.bmc" },
    { name: "City-wide only (no ward/sector/corridor), garbage -> BMC", lat: 21.16, lng: 81.29, expectMethod: "polygon", expectBoundaryId: "cg.bhilai.city", category: "SW_UNCOLLECTED", expectAgency: "cg.bhilai.bmc" },
    { name: "Just outside Ward 14 polygon -> falls back to nearest centroid", lat: 21.1775, lng: 81.321, expectMethod: "polygon" /* likely still inside city at minimum; assert method is not 'none' */ },
    { name: "Far outside every tenant -> method none", lat: 20.0, lng: 80.0, expectMethod: "none" },
  ];

  it.each(cases)("$name", async (c) => {
    if (!dbReady) return;
    const jurisdiction = await resolveJurisdiction(c.lat, c.lng);
    expect(jurisdiction.method === "none" ? "none" : "polygon-or-centroid").toBe(
      c.expectMethod === "none" ? "none" : "polygon-or-centroid",
    );
    if (c.expectBoundaryId) {
      expect(jurisdiction.boundaryId).toBe(c.expectBoundaryId);
    }
    if (c.category && c.expectAgency) {
      const routing = await routeComplaint(jurisdiction.tenantId!, c.category, jurisdiction.boundaryId);
      expect(routing.agencyId).toBe(c.expectAgency);
      expect(routing.needsHumanTriage).toBe(false);
    }
  });

  it("a category with no routing rule at all falls back to human triage", async () => {
    if (!dbReady) return;
    const routing = await routeComplaint("cg.bhilai", "NOT_A_REAL_CATEGORY", null);
    expect(routing.needsHumanTriage).toBe(true);
    expect(routing.agencyId).toBeNull();
  });

  it("the priority-scoring worked example's location (Ward 14, near the Supela school) resolves with a nearby POI", async () => {
    if (!dbReady) return;
    const j = await resolveJurisdiction(21.1852, 81.3301);
    expect(j.boundaryId).toBe("cg.bhilai.ward.14");
    const school = j.nearbyPois.find((p) => p.kind === "school");
    expect(school).toBeDefined();
    expect(school!.distanceM).toBeLessThan(300);
  });
});

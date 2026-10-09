// Build map #B1-#B4 — loads data/ into the database: the national taxonomy,
// every tenant's agencies/boundaries/routing/SLA/POIs/KB, and synthetic
// historical tickets. Idempotent: safe to run more than once (upserts).
import { hashPasscode } from "../modules/officers/passcode.js";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db, pool } from "./client.js";
import {
  categories,
  tenants,
  agencies,
  boundaries,
  routingRules,
  slaPolicies,
  pois,
  kbChunks,
  tickets,
  events,
  citizens,
  officers,
} from "./schema.js";
import crypto from "node:crypto";
import { multiPolygonToEWKT, pointToEWKT, latLngToEWKT, type GeoJSONMultiPolygon, type GeoJSONPoint } from "./geo.js";
import { embedText } from "../lib/gemini.js";
import { h3ForPoint } from "../lib/h3.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// `--prod`: reference data only (taxonomy, tenants, boundaries, agencies, routing, SLAs, KB).
// No demo officers with passcode 1234 and no fake historical tickets.
const PROD = process.argv.includes("--prod");
const DATA_ROOT = join(__dirname, "../../../../data");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

// ── #B1: national taxonomy ───────────────────────────────────────

interface CategorySeed {
  code: string;
  l1: string;
  names: { hi: string; en: string };
  icon: string;
  default_severity: number;
  safety_hazards: string[];
  dedup_radius_m: number;
  dedup_window_h: number;
  seasonal: Record<string, number>;
  mappings: Record<string, string>;
}

async function seedTaxonomy() {
  const rows = readJson<CategorySeed[]>(join(DATA_ROOT, "taxonomy.json"));
  for (const c of rows) {
    await db
      .insert(categories)
      .values({
        code: c.code,
        l1: c.l1,
        names: c.names,
        icon: c.icon,
        defaultSeverity: c.default_severity,
        safetyHazards: c.safety_hazards,
        dedupRadiusM: c.dedup_radius_m,
        dedupWindowH: c.dedup_window_h,
        seasonal: c.seasonal,
        mappings: c.mappings,
      })
      .onConflictDoUpdate({
        target: categories.code,
        set: {
          l1: c.l1,
          names: c.names,
          icon: c.icon,
          defaultSeverity: c.default_severity,
          safetyHazards: c.safety_hazards,
          dedupRadiusM: c.dedup_radius_m,
          dedupWindowH: c.dedup_window_h,
          seasonal: c.seasonal,
          mappings: c.mappings,
        },
      });
  }
  console.log(`✅ ${rows.length} categories (taxonomy.json)`);
}

// ── #B2: tenant — agencies, boundaries, routing, SLA ────────────

interface TenantSeed {
  id: string;
  name: { hi: string; en: string };
  state_code: string;
  lgd_code: number | null;
  config: Record<string, unknown>;
}
interface AgencySeed {
  id: string;
  tenant_id: string | null;
  name: { hi: string; en: string };
  kind: string;
}
interface BoundaryFeature {
  type: "Feature";
  properties: {
    id: string;
    tenant_id: string;
    kind: string;
    name: { hi: string; en: string };
    specificity: number;
    owner_agency_id: string;
    approximate: boolean;
  };
  geometry: GeoJSONMultiPolygon;
}
interface RoutingSeed {
  tenant_id: string;
  category_code: string;
  boundary_id: string | null;
  agency_id: string;
  department: { hi: string; en: string };
  first_role: string;
  precedence: number;
}
interface SlaSeed {
  tenant_id: string;
  category_code: string;
  resolve_hours: number;
  ladder: Array<{ after_h: number; role: string }>;
}
interface PoiFeature {
  type: "Feature";
  properties: { kind: string; name: string };
  geometry: GeoJSONPoint;
}

async function seedTenant(tenantDir: string) {
  const dir = join(DATA_ROOT, "tenants", tenantDir);

  const tenant = readJson<TenantSeed>(join(dir, "tenant.json"));
  await db
    .insert(tenants)
    .values({
      id: tenant.id,
      name: tenant.name,
      stateCode: tenant.state_code,
      lgdCode: tenant.lgd_code,
      config: tenant.config,
    })
    .onConflictDoUpdate({
      target: tenants.id,
      set: { name: tenant.name, stateCode: tenant.state_code, config: tenant.config },
    });

  const agencySeeds = readJson<AgencySeed[]>(join(dir, "agencies.json"));
  for (const a of agencySeeds) {
    await db
      .insert(agencies)
      .values({ id: a.id, tenantId: a.tenant_id, name: a.name, kind: a.kind })
      .onConflictDoUpdate({ target: agencies.id, set: { name: a.name, kind: a.kind } });
  }

  // #F1: Seed Demo Officers
  // We'll create a few officers for each agency with passcode "1234".
  const defaultRoles = [
    { role: "FIELD_SUPERVISOR", level: 1, name: "Field Supervisor" },
    { role: "WARD_SUPERVISOR", level: 1, name: "Ward Supervisor" },
    { role: "SANITARY_INSPECTOR_OR_AE", level: 2, name: "Sanitary Inspector / AE" },
    { role: "ASSISTANT_ENGINEER", level: 2, name: "Assistant Engineer" },
    { role: "ZONAL_OFFICER", level: 3, name: "Zonal Officer" },
    { role: "EXECUTIVE_ENGINEER", level: 3, name: "Executive Engineer" },
    { role: "COMMISSIONER", level: 4, name: "Commissioner" },
  ];

  for (const a of PROD ? [] : agencySeeds) {
    for (const r of defaultRoles) {
      const officerId = `${a.id}_${r.role.toLowerCase()}`;
      const passcodeHash = await hashPasscode("1234"); // demo passcode, stored with bcrypt like a real one
      await db
        .insert(officers)
        .values({
          id: officerId,
          tenantId: tenant.id,
          agencyId: a.id,
          role: r.role,
          level: r.level,
          name: `${r.name} (${a.name})`,
          passcodeHash,
        })
        .onConflictDoUpdate({
          target: officers.id,
          set: {
            role: r.role,
            level: r.level,
            name: `${r.name} (${a.name})`,
            passcodeHash,
          },
        });
    }
  }

  const boundaryFeatures = readJson<{ features: BoundaryFeature[] }>(
    join(dir, "boundaries.geojson"),
  ).features;
  for (const f of boundaryFeatures) {
    const p = f.properties;
    await db
      .insert(boundaries)
      .values({
        id: p.id,
        tenantId: p.tenant_id,
        kind: p.kind,
        name: p.name,
        specificity: p.specificity,
        ownerAgencyId: p.owner_agency_id,
        approximate: p.approximate,
        geom: multiPolygonToEWKT(f.geometry),
      })
      .onConflictDoUpdate({
        target: boundaries.id,
        set: {
          kind: p.kind,
          name: p.name,
          specificity: p.specificity,
          ownerAgencyId: p.owner_agency_id,
          approximate: p.approximate,
          geom: multiPolygonToEWKT(f.geometry),
        },
      });
  }

  // routing_rules has no natural unique key in the schema beyond its serial
  // id, so re-running the seed clears this tenant's rules first (idempotent
  // by delete+insert rather than upsert).
  await pool.query(`DELETE FROM routing_rules WHERE tenant_id = $1`, [tenant.id]);
  const routingSeeds = readJson<RoutingSeed[]>(join(dir, "routing.json"));
  for (const r of routingSeeds) {
    await db.insert(routingRules).values({
      tenantId: r.tenant_id,
      categoryCode: r.category_code,
      boundaryId: r.boundary_id,
      agencyId: r.agency_id,
      department: r.department,
      firstRole: r.first_role,
      precedence: r.precedence,
    });
  }

  const slaSeeds = readJson<SlaSeed[]>(join(dir, "sla.json"));
  for (const s of slaSeeds) {
    await db
      .insert(slaPolicies)
      .values({
        tenantId: s.tenant_id,
        categoryCode: s.category_code,
        resolveHours: s.resolve_hours,
        ladder: s.ladder,
      })
      .onConflictDoUpdate({
        target: [slaPolicies.tenantId, slaPolicies.categoryCode],
        set: { resolveHours: s.resolve_hours, ladder: s.ladder },
      });
  }

  await pool.query(`DELETE FROM pois WHERE tenant_id = $1`, [tenant.id]);
  const poiFeatures = readJson<{ features: PoiFeature[] }>(join(dir, "pois.geojson")).features;
  for (const f of poiFeatures) {
    await db.insert(pois).values({
      tenantId: tenant.id,
      kind: f.properties.kind,
      name: f.properties.name,
      geom: pointToEWKT(f.geometry),
    });
  }

  console.log(
    `✅ tenant ${tenant.id}: ${agencySeeds.length} agencies, ${boundaryFeatures.length} boundaries, ${routingSeeds.length} routing rules, ${slaSeeds.length} SLA policies, ${poiFeatures.length} POIs`,
  );
}

// ── #B3: knowledge base chunks (embedded) ────────────────────────

async function seedKb(tenantDir: string, tenantId: string) {
  const kbDir = join(DATA_ROOT, "tenants", tenantDir, "kb");
  let files: string[];
  try {
    files = readdirSync(kbDir).filter((f) => f.endsWith(".md")).sort();
  } catch {
    console.log(`⚪ no kb/ directory for ${tenantId}, skipping`);
    return;
  }

  // Idempotent: clear this tenant's chunks and re-insert.
  await pool.query(`DELETE FROM kb_chunks WHERE tenant_id = $1`, [tenantId]);

  for (const file of files) {
    const body = readFileSync(join(kbDir, file), "utf8");
    const categoryCode = file.replace(/\.md$/, "");
    const embedding = await embedText(body);
    await db.insert(kbChunks).values({
      tenantId,
      categoryCode,
      body,
      embedding,
    });
  }
  console.log(`✅ ${files.length} KB chunks embedded for ${tenantId}`);
}

// ── #B4: historical tickets (precedent + ETA data) ───────────────

interface HistoryRow {
  public_code: string;
  tenant_id: string;
  category_code: string;
  boundary_id: string;
  lng: number;
  lat: number;
  created_at: string;
  resolved_at: string;
  closed_at: string;
  summary_officer_en: string;
  severity: number;
}

async function seedHistory(tenantDir: string, tenantId: string) {
  const path = join(DATA_ROOT, "tenants", tenantDir, "history.jsonl");
  let lines: string[];
  try {
    lines = readFileSync(path, "utf8").trim().split("\n").filter(Boolean);
  } catch {
    console.log(`⚪ no history.jsonl for ${tenantId}, skipping`);
    return;
  }

  await pool.query(
    `DELETE FROM events WHERE ticket_id IN (SELECT id FROM tickets WHERE tenant_id = $1 AND public_code LIKE 'BHI-25-%')`,
    [tenantId],
  );
  await pool.query(
    `DELETE FROM tickets WHERE tenant_id = $1 AND public_code LIKE 'BHI-25-%'`,
    [tenantId],
  );

  // A single synthetic "system" citizen owns every seeded historical report
  // (we don't need per-citizen identity for precedent/ETA data).
  const seedCitizenToken = `seed-history-${tenantId}`;
  const [citizen] = await db
    .insert(citizens)
    .values({ deviceTokenHash: seedCitizenToken, lang: "hi" })
    .onConflictDoUpdate({ target: citizens.deviceTokenHash, set: { lang: "hi" } })
    .returning({ id: citizens.id });

  let count = 0;
  for (const line of lines) {
    const row = JSON.parse(line) as HistoryRow;
    const embedding = await embedText(row.summary_officer_en);
    const h3 = h3ForPoint(row.lat, row.lng);
    const slaDue = new Date(new Date(row.created_at).getTime() + 48 * 3600 * 1000);

    const [ticket] = await db
      .insert(tickets)
      .values({
        publicCode: row.public_code,
        tenantId: row.tenant_id,
        categoryCode: row.category_code,
        boundaryId: row.boundary_id,
        state: "CLOSED_CONFIRMED",
        priorityScore: "0",
        priorityBand: "Low",
        priorityTerms: {},
        severity: row.severity,
        geom: latLngToEWKT(row.lat, row.lng),
        h3R9: h3,
        embedding,
        summaryOfficerEn: row.summary_officer_en,
        slaDueAt: slaDue,
        createdAt: new Date(row.created_at),
        resolvedAt: new Date(row.resolved_at),
        closedAt: new Date(row.closed_at),
        lastEventSeq: 1,
      })
      .returning({ id: tickets.id });

    if (!ticket) continue;

    const payload = {};
    const prevHash = "0";
    const hash = `seed-${row.public_code}`; // seed data isn't part of the live hash chain
    await db.insert(events).values({
      ticketId: ticket.id,
      seq: 1,
      type: "SEED_HISTORICAL_RECORD",
      toState: "CLOSED_CONFIRMED",
      actorType: "SYSTEM",
      actorId: "seed",
      payload,
      createdAt: new Date(row.closed_at),
      prevHash,
      hash,
    });
    count++;
  }
  console.log(`✅ ${count} historical tickets seeded for ${tenantId} (citizen ${citizen?.id})`);
}

// ── main ──────────────────────────────────────────────────────────

async function main() {
  await seedTaxonomy();

  const tenantsDir = join(DATA_ROOT, "tenants");
  const tenantDirs = readdirSync(tenantsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const tenantDir of tenantDirs) {
    const tenantJsonPath = join(tenantsDir, tenantDir, "tenant.json");
    try {
      readFileSync(tenantJsonPath);
    } catch {
      console.log(`⚪ ${tenantDir}: no tenant.json yet (see build map #B6), skipping`);
      continue;
    }
    await seedTenant(tenantDir);
    const tenantId = readJson<TenantSeed>(tenantJsonPath).id;
    await seedKb(tenantDir, tenantId);
    // SEED_SKIP_HISTORY=1: skip the 150 fake historical tickets (they need ~150 embedding calls, which a free Gemini key limits)
    if (!PROD && !process.env.SEED_SKIP_HISTORY) await seedHistory(tenantDir, tenantId);
  }

  await pool.end();
  console.log("✅ seed complete");
}

main().catch((err) => {
  console.error("❌ seed failed:", err);
  process.exit(1);
});

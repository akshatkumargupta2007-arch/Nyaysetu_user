// Build map #A4 — the data model from Bible §14.
// PostGIS geometry and pgvector columns use Drizzle's customType because
// drizzle-orm has no first-class column types for either extension yet.
import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  uuid,
  serial,
  bit,
  customType,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── custom column types ──────────────────────────────────────────

const geometryPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry(Point, 4326)";
  },
});

const geometryMultiPolygon = customType<{ data: string; driverData: string }>(
  {
    dataType() {
      return "geometry(MultiPolygon, 4326)";
    },
  },
);

function vector(dim: number) {
  return customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dim})`;
    },
    toDriver(value: number[]) {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string) {
      return value
        .slice(1, -1)
        .split(",")
        .map(Number);
    },
  })("embedding");
}

const EMBED_DIM = 768;

// ── tenancy & geography ──────────────────────────────────────────

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(), // 'cg.bhilai'
  name: jsonb("name").$type<{ hi: string; en: string }>().notNull(),
  stateCode: text("state_code").notNull(),
  lgdCode: integer("lgd_code"),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
});

export const agencies = pgTable("agencies", {
  id: text("id").primaryKey(), // 'cg.bhilai.bmc'
  tenantId: text("tenant_id").references(() => tenants.id),
  name: jsonb("name").$type<{ hi: string; en: string }>().notNull(),
  kind: text("kind").notNull(), // ULB | PARASTATAL | STATE_DEPT | NATIONAL | TOWNSHIP | CANTONMENT
});

export const boundaries = pgTable(
  "boundaries",
  {
    id: text("id").primaryKey(), // 'cg.bhilai.ward.14'
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    kind: text("kind").notNull(), // city | ward | sector | corridor | cantonment
    name: jsonb("name").$type<{ hi: string; en: string }>().notNull(),
    specificity: integer("specificity").notNull(),
    ownerAgencyId: text("owner_agency_id").references(() => agencies.id),
    approximate: boolean("approximate").notNull().default(false),
    geom: geometryMultiPolygon("geom").notNull(),
    // `centroid` (GEOMETRY GENERATED ALWAYS AS ST_PointOnSurface(geom) STORED)
    // is added by sql/0003_boundaries_centroid.sql, not modeled here —
    // Drizzle doesn't manage generated-column expressions well. Read via raw
    // SQL (see modules/jurisdiction/resolve.ts); never written directly.
  },
  (t) => ({
    geomIdx: index("boundaries_geom_idx").using("gist", t.geom),
  }),
);

export const pois = pgTable(
  "pois",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").references(() => tenants.id),
    kind: text("kind").notNull(), // school | hospital | bus_stand | market
    name: text("name"),
    geom: geometryPoint("geom").notNull(),
  },
  (t) => ({
    geomIdx: index("pois_geom_idx").using("gist", t.geom),
  }),
);

// ── taxonomy, routing, SLA ────────────────────────────────────────

export const categories = pgTable("categories", {
  code: text("code").primaryKey(), // 'WATER_NO_SUPPLY'
  l1: text("l1").notNull(),
  names: jsonb("names").$type<{ hi: string; en: string }>().notNull(),
  icon: text("icon").notNull(),
  defaultSeverity: integer("default_severity").notNull(),
  safetyHazards: text("safety_hazards").array().notNull().default([]),
  dedupRadiusM: integer("dedup_radius_m").notNull(),
  dedupWindowH: integer("dedup_window_h").notNull(),
  seasonal: jsonb("seasonal").$type<Record<string, number>>().notNull().default({}),
  mappings: jsonb("mappings").$type<Record<string, string>>().notNull().default({}),
});

export const routingRules = pgTable("routing_rules", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  categoryCode: text("category_code")
    .notNull()
    .references(() => categories.code),
  boundaryId: text("boundary_id").references(() => boundaries.id), // null = city-wide
  agencyId: text("agency_id")
    .notNull()
    .references(() => agencies.id),
  department: jsonb("department").$type<{ hi: string; en: string }>().notNull(),
  firstRole: text("first_role").notNull(),
  precedence: integer("precedence").notNull().default(0),
});

export const slaPolicies = pgTable(
  "sla_policies",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    categoryCode: text("category_code")
      .notNull()
      .references(() => categories.code),
    resolveHours: integer("resolve_hours").notNull(),
    ladder: jsonb("ladder")
      .$type<Array<{ after_h: number; role: string }>>()
      .notNull(),
  },
  (t) => ({
    pk: uniqueIndex("sla_policies_pk").on(t.tenantId, t.categoryCode),
  }),
);

// ── RAG knowledge ───────────────────────────────────────────────

export const kbChunks = pgTable(
  "kb_chunks",
  {
    id: serial("id").primaryKey(),
    tenantId: text("tenant_id").references(() => tenants.id), // null = national default
    categoryCode: text("category_code").references(() => categories.code),
    body: text("body").notNull(),
    tsv: text("tsv"), // generated column added in raw migration (to_tsvector)
    embedding: vector(EMBED_DIM).notNull(),
  },
  (t) => ({
    embeddingIdx: index("kb_chunks_embedding_idx").using(
      "hnsw",
      sql`${t.embedding} vector_cosine_ops`,
    ),
  }),
);

// ── people ──────────────────────────────────────────────────────

export const citizens = pgTable("citizens", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Legacy/seed only. Citizens are identified by phone (build map #D8): phone_hash is the account key.
  deviceTokenHash: text("device_token_hash").unique(),
  phoneHash: text("phone_hash"),
  phoneEnc: text("phone_enc"), // encrypted, base64
  lang: text("lang").notNull().default("hi"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const officers = pgTable("officers", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").references(() => tenants.id),
  agencyId: text("agency_id").references(() => agencies.id),
  role: text("role").notNull(),
  level: integer("level").notNull(),
  name: text("name").notNull(),
  passcodeHash: text("passcode_hash").notNull(),
});

// ── core: tickets (work orders) and reports (submissions) ───────

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicCode: text("public_code").notNull().unique(), // 'BHI-26-001041'
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    categoryCode: text("category_code")
      .notNull()
      .references(() => categories.code),
    boundaryId: text("boundary_id").references(() => boundaries.id),
    agencyId: text("agency_id").references(() => agencies.id),
    department: jsonb("department").$type<{ hi: string; en: string }>(),
    assigneeOfficerId: text("assignee_officer_id").references(() => officers.id),
    state: text("state").notNull(),
    escalationLevel: integer("escalation_level").notNull().default(0),
    priorityScore: numeric("priority_score", { precision: 5, scale: 2 }).notNull(),
    priorityBand: text("priority_band").notNull(),
    priorityTerms: jsonb("priority_terms").$type<Record<string, unknown>>().notNull(),
    severity: integer("severity").notNull(),
    hazards: text("hazards").array().notNull().default([]),
    reportCount: integer("report_count").notNull().default(1),
    geom: geometryPoint("geom").notNull(),
    h3R9: text("h3_r9").notNull(),
    embedding: vector(EMBED_DIM).notNull(),
    summaryOfficerEn: text("summary_officer_en").notNull(),
    parentTicketId: uuid("parent_ticket_id"),
    recurrenceOf: uuid("recurrence_of"),
    slaDueAt: timestamp("sla_due_at", { withTimezone: true }).notNull(),
    needsHumanTriage: boolean("needs_human_triage").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    lastEventSeq: integer("last_event_seq").notNull().default(0),
  },
  (t) => ({
    geomIdx: index("tickets_geom_idx").using("gist", t.geom),
    openH3Idx: index("tickets_open_h3_idx").on(t.tenantId, t.h3R9),
    embeddingIdx: index("tickets_embedding_idx").using(
      "hnsw",
      sql`${t.embedding} vector_cosine_ops`,
    ),
    slaIdx: index("tickets_sla_idx").on(t.tenantId, t.state, t.slaDueAt),
  }),
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id),
    citizenId: uuid("citizen_id")
      .notNull()
      .references(() => citizens.id),
    lang: text("lang").notNull(),
    originalText: text("original_text").notNull(), // verbatim, never overwritten
    inputMode: text("input_mode").notNull(), // voice | text
    summaryCitizen: text("summary_citizen").notNull(),
    understanding: jsonb("understanding").$type<Record<string, unknown>>().notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    geom: geometryPoint("geom").notNull(),
    locationMethod: text("location_method").notNull(),
    feedback: text("feedback"), // null | 'fixed' | 'not_fixed'
    feedbackAt: timestamp("feedback_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqueCitizenPerTicket: uniqueIndex("reports_ticket_citizen_uq").on(
      t.ticketId,
      t.citizenId,
    ),
  }),
);

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").references(() => tickets.id),
  reportId: uuid("report_id").references(() => reports.id),
  kind: text("kind").notNull(), // before | after | reopen
  cloudinaryPublicId: text("cloudinary_public_id").notNull(),
  dhash: bit("dhash", { dimensions: 64 }),
  exifGeom: geometryPoint("exif_geom"),
  exifTakenAt: timestamp("exif_taken_at", { withTimezone: true }),
  uploaderType: text("uploader_type").notNull(),
  uploaderId: text("uploader_id").notNull(),
  flags: text("flags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── ledger & operations ───────────────────────────────────────────

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id),
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    fromState: text("from_state"),
    toState: text("to_state"),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    prevHash: text("prev_hash").notNull(),
    hash: text("hash").notNull(),
  },
  (t) => ({
    uniqueSeq: uniqueIndex("events_ticket_seq_uq").on(t.ticketId, t.seq),
  }),
);
// NOTE: the `app_rw` database role must be granted SELECT, INSERT only on
// this table (no UPDATE/DELETE) — see infra/db migration 0002.

export const teamPositions = pgTable("team_positions", {
  id: serial("id").primaryKey(),
  ticketId: uuid("ticket_id").references(() => tickets.id),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  geom: geometryPoint("geom").notNull(),
});

export const ttsCache = pgTable("tts_cache", {
  key: text("key").primaryKey(),
  model: text("model"),
  voice: text("voice"),
  text: text("text"),
  url: text("url"),
  demoFallback: boolean("demo_fallback").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const aiCalls = pgTable("ai_calls", {
  id: serial("id").primaryKey(),
  provider: text("provider"),
  model: text("model"),
  purpose: text("purpose"),
  units: numeric("units"),
  latencyMs: integer("latency_ms"),
  ok: boolean("ok"),
  at: timestamp("at", { withTimezone: true }).defaultNow(),
});

export const voiceTurns = pgTable("voice_turns", {
  id: serial("id").primaryKey(),
  citizenId: uuid("citizen_id"),
  reportId: uuid("report_id"),
  transcript: text("transcript"),
  intent: text("intent"),
  facts: jsonb("facts").$type<Record<string, unknown>>(),
  answer: text("answer"),
  path: text("path"), // template | llm
  groundingOk: boolean("grounding_ok"),
  ttfaMs: integer("ttfa_ms"),
  at: timestamp("at", { withTimezone: true }).defaultNow(),
});

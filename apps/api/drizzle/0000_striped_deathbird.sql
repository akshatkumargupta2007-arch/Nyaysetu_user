CREATE TABLE "agencies" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text,
	"name" jsonb NOT NULL,
	"kind" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text,
	"model" text,
	"purpose" text,
	"units" numeric,
	"latency_ms" integer,
	"ok" boolean,
	"at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "boundaries" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" jsonb NOT NULL,
	"specificity" integer NOT NULL,
	"owner_agency_id" text,
	"approximate" boolean DEFAULT false NOT NULL,
	"geom" geometry(MultiPolygon, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"code" text PRIMARY KEY NOT NULL,
	"l1" text NOT NULL,
	"names" jsonb NOT NULL,
	"icon" text NOT NULL,
	"default_severity" integer NOT NULL,
	"safety_hazards" text[] DEFAULT '{}' NOT NULL,
	"dedup_radius_m" integer NOT NULL,
	"dedup_window_h" integer NOT NULL,
	"seasonal" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mappings" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citizens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_token_hash" text NOT NULL,
	"phone_hash" text,
	"phone_enc" text,
	"lang" text DEFAULT 'hi' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "citizens_device_token_hash_unique" UNIQUE("device_token_hash")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"from_state" text,
	"to_state" text,
	"actor_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text,
	"category_code" text,
	"body" text NOT NULL,
	"tsv" text,
	"embedding" vector(768) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid,
	"report_id" uuid,
	"kind" text NOT NULL,
	"cloudinary_public_id" text NOT NULL,
	"dhash" bit(64),
	"exif_geom" geometry(Point, 4326),
	"exif_taken_at" timestamp with time zone,
	"uploader_type" text NOT NULL,
	"uploader_id" text NOT NULL,
	"flags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "officers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text,
	"agency_id" text,
	"role" text NOT NULL,
	"level" integer NOT NULL,
	"name" text NOT NULL,
	"passcode_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pois" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text,
	"kind" text NOT NULL,
	"name" text,
	"geom" geometry(Point, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"citizen_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"original_text" text NOT NULL,
	"input_mode" text NOT NULL,
	"summary_citizen" text NOT NULL,
	"understanding" jsonb NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"geom" geometry(Point, 4326) NOT NULL,
	"location_method" text NOT NULL,
	"feedback" text,
	"feedback_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "routing_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"category_code" text NOT NULL,
	"boundary_id" text,
	"agency_id" text NOT NULL,
	"department" jsonb NOT NULL,
	"first_role" text NOT NULL,
	"precedence" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_policies" (
	"tenant_id" text NOT NULL,
	"category_code" text NOT NULL,
	"resolve_hours" integer NOT NULL,
	"ladder" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"geom" geometry(Point, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" jsonb NOT NULL,
	"state_code" text NOT NULL,
	"lgd_code" integer,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_code" text NOT NULL,
	"tenant_id" text NOT NULL,
	"category_code" text NOT NULL,
	"boundary_id" text,
	"agency_id" text,
	"department" jsonb,
	"assignee_officer_id" text,
	"state" text NOT NULL,
	"escalation_level" integer DEFAULT 0 NOT NULL,
	"priority_score" numeric(5, 2) NOT NULL,
	"priority_band" text NOT NULL,
	"priority_terms" jsonb NOT NULL,
	"severity" integer NOT NULL,
	"hazards" text[] DEFAULT '{}' NOT NULL,
	"report_count" integer DEFAULT 1 NOT NULL,
	"geom" geometry(Point, 4326) NOT NULL,
	"h3_r9" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"summary_officer_en" text NOT NULL,
	"parent_ticket_id" uuid,
	"recurrence_of" uuid,
	"sla_due_at" timestamp with time zone NOT NULL,
	"needs_human_triage" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"last_event_seq" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tickets_public_code_unique" UNIQUE("public_code")
);
--> statement-breakpoint
CREATE TABLE "tts_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"model" text,
	"voice" text,
	"text" text,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "voice_turns" (
	"id" serial PRIMARY KEY NOT NULL,
	"citizen_id" uuid,
	"report_id" uuid,
	"transcript" text,
	"intent" text,
	"facts" jsonb,
	"answer" text,
	"path" text,
	"grounding_ok" boolean,
	"ttfa_ms" integer,
	"at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boundaries" ADD CONSTRAINT "boundaries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boundaries" ADD CONSTRAINT "boundaries_owner_agency_id_agencies_id_fk" FOREIGN KEY ("owner_agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_category_code_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "public"."categories"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "officers" ADD CONSTRAINT "officers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "officers" ADD CONSTRAINT "officers_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pois" ADD CONSTRAINT "pois_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_citizen_id_citizens_id_fk" FOREIGN KEY ("citizen_id") REFERENCES "public"."citizens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_category_code_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "public"."categories"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_boundary_id_boundaries_id_fk" FOREIGN KEY ("boundary_id") REFERENCES "public"."boundaries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_rules" ADD CONSTRAINT "routing_rules_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_category_code_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "public"."categories"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_positions" ADD CONSTRAINT "team_positions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_code_categories_code_fk" FOREIGN KEY ("category_code") REFERENCES "public"."categories"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_boundary_id_boundaries_id_fk" FOREIGN KEY ("boundary_id") REFERENCES "public"."boundaries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_agency_id_agencies_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_officer_id_officers_id_fk" FOREIGN KEY ("assignee_officer_id") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boundaries_geom_idx" ON "boundaries" USING gist ("geom");--> statement-breakpoint
CREATE UNIQUE INDEX "events_ticket_seq_uq" ON "events" USING btree ("ticket_id","seq");--> statement-breakpoint
CREATE INDEX "kb_chunks_embedding_idx" ON "kb_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "pois_geom_idx" ON "pois" USING gist ("geom");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_ticket_citizen_uq" ON "reports" USING btree ("ticket_id","citizen_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sla_policies_pk" ON "sla_policies" USING btree ("tenant_id","category_code");--> statement-breakpoint
CREATE INDEX "tickets_geom_idx" ON "tickets" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "tickets_open_h3_idx" ON "tickets" USING btree ("tenant_id","h3_r9");--> statement-breakpoint
CREATE INDEX "tickets_embedding_idx" ON "tickets" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "tickets_sla_idx" ON "tickets" USING btree ("tenant_id","state","sla_due_at");
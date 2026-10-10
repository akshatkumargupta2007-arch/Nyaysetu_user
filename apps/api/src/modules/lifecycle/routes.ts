// Build map #E1, #E2, #E5 — Lifecycle routes (verify-chain, transitions, confirm, and SSE stream).
import { z } from "zod";
import type { AppInstance } from "../../types.js";
import { pool } from "../../db/client.js";
import { latLngToEWKT } from "../../db/geo.js";
import { h3ForPoint } from "../../lib/h3.js";
import { citizenAuth, requireCitizenAuth, citizenOwnsTicket, readClaims, UUID_RE } from "../auth/middleware.js";
import { requireOfficerAuth } from "../officers/auth.js";
import { transition, appendEvent, IllegalTransitionError, TicketNotFoundError } from "./transition.js";
import { verifyEventChain } from "./verify.js";
import type { ActorType, State } from "./types.js";
import { env } from "../../env.js";
import { etaText as estimateEtaText } from "./eta.js";

interface StoredDraft {
  request: { text: string; lang: string; lat: number; lng: number; inputMode: "voice" | "text" };
  response: import("../intelligence/orchestrate.js").UnderstandResponse;
  locationMethod: string;
  embedding: number[];
}

const TransitionBody = z.object({
  toState: z.enum([
    "SUBMITTED",
    "VERIFIED",
    "NEEDS_TRIAGE",
    "ASSIGNED",
    "TRANSFERRED",
    "DISPATCHED",
    "WORK_DONE_PENDING_CONFIRMATION",
    "CLOSED_CONFIRMED",
    "CLOSED_UNCONFIRMED",
    "REOPENED",
    "REJECTED_NOT_CIVIC",
  ]),
  actor: z.object({
    type: z.enum(["SYSTEM", "CITIZEN", "OFFICER", "FIELD"]),
    id: z.string().min(1),
  }),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

// The client sends ONLY which draft to file (+ optional photo). Category, agency, priority,
// location and text all come from the server-stored draft written by /reports/understand.
const ConfirmReportBody = z.object({
  draftId: z.string().uuid(),
  photoPublicId: z.string().max(300).optional(),
  photoDhash: z.string().regex(/^[01]{64}$/).optional(),
});

export function registerLifecycleRoutes(app: AppInstance) {
  // ── GET /reports/:id/stream (#E5) ────────────────────────────────────────
  // Server-Sent Events endpoint for real-time tracking updates.
  // Scoped by the citizen JWT (?token= because EventSource can't set headers) — the citizen can only stream their own tickets.
  // Uses Postgres LISTEN/NOTIFY: transition() calls NOTIFY after every commit.
  //
  // Message types pushed to the client:
  //   { event: "snapshot", data: TrackingView }      — initial + after reconnect
  //   { event: "state",    data: { toState } }       — on state change
  //   { event: "timeline_event", data: TimelineEntry } — on new ledger event
  //   : ping                                          — keepalive every 15 s
  app.get(
    "/reports/:id/stream",
    {
      preValidation: [citizenAuth({ allowQueryToken: true })],
      schema: {
        params: z.object({ id: z.string() }),
      },
    },
    async (req, reply) => {
      const ticketId = req.params.id;

      // Auth is enforced by preValidation (citizenAuth, query-token allowed for EventSource).
      const citizenId = req.citizen!.id;
      if (!(await citizenOwnsTicket(citizenId, ticketId))) {
        return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
      }

      // ── SSE headers ───────────────────────────────────────────────────────
      void reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",       // Prevents nginx from buffering the stream
        "Access-Control-Allow-Origin": "*",
      });

      // Helper to write a named SSE message
      const sendEvent = (event: string, data: unknown) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // Helper to build the tracking snapshot (same logic as GET /tickets/:id/tracking)
      const buildSnapshot = async () => {
        try {
          const ticketRes = await pool.query<{
            id: string;
            public_code: string;
            category_code: string;
            state: string;
            agency_id: string;
            department: any;
            sla_due_at: string;
            created_at: string;
            priority_band: string;
            lat: number;
            lng: number;
          }>(
            `SELECT id, public_code, category_code, state, agency_id, department, sla_due_at, created_at, priority_band,
                    ST_Y(geom::geometry) as lat, ST_X(geom::geometry) as lng
             FROM tickets WHERE id = $1`,
            [ticketId],
          );
          if (ticketRes.rows.length === 0) return null;
          const ticket = ticketRes.rows[0]!;

          const reportRes = await pool.query<{ summary_citizen: string, understanding: any }>(
            `SELECT summary_citizen, understanding FROM reports WHERE ticket_id = $1 ORDER BY created_at ASC LIMIT 1`,
            [ticketId],
          );
          const summary = reportRes.rows[0]?.summary_citizen || "No details";
          const beforePhotoUrl = reportRes.rows[0]?.understanding?.photoUrl || "https://res.cloudinary.com/demo/image/upload/sample.jpg"; // Mock if absent for demo

          const eventsRes = await pool.query<{
            type: string;
            from_state: State | null;
            to_state: State | null;
            actor_type: string;
            actor_id: string;
            payload: any;
            created_at: string;
          }>(
            `SELECT type, from_state, to_state, actor_type, actor_id, payload, created_at
             FROM events WHERE ticket_id = $1 ORDER BY seq ASC`,
            [ticketId],
          );

          const { buildCitizenTimeline, mapInternalStateToCitizenStage } = await import("./citizenView.js");
          const timeline = buildCitizenTimeline(eventsRes.rows);
          const stage = mapInternalStateToCitizenStage(ticket.state as State);

          const etaText = estimateEtaText({ categoryCode: ticket.category_code, priorityBand: ticket.priority_band, state: ticket.state, createdAt: ticket.created_at, slaDueAt: ticket.sla_due_at });

          return {
            id: ticket.id,
            publicCode: ticket.public_code,
            categoryCode: ticket.category_code,
            summary,
            internalState: ticket.state,
            stage,
            timeline,
            agencyId: ticket.agency_id,
            department: ticket.department,
            lat: ticket.lat,
            lng: ticket.lng,
            etaText,
            beforePhotoUrl,
            afterPhotoUrl: [...eventsRes.rows].reverse().find(e => e.to_state === "WORK_DONE_PENDING_CONFIRMATION")?.payload?.afterPhotoUrl || null,
            lastUpdated:
              eventsRes.rows.length > 0
                ? eventsRes.rows[eventsRes.rows.length - 1]!.created_at
                : new Date().toISOString(),
          };
        } catch {
          return null;
        }
      };

      // ── Send initial snapshot ─────────────────────────────────────────────
      const snapshot = await buildSnapshot();
      if (snapshot) {
        sendEvent("snapshot", snapshot);
      }

      // ── Set up LISTEN on a dedicated pg client ───────────────────────────
      let listenClient: import("pg").PoolClient | null = null;
      const channel = `ticket_${ticketId.replace(/-/g, "_")}`;

      const cleanup = () => {
        clearInterval(pingTimer);
        if (listenClient) {
          listenClient.removeAllListeners("notification");
          // UNLISTEN then release — best effort
          listenClient.query(`UNLISTEN "${channel}"`).catch(() => null).finally(() => {
            listenClient?.release();
            listenClient = null;
          });
        }
      };

      req.raw.on("close", cleanup);
      req.raw.on("error", cleanup);

      // ── Keepalive ping (prevents Cloudflare 100s idle timeout) ──────────
      const pingTimer = setInterval(() => {
        try {
          reply.raw.write(": ping\n\n");
        } catch {
          cleanup();
        }
      }, 15_000);

      // ── Attempt LISTEN/NOTIFY subscription ───────────────────────────────
      try {
        listenClient = await pool.connect();
        await listenClient.query(`LISTEN "${channel}"`);

        listenClient.on("notification", async (msg) => {
          if (msg.channel !== channel) return;
          let parsed: { type: string; toState?: string; lat?: number; lng?: number; eta?: string } | null = null;
          try {
            parsed = JSON.parse(msg.payload ?? "{}");
          } catch {
            return;
          }

          if (parsed?.type === "team_position" && parsed.lat !== undefined && parsed.lng !== undefined) {
             sendEvent("team_position", { lat: parsed.lat, lng: parsed.lng, eta: parsed.eta });
             return; // Avoid triggering a full snapshot build on high-frequency position ticks
          }

          // Always push a fresh snapshot so the client has complete, consistent data.
          // Also push the lightweight typed message so the client can update the UI
          // incrementally without waiting for the snapshot fetch to complete.
          if (parsed?.type === "state" && parsed.toState) {
            sendEvent("state", { toState: parsed.toState });
          }

          const fresh = await buildSnapshot();
          if (fresh) {
            sendEvent("snapshot", fresh);
          }
        });
      } catch {
        // DB unavailable — stream still works via snapshot-only / polling fallback
        // The client will reconnect via EventSource and get a fresh snapshot each time.
      }
    },
  );

  // ── GET /tickets/:id/verify-chain (#E2) ──────────────────────────────────
  app.get(
    "/tickets/:id/verify-chain",
    {
      schema: {
        params: z.object({ id: z.string() }),
      },
    },
    async (req, reply) => {
      try {
        const result = await verifyEventChain(req.params.id);
        if (result.ok) {
          return reply.status(200).send({ ok: true, count: result.count });
        } else {
          return reply.status(200).send({
            ok: false,
            broken_at: result.brokenAt,
            reason: result.reason,
          });
        }
      } catch (err) {
        return reply.status(500).send({ error: (err as Error).message });
      }
    },
  );

  // ── GET /tickets/:id/tracking (#E4) ───────────────────────────────────────
  app.get(
    "/tickets/:id/tracking",
    {
      schema: {
        params: z.object({ id: z.string() }),
      },
    },
    async (req, reply) => {
      // Citizens may read only their own tickets; officers may read any in their console.
      const claims = readClaims(req);
      if (!claims || (claims.kind !== "citizen" && claims.kind !== "officer")) {
        return reply.status(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
      }
      if (!UUID_RE.test(req.params.id)) {
        return reply.status(404).send({ error: "Ticket not found", code: "TICKET_NOT_FOUND" });
      }
      if (claims.kind === "citizen" && !(await citizenOwnsTicket(claims.id, req.params.id))) {
        return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
      }
      try {
        const ticketRes = await pool.query<{
          id: string;
          public_code: string;
          category_code: string;
          state: string;
          agency_id: string;
          department: any;
          sla_due_at: string;
          created_at: string;
          priority_band: string;
          category_names: { hi: string; en: string } | null;
          place: { hi: string; en: string } | null;
          lat: number;
          lng: number;
        }>(
          `SELECT id, public_code, category_code, state, agency_id, department, sla_due_at, created_at, priority_band,
                  (SELECT names FROM categories c WHERE c.code = tickets.category_code) AS category_names,
                  (SELECT name FROM boundaries b WHERE b.id = tickets.boundary_id) AS place,
                  ST_Y(geom::geometry) as lat, ST_X(geom::geometry) as lng
           FROM tickets WHERE id = $1`,
          [req.params.id]
        );

        if (ticketRes.rows.length === 0) {
          return reply.status(404).send({ error: "Ticket not found", code: "NOT_FOUND" });
        }

        const ticket = ticketRes.rows[0]!;

        const reportRes = await pool.query<{ summary_citizen: string }>(
          `SELECT summary_citizen FROM reports WHERE ticket_id = $1 ORDER BY created_at ASC LIMIT 1`,
          [req.params.id]
        );
        const summary = reportRes.rows[0]?.summary_citizen || "No details";

        const eventsRes = await pool.query<{
          type: string;
          from_state: State | null;
          to_state: State | null;
          actor_type: string;
          actor_id: string;
          payload: any;
          created_at: string;
        }>(
          `SELECT type, from_state, to_state, actor_type, actor_id, payload, created_at
           FROM events WHERE ticket_id = $1 ORDER BY seq ASC`,
          [req.params.id]
        );

        // Dynamic imports to avoid top-level circular issues, or we can just import them at the top.
        // I will use them via require or dynamic import if they aren't imported.
        const { buildCitizenTimeline, mapInternalStateToCitizenStage } = await import("./citizenView.js");

        const timeline = buildCitizenTimeline(eventsRes.rows);
        const stage = mapInternalStateToCitizenStage(ticket.state as State);

        const etaText = estimateEtaText({ categoryCode: ticket.category_code, priorityBand: ticket.priority_band, state: ticket.state, createdAt: ticket.created_at, slaDueAt: ticket.sla_due_at });

        return reply.status(200).send({
          id: ticket.id,
          publicCode: ticket.public_code,
          categoryCode: ticket.category_code,
          categoryNames: ticket.category_names,
          place: ticket.place,
          summary,
          internalState: ticket.state,
          stage,
          timeline,
          agencyId: ticket.agency_id,
          department: ticket.department,
          lat: ticket.lat,
          lng: ticket.lng,
          etaText,
          lastUpdated: eventsRes.rows.length > 0 ? eventsRes.rows[eventsRes.rows.length - 1]!.created_at : new Date().toISOString(),
        });
      } catch (err) {
        return reply.status(500).send({ error: String(err) });
      }
    }
  );

  // ── POST /tickets/:id/transition (#E1) ──────────────────────────────────
  app.post(
    "/tickets/:id/transition",
    {
      preValidation: [requireOfficerAuth],
      schema: {
        params: z.object({ id: z.string() }),
        body: TransitionBody,
      },
    },
    async (req, reply) => {
      if (!UUID_RE.test(req.params.id)) {
        return reply.status(404).send({ error: "Ticket not found", code: "TICKET_NOT_FOUND" });
      }
      try {
        const { toState, payload } = req.body;
        // The actor comes from the verified token, never from the request body
        // (a client must not be able to claim to be a citizen or the system).
        const officer = req.officer!;
        const actorType: ActorType = String(officer.role).toUpperCase().includes("FIELD") ? "FIELD" : "OFFICER";
        const res = await transition(
          req.params.id,
          toState as State,
          { type: actorType, id: officer.id },
          payload,
        );
        return reply.status(200).send(res);
      } catch (err) {
        if (err instanceof IllegalTransitionError) {
          return reply.status(409).send({
            error: err.message,
            code: err.code,
            fromState: err.fromState,
            toState: err.toState,
          });
        }
        if (err instanceof TicketNotFoundError) {
          return reply.status(404).send({ error: err.message, code: err.code });
        }
        const msg = String(err);
        if (msg.includes("ECONNREFUSED") || (err as { code?: string }).code === "ECONNREFUSED") {
          return reply.status(404).send({ error: "Ticket not found", code: "TICKET_NOT_FOUND" });
        }
        throw err;
      }
    },
  );

  // ── POST /reports/confirm (#E1 / #D7) ────────────────────────────────────
  // Files the server-stored draft: attaches to an open duplicate ticket if one exists
  // (one work order, many voices), otherwise creates a ticket; always creates this
  // citizen's report. Requires login (Phone + OTP).
  app.post(
    "/reports/confirm",
    {
      preValidation: [requireCitizenAuth],
      schema: { body: ConfirmReportBody },
    },
    async (req, reply) => {
      const citizenId = req.citizen!.id;
      const { draftId, photoPublicId, photoDhash } = req.body;

      const draftRes = await pool.query<{ payload: StoredDraft }>(
        `SELECT payload FROM report_drafts WHERE id = $1 AND created_at > now() - interval '2 hours'`,
        [draftId],
      );
      if (draftRes.rows.length === 0) {
        return reply.status(410).send({ error: "Draft expired or not found", code: "DRAFT_GONE" });
      }
      const draft = draftRes.rows[0]!.payload;
      const { request: r, response: u, embedding } = draft;
      const geom = latLngToEWKT(r.lat, r.lng);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Same citizen filing the same draft twice must not create a second report.
        const already = await client.query<{ ticket_id: string; public_code: string; id: string; state: string }>(
          `SELECT r.id, r.ticket_id, t.public_code, t.state
           FROM reports r JOIN tickets t ON t.id = r.ticket_id
           WHERE r.citizen_id = $1 AND r.understanding->>'draftId' = $2`,
          [citizenId, draftId],
        );
        if (already.rows[0]) {
          await client.query("ROLLBACK");
          const a = already.rows[0];
          return reply.status(200).send({ ok: true, ticketId: a.ticket_id, publicCode: a.public_code, reportId: a.id, state: a.state, merged: false, alreadyFiled: true });
        }

        // Is the duplicate the preview found still open?
        let ticketId: string | null = null;
        let publicCode = "";
        let merged = false;
        if (u.duplicateOf) {
          const open = await client.query<{ id: string; public_code: string }>(
            `SELECT id, public_code FROM tickets
             WHERE id = $1 AND state NOT IN ('CLOSED_CONFIRMED','CLOSED_UNCONFIRMED','REJECTED_NOT_CIVIC') FOR UPDATE`,
            [u.duplicateOf.ticketId],
          );
          if (open.rows[0]) {
            const mine = await client.query<{ id: string }>(
              `SELECT id FROM reports WHERE ticket_id = $1 AND citizen_id = $2`, [open.rows[0].id, citizenId]);
            if (mine.rows[0]) {
              await client.query("ROLLBACK");
              return reply.status(200).send({ ok: true, ticketId: open.rows[0].id, publicCode: open.rows[0].public_code, reportId: mine.rows[0].id, merged: false, alreadyFiled: true });
            }
            ticketId = open.rows[0].id;
            publicCode = open.rows[0].public_code;
            merged = true;
          }
        }

        if (!ticketId) {
          const sla = await client.query<{ resolve_hours: number }>(
            `SELECT resolve_hours FROM sla_policies WHERE tenant_id = $1 AND category_code = $2`,
            [u.tenantId, u.understanding.category_code],
          );
          const slaHours = sla.rows[0]?.resolve_hours ?? 48;
          publicCode = `BHI-26-${Math.floor(100000 + Math.random() * 900000)}`;
          const needsTriage = u.routing.needsHumanTriage || u.gate === "clarify";

          const t = await client.query<{ id: string }>(
            `INSERT INTO tickets (
               public_code, tenant_id, category_code, boundary_id, agency_id, department, state,
               priority_score, priority_band, priority_terms, severity, hazards, report_count,
               geom, h3_r9, embedding, summary_officer_en, sla_due_at, needs_human_triage
             ) VALUES ($1,$2,$3,$4,$5,$6,'SUBMITTED',$7,$8,$9,$10,$11,1,$12,$13,$14,$15,$16,$17) RETURNING id`,
            [
              publicCode, u.tenantId, u.understanding.category_code, u.boundaryId, u.routing.agencyId,
              u.routing.department ? JSON.stringify(u.routing.department) : null,
              String(u.priority.score), u.priority.band, JSON.stringify(u.priority.terms),
              u.understanding.severity_0_100, u.understanding.hazards, geom, h3ForPoint(r.lat, r.lng),
              `[${embedding.join(",")}]`,
              u.understanding.summary_officer_en || r.text.slice(0, 100),
              new Date(Date.now() + slaHours * 3600 * 1000), needsTriage,
            ],
          );
          ticketId = t.rows[0]!.id;
        }

        const rep = await client.query<{ id: string }>(
          `INSERT INTO reports (ticket_id, citizen_id, lang, original_text, input_mode, summary_citizen,
             understanding, confidence, geom, location_method)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [
            ticketId, citizenId, r.lang, r.text, r.inputMode, u.understanding.summary_citizen || r.text,
            JSON.stringify({ ...u.understanding, draftId }), String(u.confidence), geom, draft.locationMethod,
          ],
        );
        const reportId = rep.rows[0]!.id;

        if (photoPublicId) {
          await client.query(
            `INSERT INTO media (ticket_id, report_id, kind, cloudinary_public_id, dhash, uploader_type, uploader_id)
             VALUES ($1,$2,'before',$3,$4::bit(64),'CITIZEN',$5)`,
            [ticketId, reportId, photoPublicId, photoDhash ?? null, citizenId],
          );
        }

        if (merged) {
          // Second (third, …) voice on the same problem: count distinct citizens only.
          await client.query(
            `UPDATE tickets SET report_count = (SELECT count(DISTINCT citizen_id) FROM reports WHERE ticket_id = $1) WHERE id = $1`,
            [ticketId],
          );
          await appendEvent(ticketId, "REPORT_MERGED", { type: "CITIZEN", id: citizenId }, { reportId, text: r.text }, client);
        } else {
          await appendEvent(ticketId, "REPORT_CREATED", { type: "CITIZEN", id: citizenId }, { reportId, publicCode, text: r.text }, client);
          if (u.routing.needsHumanTriage || u.gate === "clarify") {
            await transition(ticketId, "NEEDS_TRIAGE", { type: "SYSTEM", id: "system" }, { reason: "low_confidence_or_no_routing" }, client);
          } else {
            await transition(ticketId, "VERIFIED", { type: "SYSTEM", id: "system" }, { confidence: u.confidence }, client);
            if (u.routing.agencyId) {
              await transition(ticketId, "ASSIGNED", { type: "SYSTEM", id: "system" }, { agencyId: u.routing.agencyId, department: u.routing.department }, client);
            }
          }
        }

        await client.query("COMMIT");
        const final = await pool.query<{ state: string; last_event_seq: number; report_count: number }>(
          `SELECT state, last_event_seq, report_count FROM tickets WHERE id = $1`, [ticketId],
        );
        return reply.status(201).send({
          ok: true, ticketId, publicCode, reportId, merged,
          reportCount: final.rows[0]!.report_count,
          state: final.rows[0]!.state, lastEventSeq: final.rows[0]!.last_event_seq,
        });
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err; // never fake a success: the citizen must know it was NOT filed
      } finally {
        client.release();
      }
    },
  );

  // ── GET /demo/trip/:ticketId (#E6) ───────────────────────────────────────
  // Background simulation for demo field team movement.
  app.post(
    "/demo/trip/:ticketId",
    {
      schema: {
        params: z.object({ ticketId: z.string().uuid() }),
        body: z.object({ key: z.string() }).optional(),
      },
    },
    async (req, reply) => {
      const { ticketId } = req.params;
      const key = req.body?.key;

      if (!env.DEMO_MODE) {
        return reply.status(403).send({ error: "Not in demo mode", code: "NOT_DEMO" });
      }
      if (env.DEMO_KEY && key !== env.DEMO_KEY) {
        return reply.status(401).send({ error: "Invalid demo key", code: "UNAUTHORIZED" });
      }

      // Check ticket and get destination coordinates
      let destLat: number;
      let destLng: number;
      
      const client = await pool.connect();
      try {
        const res = await client.query<{ lat: number, lng: number }>(
          `SELECT ST_Y(geom::geometry) as lat, ST_X(geom::geometry) as lng FROM tickets WHERE id = $1`,
          [ticketId],
        );
        if (res.rows.length === 0) {
          return reply.status(404).send({ error: "Ticket not found", code: "NOT_FOUND" });
        }
        destLat = res.rows[0]!.lat;
        destLng = res.rows[0]!.lng;
      } finally {
        client.release();
      }

      // Spawn background worker to simulate trip
      void reply.status(202).send({ ok: true, status: "Trip simulation started" });

      // Run asynchronously (fire and forget)
      void (async () => {
        // Start roughly 2km away from the destination
        // 2km in degrees is roughly 0.018 lat/lng depending on latitude
        let currentLat = destLat - 0.012;
        let currentLng = destLng - 0.012;

        const speedKmH = 25; // km/h
        const speedMS = (speedKmH * 1000) / 3600; // ~6.94 m/s
        const stepSeconds = 3;
        const stepMeters = speedMS * stepSeconds; // ~20.8 meters per step

        let distance = 2000; // Starting with a fixed synthetic distance (m)

        while (distance > 20) {
          const dLat = destLat - currentLat;
          const dLng = destLng - currentLng;
          
          // distance is approx hypotenuse * 111000 meters (rough estimate for India latitude)
          const approxDistM = Math.sqrt(dLat * dLat + dLng * dLng) * 111000;
          distance = approxDistM;

          if (distance < stepMeters) {
            currentLat = destLat;
            currentLng = destLng;
            distance = 0;
          } else {
            const ratio = stepMeters / distance;
            currentLat += dLat * ratio;
            currentLng += dLng * ratio;
          }

          const etaMins = Math.max(1, Math.ceil((distance / speedMS) / 60));

          const simClient = await pool.connect();
          try {
            await simClient.query("BEGIN");
            await simClient.query(
              `INSERT INTO team_positions (ticket_id, geom, at) VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), NOW())`,
              [ticketId, currentLng, currentLat],
            );
            
            const payload = JSON.stringify({
              type: "team_position",
              lat: currentLat,
              lng: currentLng,
              eta: `${etaMins} mins`
            });
            await simClient.query(`NOTIFY "ticket_${ticketId.replace(/-/g, "_")}", $1`, [payload]);
            await simClient.query("COMMIT");
          } catch (e) {
            await simClient.query("ROLLBACK");
            break; // Stop on DB error
          } finally {
            simClient.release();
          }

          if (distance <= 0) {
            // Reached destination. Fire state transition!
            try {
              await transition(
                ticketId,
                "WORK_DONE_PENDING_CONFIRMATION",
                { type: "OFFICER", id: "demo-officer" },
                {
                  note: "Fixed during demo simulation",
                  afterPhotoUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg"
                }
              );
            } catch (err) {
              console.error("Demo transition failed:", err);
            }
            break;
          }

          await new Promise((r) => setTimeout(r, stepSeconds * 1000));
        }
      })();
    }
  );

  // ── POST /reports/:id/confirm-closure (#E7) ───────────────────────────
  // Citizen confirms or rejects the fix.
  app.post(
    "/reports/:id/confirm-closure",
    {
      preValidation: [requireCitizenAuth],
      schema: {
        params: z.object({ id: z.string().uuid() }), // frontend usually passes ticketId here
        body: z.object({
          confirmed: z.boolean(),
          note: z.string().max(2000).optional(), // typed text, or the transcript of a spoken answer
          photoUrl: z.string().optional(),
          photoPublicId: z.string().max(300).optional(), // Cloudinary public id of the new photo (re-report)
        }),
      },
    },
    async (req, reply) => {
      const ticketId = req.params.id; // in tracking screen, id is ticket id
      const citizenId = req.citizen!.id;
      const { confirmed, note, photoUrl, photoPublicId } = req.body;
      // Only the citizen who reported it may confirm or reject the fix (Bible: closure gate).
      if (!(await citizenOwnsTicket(citizenId, ticketId))) {
        return reply.status(403).send({ error: "Forbidden", code: "FORBIDDEN" });
      }
      
      const toState = confirmed ? "CLOSED_CONFIRMED" : "REOPENED";
      const payload: any = {};
      if (note) payload.note = note;
      if (photoUrl) payload.photoUrl = photoUrl;
      if (photoPublicId) payload.hasPhoto = true;

      try {
        const res = await transition(
          ticketId,
          toState,
          { type: "CITIZEN", id: citizenId },
          payload
        );
        // A re-report from the "No, still not fixed" screen: the new photo goes on the SAME ticket as 'reopen' media.
        if (!confirmed && photoPublicId) {
          await pool.query(
            `INSERT INTO media (ticket_id, report_id, kind, cloudinary_public_id, uploader_type, uploader_id)
             VALUES ($1, (SELECT id FROM reports WHERE ticket_id = $1 AND citizen_id = $2), 'reopen', $3, 'CITIZEN', $2)`,
            [ticketId, citizenId, photoPublicId],
          );
        }
        return reply.status(200).send({ ok: true, state: res.toState });
      } catch (err: any) {
        return reply.status(400).send({ error: err.message, code: err.code });
      }
    }
  );

  // #E8: Demo Clock endpoint to fast-forward time
  app.post(
    "/demo/clock",
    {
      schema: {
        body: z.object({
          hours: z.number().positive(),
        }),
      },
    },
    async (req, reply) => {
      if (!env.DEMO_MODE) {
        return reply.status(403).send({ error: "Demo mode disabled" });
      }
      
      const { hours } = req.body;
      const intervalStr = `${hours} hours`;

      // Fast-forward tickets by moving created_at and sla_due_at backward
      await pool.query(`
        UPDATE tickets
        SET 
          created_at = created_at - $1::interval,
          sla_due_at = sla_due_at - $1::interval
        WHERE state NOT IN ('CLOSED_CONFIRMED', 'CLOSED_UNCONFIRMED', 'REJECTED_NOT_CIVIC')
      `, [intervalStr]);

      const { processEscalations, processPriority } = await import("./worker.js");
      await processEscalations();
      await processPriority();

      return reply.status(200).send({ ok: true, fastForwarded: hours });
    }
  );
}

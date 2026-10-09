import { z } from "zod";
import type { AppInstance } from "../../types.js";
import { pool, db } from "../../db/client.js";
import { tickets, categories, citizens, events, boundaries, media } from "../../db/schema.js";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import crypto from "crypto";
import { burnTime, hashPasscode, verifyPasscode } from "./passcode.js";
import { requireOfficerAuth } from "./auth.js";
import { runProofGates } from "../proof/gates.js";
import { transition } from "../lifecycle/transition.js";

export function registerOfficerRoutes(app: AppInstance) {
  // #F1: Demo Officer Login
  app.post(
    "/officer/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        body: z.object({
          agencyId: z.string().optional(),
          id: z.string().optional(), // They can login with ID
          passcode: z.string().min(1),
        }),
      },
    },
    async (req, reply) => {
      const { id, agencyId, passcode } = req.body;
      if (!id && !agencyId) return reply.status(400).send({ error: "Give an officer id or an agency", code: "VALIDATION" });

      const client = await pool.connect();
      try {
        // Candidates: that officer, or every officer of that agency (lowest level first = least privilege).
        const res = await client.query(
          id
            ? `SELECT id, tenant_id, agency_id, role, level, name, passcode_hash FROM officers WHERE id = $1`
            : `SELECT id, tenant_id, agency_id, role, level, name, passcode_hash FROM officers WHERE agency_id = $1 ORDER BY level ASC, id ASC`,
          [id ?? agencyId],
        );
        let matched: (typeof res.rows)[number] | undefined;
        let upgrade = false;
        for (const row of res.rows) {
          const v = await verifyPasscode(row.passcode_hash, passcode);
          if (v.ok) { matched = row; upgrade = v.needsRehash; break; }
        }
        if (!matched) {
          if (res.rows.length === 0) await burnTime(passcode); // a wrong id must not answer faster than a wrong passcode
          return reply.status(401).send({ error: "Invalid credentials" });
        }
        if (upgrade) {
          // an old unsalted SHA-256 hash: replace it with bcrypt now that we know the passcode
          await client.query(`UPDATE officers SET passcode_hash = $1 WHERE id = $2`, [await hashPasscode(passcode), matched.id]);
        }
        const officer = matched;

        // Generate short-lived JWT (24h)
        const token = app.jwt.sign(
          {
            kind: "officer",
            id: officer.id,
            tenantId: officer.tenant_id,
            agencyId: officer.agency_id,
            role: officer.role,
            level: officer.level,
          },
          { expiresIn: "24h" }
        );

        return reply.status(200).send({
          token,
          officer: {
            id: officer.id,
            name: officer.name,
            role: officer.role,
            agencyId: officer.agency_id,
            tenantId: officer.tenant_id,
            level: officer.level,
          },
        });
      } finally {
        client.release();
      }
    }
  );

  // #F2 / #F1 validation: Officer ticket feed scoped by agency
  app.get(
    "/officer/tickets",
    {
      preValidation: [requireOfficerAuth],
      schema: {
        querystring: z.object({
          state: z.enum(["OPEN", "RESOLVED", "CLOSED"]).optional(),
          limit: z.coerce.number().min(1).max(50).default(20),
        }),
      },
    },
    async (req, reply) => {
      const officer = req.officer!;
      const { state, limit } = req.query;

      const conditions = [
        eq(tickets.tenantId, officer.tenantId),
        eq(tickets.agencyId, officer.agencyId)
      ];

      if (state) {
        conditions.push(eq(tickets.state, state));
      }

      const rows = await db
        .select({
          id: tickets.id,
          publicCode: tickets.publicCode,
          state: tickets.state,
          priorityScore: tickets.priorityScore,
          categoryCode: tickets.categoryCode,
          categoryName: categories.names,
          categoryIcon: categories.icon,
          boundaryName: boundaries.name,
          geom: tickets.geom,
          createdAt: tickets.createdAt,
          slaDueAt: tickets.slaDueAt,
          summaryOfficerEn: tickets.summaryOfficerEn,
          reportCount: tickets.reportCount,
          priorityBand: tickets.priorityBand,
          hazards: tickets.hazards,
          needsHumanTriage: tickets.needsHumanTriage,
          escalationLevel: tickets.escalationLevel,
          assigneeOfficerId: tickets.assigneeOfficerId,
        })
        .from(tickets)
        .leftJoin(categories, eq(tickets.categoryCode, categories.code))
        .leftJoin(boundaries, eq(tickets.boundaryId, boundaries.id))
        .where(and(...conditions))
        .orderBy(asc(tickets.slaDueAt), desc(tickets.priorityScore))
        .limit(limit);

      return reply.send({ tickets: rows });
    }
  );

  // #F2: Officer stats (top strip)
  app.get(
    "/officer/stats",
    { preValidation: [requireOfficerAuth] },
    async (req, reply) => {
      const officer = req.officer!;

      const conditions = [
        eq(tickets.tenantId, officer.tenantId),
        eq(tickets.agencyId, officer.agencyId)
      ];

      const rows = await db
        .select({
          state: tickets.state,
          slaDueAt: tickets.slaDueAt,
        })
        .from(tickets)
        .where(and(...conditions));

      const now = new Date();
      let open = 0;
      let breached = 0;
      let awaitingCitizen = 0;
      let closedConfirmed = 0;
      let closedTotal = 0;

      for (const t of rows) {
        if (t.state === "OPEN" || t.state === "IN_PROGRESS" || t.state === "REOPENED") {
          open++;
          if (t.slaDueAt < now) breached++;
        } else if (t.state === "WORK_DONE_PENDING_CONFIRMATION") {
          awaitingCitizen++;
        } else if (t.state.startsWith("CLOSED")) {
          closedTotal++;
          if (t.state === "CLOSED_CONFIRMED") closedConfirmed++;
        }
      }

      return reply.send({
        open,
        breached,
        awaitingCitizen,
        confirmedFixRate: closedTotal > 0 ? (closedConfirmed / closedTotal) * 100 : 100
      });
    }
  );

  // #F2: Detail drawer (fetch single ticket + ledger events)
  app.get(
    "/officer/tickets/:id",
    {
      preValidation: [requireOfficerAuth],
      schema: { params: z.object({ id: z.string().uuid() }) },
    },
    async (req, reply) => {
      const { id } = req.params;
      const officer = req.officer!;

      const t = await db.query.tickets.findFirst({
        where: and(
          eq(tickets.id, id),
          eq(tickets.tenantId, officer.tenantId),
          eq(tickets.agencyId, officer.agencyId)
        ),
        with: {
          category: true,
          boundary: true,
          assignee: true,
        },
      });

      if (!t) return reply.status(404).send({ error: "Ticket not found" });

      const evts = await db
        .select()
        .from(events)
        .where(eq(events.ticketId, id))
        .orderBy(desc(events.seq));

      return reply.send({ ticket: t, events: evts });
    }
  );

  // #F3: Field App Job Cards
  app.get(
    "/field/jobs",
    { preValidation: [requireOfficerAuth] },
    async (req, reply) => {
      const officer = req.officer!;

      const rows = await db
        .select({
          id: tickets.id,
          publicCode: tickets.publicCode,
          state: tickets.state,
          categoryName: categories.names,
          categoryIcon: categories.icon,
          geom: tickets.geom,
          slaDueAt: tickets.slaDueAt,
          summaryOfficerEn: tickets.summaryOfficerEn,
        })
        .from(tickets)
        .leftJoin(categories, eq(tickets.categoryCode, categories.code))
        .where(
          and(
            eq(tickets.tenantId, officer.tenantId),
            eq(tickets.agencyId, officer.agencyId),
            eq(tickets.state, "ASSIGNED")
          )
        )
        .orderBy(asc(tickets.slaDueAt));

      return reply.send({ jobs: rows });
    }
  );

  // #F3: Field App location update
  app.post(
    "/field/tickets/:id/location",
    {
      preValidation: [requireOfficerAuth],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          lat: z.number(),
          lng: z.number(),
        })
      }
    },
    async (req, reply) => {
      const { id } = req.params;
      const { lat, lng } = req.body;
      const officer = req.officer!;
      
      const channel = `ticket_${id.replace(/-/g, "_")}`;
      const payload = JSON.stringify({
        type: "team_position",
        lat,
        lng,
        eta: "15 mins" // mocked for now
      });

      const client = await pool.connect();
      try {
        await client.query(`NOTIFY "${channel}", $1`, [payload]);
        // Fire and forget insert into team_positions if it exists, otherwise ignore error
        await client.query(`INSERT INTO team_positions (ticket_id, geom, at) VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), NOW())`, [id, lng, lat]).catch(() => {});
      } finally {
        client.release();
      }

      return reply.send({ ok: true });
    }
  );

  // #F4: Proof Gates via Work done
  app.post(
    "/field/tickets/:id/work-done",
    {
      preValidation: [requireOfficerAuth],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          lat: z.number(),
          lng: z.number(),
          photoBase64: z.string(),
          photoMime: z.string().default("image/jpeg"),
          exifTakenAt: z.string().optional(),
        })
      }
    },
    async (req, reply) => {
      const { id } = req.params;
      const { lat, lng, photoBase64, photoMime, exifTakenAt } = req.body;
      const officer = req.officer!;

      const photoBuffer = Buffer.from(photoBase64, "base64");
      const takenAtDate = exifTakenAt ? new Date(exifTakenAt) : null;

      try {
        const proof = await runProofGates(
          id,
          officer.tenantId,
          photoBuffer,
          photoBase64,
          photoMime,
          lat,
          lng,
          takenAtDate
        );

        if (!proof.ok) {
          // Reject -> we don't transition, we just return error
          return reply.status(400).send({ error: proof.reason, code: "PROOF_REJECTED" });
        }

        // Passed gates! Proceed to WORK_DONE_PENDING_CONFIRMATION
        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          // Save the proof photo in media table
          const { computeDHash } = await import("../proof/dhash.js");
          const dhash = await computeDHash(photoBuffer);

          await db.insert(media).values({
            ticketId: id,
            kind: "after",
            cloudinaryPublicId: "mock_cloudinary_id", // For MVP
            dhash,
            uploaderType: "FIELD",
            uploaderId: officer.id,
            flags: proof.flags
          });

          await transition(
            id,
            "WORK_DONE_PENDING_CONFIRMATION",
            { type: "FIELD", id: officer.id },
            { 
              note: "Work done submitted via field app", 
              flags: proof.flags 
            },
            client
          );

          await client.query("COMMIT");
          return reply.send({ ok: true, flags: proof.flags });
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    }
  );
}

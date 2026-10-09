// Closure Court API. Officers submit proof and see everything; the citizen who owns the ticket may read the court view.
import { z } from "zod";
import type { FastifyRequest } from "fastify";
import type { AppInstance } from "../../types.js";
import { pool } from "../../db/client.js";
import { citizenOwnsTicket, readClaims, UUID_RE } from "../auth/middleware.js";
import { requireOfficerAuth } from "../officers/auth.js";
import { ensureContract } from "./compile.js";
import { CourtInputError, courtView, decodeFiles, storeMedia, submitProof } from "./pipeline.js";

const File = z.object({ name: z.string().min(1).max(120), mime: z.string().max(60), base64: z.string().min(8) });
const Body = z.object({ files: z.array(File).min(1).max(4), declaredAt: z.string().datetime().optional().nullable(), note: z.string().max(500).optional() });

async function mayView(req: FastifyRequest, ticketId: string): Promise<boolean> {
  const claims = readClaims(req);
  if (!claims) return false;
  if (claims.kind === "officer") return true;
  if (claims.kind === "citizen") return citizenOwnsTicket(claims.id, ticketId);
  return false;
}

export function registerCourtRoutes(app: AppInstance) {
  const guardId = (id: string) => UUID_RE.test(id);

  app.post("/tickets/:id/proof", {
    preValidation: [requireOfficerAuth], bodyLimit: 40_000_000,
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: { params: z.object({ id: z.string() }), body: Body },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!guardId(id)) return reply.status(404).send({ error: "Ticket not found", code: "TICKET_NOT_FOUND" });
    const officer = req.officer!;
    try {
      const body = req.body as z.infer<typeof Body>;
      const res = await submitProof({ ticketId: id, actor: { type: String(officer.role).toUpperCase().includes("FIELD") ? "FIELD" : "OFFICER", id: officer.id }, files: body.files, declaredAt: body.declaredAt ?? null, note: body.note });
      return reply.status(200).send(res);
    } catch (e) {
      if (e instanceof CourtInputError) return reply.status(e.code === "NOT_FOUND" ? 404 : 400).send({ error: e.message, code: e.code });
      throw e;
    }
  });

  // The original complaint photo(s), kept as bytes so the court can compare against them.
  app.post("/tickets/:id/court/before", {
    preValidation: [requireOfficerAuth], bodyLimit: 20_000_000,
    schema: { params: z.object({ id: z.string() }), body: Body },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!guardId(id)) return reply.status(404).send({ error: "Ticket not found", code: "TICKET_NOT_FOUND" });
    const exists = await pool.query(`SELECT 1 FROM tickets WHERE id = $1`, [id]);
    if (!exists.rowCount) return reply.status(404).send({ error: "Ticket not found", code: "TICKET_NOT_FOUND" });
    try {
      const files = decodeFiles((req.body as z.infer<typeof Body>).files);
      const ids = [];
      for (const f of files) ids.push(await storeMedia(id, "before", f, null));
      await ensureContract(id);
      return reply.status(200).send({ ok: true, mediaIds: ids });
    } catch (e) {
      if (e instanceof CourtInputError) return reply.status(400).send({ error: e.message, code: e.code });
      throw e;
    }
  });

  app.get("/tickets/:id/court", { schema: { params: z.object({ id: z.string() }) } }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!guardId(id) || !(await mayView(req, id))) return reply.status(404).send({ error: "Ticket not found", code: "TICKET_NOT_FOUND" });
    await ensureContract(id).catch(() => undefined);
    return reply.status(200).send(await courtView(id));
  });

  app.get("/court/media/:mediaId", { schema: { params: z.object({ mediaId: z.string() }) } }, async (req, reply) => {
    const { mediaId } = req.params as { mediaId: string };
    if (!guardId(mediaId)) return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });
    const r = await pool.query<{ ticket_id: string; mime: string; bytes: Buffer }>(`SELECT ticket_id, mime, bytes FROM court_media WHERE id = $1`, [mediaId]);
    const row = r.rows[0];
    if (!row || !(await mayView(req, row.ticket_id))) return reply.status(404).send({ error: "Not found", code: "NOT_FOUND" });
    return reply.header("Content-Type", row.mime).header("Cache-Control", "private, max-age=3600").send(row.bytes);
  });
}

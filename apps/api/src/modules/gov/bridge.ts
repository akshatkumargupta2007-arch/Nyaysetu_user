// CA3: the ONLY door from the government portal into the citizen stack.
//
//   POST /internal/gov/close-request   (internal listener, port GOV_BRIDGE_PORT, never published to the host)
//
// What it can do: append one CLOSE_REQUESTED_BY_GOV note to a ticket that is waiting for the citizen's
// confirmation. What it can never do: change a ticket's state. Only the citizen can close a ticket.
import Fastify from "fastify";
import { z } from "zod";
import { env } from "../../env.js";
import { pool } from "../../db/client.js";
import { appendEvent } from "../lifecycle/transition.js";
import { publishToCitizen } from "./citizenEvents.js";
import { enqueueGovSync } from "./syncTrigger.js";
import { verifySignedRequest } from "./signing.js";
import { MAX_PHOTO_BYTES, isLocalPhotoId, isSafeCloudinaryId, isSimulatedPhotoId, sniffMime } from "../uploads/photoStore.js";

export const CLOSE_REQUEST_PATH = "/internal/gov/close-request";
export const MEDIA_PATH = "/internal/gov/media";
export const CLOSE_REQUEST_COOLDOWN_HOURS = 24;

const MediaBody = z.discriminatedUnion("op", [
  z.object({ op: z.literal("list"), ticket_id: z.string().uuid() }),
  z.object({ op: z.literal("get"), ticket_id: z.string().uuid(), media_id: z.string().uuid() }),
]);

const Body = z.object({
  ticket_id: z.string().uuid(),
  gov_user_id: z.string().min(1).max(100),
  gov_user_name: z.string().min(1).max(200),
  note: z.string().max(300).nullable().optional(),
  idempotency_key: z.string().min(8).max(200),
});

export async function buildBridgeApp() {
  const app = Fastify({
    logger: { level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL, redact: { paths: ["*.phone", "req.headers.authorization", "req.headers.cookie"], censor: "[redacted]" } },
  });
  // The signature covers the exact bytes, so keep the body as a string until it has been verified.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => done(null, body));

  app.get("/healthz", async () => ({ ok: true }));

  app.post(CLOSE_REQUEST_PATH, async (req, reply) => {
    const raw = typeof req.body === "string" ? req.body : "";
    const v = verifySignedRequest(env.GOV_WRITEBACK_PUBLIC_KEY, "POST", CLOSE_REQUEST_PATH, req.headers, raw);
    if (!v.ok) return reply.status(401).send({ error: "Rejected", code: v.reason === "stale" ? "STALE" : "BAD_SIGNATURE" });

    // Each valid signature works once. Recorded only after the signature checked out.
    await pool.query(`DELETE FROM gov_nonces WHERE at < now() - interval '10 minutes'`);
    const fresh = await pool.query(`INSERT INTO gov_nonces (nonce) VALUES ($1) ON CONFLICT DO NOTHING`, [v.nonce]);
    if (!fresh.rowCount) return reply.status(401).send({ error: "Rejected", code: "REPLAY" });

    let parsed;
    try {
      parsed = Body.safeParse(JSON.parse(raw));
    } catch {
      return reply.status(400).send({ error: "Invalid JSON", code: "VALIDATION" });
    }
    if (!parsed.success) return reply.status(400).send({ error: "Invalid request", code: "VALIDATION" });
    const b = parsed.data;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const t = await client.query<{ id: string; state: string; public_code: string }>(
        `SELECT id, state, public_code FROM tickets WHERE id = $1 FOR UPDATE`,
        [b.ticket_id],
      );
      if (!t.rowCount) {
        await client.query("ROLLBACK");
        return reply.status(404).send({ error: "Ticket not found", code: "NOT_FOUND" });
      }
      const ticket = t.rows[0]!;

      // A retry of the same request (network hiccup) returns the same answer instead of a second note.
      const dup = await client.query<{ event_seq: number | null }>(`SELECT event_seq FROM gov_close_requests WHERE idempotency_key = $1`, [b.idempotency_key]);
      if (dup.rowCount) {
        await client.query("ROLLBACK");
        return reply.send({ ok: true, duplicate: true, seq: dup.rows[0]!.event_seq });
      }

      if (ticket.state !== "WORK_DONE_PENDING_CONFIRMATION") {
        await client.query("ROLLBACK");
        return reply.status(409).send({ error: "The ticket is not waiting for citizen confirmation", code: "WRONG_STATE", state: ticket.state });
      }
      const recent = await client.query<{ at: Date }>(
        `SELECT created_at AS at FROM events WHERE ticket_id = $1 AND type = 'CLOSE_REQUESTED_BY_GOV'
           AND created_at > now() - ($2 || ' hours')::interval ORDER BY created_at DESC LIMIT 1`,
        [b.ticket_id, String(CLOSE_REQUEST_COOLDOWN_HOURS)],
      );
      if (recent.rowCount) {
        await client.query("ROLLBACK");
        const retry = Math.max(1, Math.ceil((recent.rows[0]!.at.getTime() + CLOSE_REQUEST_COOLDOWN_HOURS * 3_600_000 - Date.now()) / 1000));
        return reply.status(409).header("Retry-After", String(retry)).send({ error: "A request was already sent in the last 24 hours", code: "TOO_SOON", retryAfterSeconds: retry });
      }

      const ev = await appendEvent(
        b.ticket_id,
        "CLOSE_REQUESTED_BY_GOV",
        { type: "GOV", id: `gov:${b.gov_user_id}` },
        { note: b.note ?? null, gov_user_name: b.gov_user_name, gov_user_id: b.gov_user_id },
        client,
      );
      await client.query(`INSERT INTO gov_close_requests (idempotency_key, ticket_id, gov_user_id, event_seq) VALUES ($1,$2,$3,$4)`, [b.idempotency_key, b.ticket_id, b.gov_user_id, ev.seq]);
      const who = await client.query<{ citizen_id: string; id: string }>(`SELECT DISTINCT citizen_id, ticket_id AS id FROM reports WHERE ticket_id = $1`, [b.ticket_id]);
      await client.query("COMMIT");

      // After the commit: tell every reporter's open app, and push the new event to gov.
      for (const r of who.rows) {
        publishToCitizen(r.citizen_id, {
          type: "close_request", reportId: null, ticketId: b.ticket_id, ticketCode: ticket.public_code,
          note: b.note ?? null, officialName: b.gov_user_name, requestedAt: new Date().toISOString(),
        });
      }
      void enqueueGovSync(b.ticket_id);
      return reply.status(200).send({ ok: true, seq: ev.seq });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      req.log.error({ err }, "close-request failed");
      return reply.status(500).send({ error: "Internal error", code: "INTERNAL" });
    } finally {
      client.release();
    }
  });

  // The photos a citizen attached. Read-only, one ticket at a time, same signature rules as the door above.
  // The portal checks the official's area BEFORE it calls, so this only has to answer for the ticket it is asked about.
  //   { op: "list", ticket_id }                 -> the photos of that ticket (kind, time, whether we can show them)
  //   { op: "get",  ticket_id, media_id }       -> one photo as base64 (kept by us, or fetched from Cloudinary)
  app.post(MEDIA_PATH, async (req, reply) => {
    const raw = typeof req.body === "string" ? req.body : "";
    const v = verifySignedRequest(env.GOV_WRITEBACK_PUBLIC_KEY, "POST", MEDIA_PATH, req.headers, raw);
    if (!v.ok) return reply.status(401).send({ error: "Rejected", code: v.reason === "stale" ? "STALE" : "BAD_SIGNATURE" });
    await pool.query(`DELETE FROM gov_nonces WHERE at < now() - interval '10 minutes'`);
    const fresh = await pool.query(`INSERT INTO gov_nonces (nonce) VALUES ($1) ON CONFLICT DO NOTHING`, [v.nonce]);
    if (!fresh.rowCount) return reply.status(401).send({ error: "Rejected", code: "REPLAY" });

    let parsed;
    try { parsed = MediaBody.safeParse(JSON.parse(raw)); } catch { return reply.status(400).send({ error: "Invalid JSON", code: "VALIDATION" }); }
    if (!parsed.success) return reply.status(400).send({ error: "Invalid request", code: "VALIDATION" });
    const b = parsed.data;

    try {
      const rows = await pool.query<{ id: string; kind: string; public_id: string; created_at: Date }>(
        `SELECT id, kind, cloudinary_public_id AS public_id, created_at FROM media
          WHERE ticket_id = $1 AND kind IN ('before', 'reopen') ORDER BY created_at, id`,
        [b.ticket_id],
      );
      if (b.op === "list") {
        const items = [];
        for (const r of rows.rows) {
          let available = false;
          let check: { verdict: string; confidence: number | null; reason: string | null } | null = null;
          if (isLocalPhotoId(r.public_id)) {
            const blob = await pool.query<{ v: string | null; c: number | null; why: string | null }>(
              `SELECT check_verdict AS v, check_confidence AS c, check_reason AS why FROM media_blobs WHERE public_id = $1`, [r.public_id]);
            available = Boolean(blob.rowCount);
            if (blob.rows[0]) check = { verdict: blob.rows[0].v ?? "unchecked", confidence: blob.rows[0].c, reason: blob.rows[0].why };
          } else if (!isSimulatedPhotoId(r.public_id)) available = Boolean(env.CLOUDINARY_CLOUD_NAME) && isSafeCloudinaryId(r.public_id);
          items.push({ id: r.id, kind: r.kind, at: r.created_at.toISOString(), available, check });
        }
        return reply.send({ ok: true, items });
      }

      const m = rows.rows.find((r) => r.id === b.media_id);
      if (!m) return reply.status(404).send({ error: "Photo not found", code: "NOT_FOUND" });
      if (isLocalPhotoId(m.public_id)) {
        const blob = await pool.query<{ mime: string; data: Buffer }>(`SELECT mime, data FROM media_blobs WHERE public_id = $1`, [m.public_id]);
        const row = blob.rows[0];
        if (!row) return reply.status(404).send({ error: "Photo not found", code: "NOT_FOUND" });
        return reply.send({ ok: true, mime: row.mime, data_base64: row.data.toString("base64") });
      }
      if (isSimulatedPhotoId(m.public_id) || !env.CLOUDINARY_CLOUD_NAME || !isSafeCloudinaryId(m.public_id)) {
        return reply.status(404).send({ error: "This photo is not stored", code: "NOT_STORED" });
      }
      const res = await fetch(`https://res.cloudinary.com/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/image/upload/${m.public_id}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return reply.status(404).send({ error: "This photo is not available", code: "NOT_STORED" });
      const bytes = Buffer.from(await res.arrayBuffer());
      const mime = sniffMime(bytes);
      if (!mime || bytes.length > MAX_PHOTO_BYTES * 2) return reply.status(404).send({ error: "This photo is not available", code: "NOT_STORED" });
      return reply.send({ ok: true, mime, data_base64: bytes.toString("base64") });
    } catch (err) {
      req.log.error({ err }, "media request failed");
      return reply.status(500).send({ error: "Internal error", code: "INTERNAL" });
    }
  });

  return app;
}

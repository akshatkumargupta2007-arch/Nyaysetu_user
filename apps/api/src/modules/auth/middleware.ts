// Build map #D8 — JWT auth for citizens (Authorization: Bearer). Officer tokens
// carry kind:"officer"; citizen tokens carry kind:"citizen". Neither is accepted
// where the other is required.
import type { FastifyReply, FastifyRequest } from "fastify";
import { pool } from "../../db/client.js";

declare module "fastify" {
  interface FastifyRequest {
    citizen?: { id: string };
  }
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TokenClaims {
  id: string;
  kind?: "citizen" | "officer";
  [k: string]: unknown;
}

/** Reads + verifies the bearer token. `allowQueryToken` is only for EventSource (it cannot set headers). */
export function readClaims(req: FastifyRequest, allowQueryToken = false): TokenClaims | null {
  let token: string | undefined;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) token = header.slice(7);
  else if (allowQueryToken) token = (req.query as Record<string, string | undefined>)?.token;
  if (!token) return null;
  try {
    return req.server.jwt.verify<TokenClaims>(token);
  } catch {
    return null;
  }
}

async function loadCitizen(id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  const res = await pool.query(`SELECT 1 FROM citizens WHERE id = $1`, [id]);
  return res.rows.length > 0;
}

export function citizenAuth(opts: { allowQueryToken?: boolean } = {}) {
  return async function requireCitizenAuth(req: FastifyRequest, reply: FastifyReply) {
    const claims = readClaims(req, opts.allowQueryToken);
    if (!claims || claims.kind !== "citizen" || !(await loadCitizen(claims.id))) {
      return reply.status(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
    }
    req.citizen = { id: claims.id };
  };
}

export const requireCitizenAuth = citizenAuth();

/** True if this citizen filed a report on the ticket. */
export async function citizenOwnsTicket(citizenId: string, ticketId: string): Promise<boolean> {
  if (!UUID_RE.test(ticketId)) return false;
  const res = await pool.query(
    `SELECT 1 FROM reports WHERE ticket_id = $1 AND citizen_id = $2 LIMIT 1`,
    [ticketId, citizenId],
  );
  return res.rows.length > 0;
}

/**
 * Pre-login preview endpoints (transcribe, understand). The cipher design shows
 * "what the AI understood" BEFORE the phone/OTP step, so these accept anonymous
 * callers, protected by strict per-IP rate limits. A valid citizen token, when
 * present, is still honoured (per-account caps). Filing a complaint, uploads,
 * status and closure all still require login.
 */
export async function optionalCitizenAuth(req: FastifyRequest) {
  const claims = readClaims(req);
  if (claims?.kind === "citizen" && (await loadCitizen(claims.id))) {
    req.citizen = { id: claims.id };
  }
}

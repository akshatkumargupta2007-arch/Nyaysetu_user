// Build map #D8 — POST /auth/request-otp, POST /auth/verify-otp (Bible Part 15).
import { z } from "zod";
import type { AppInstance } from "../../types.js";
import { pool } from "../../db/client.js";
import { env } from "../../env.js";
import { normalizePhone, hashPhone, encryptPhone } from "../session/phone.js";
import { requestOtp, verifyOtp } from "./otp.js";
import { SUPPORTED_LANGS } from "../../lib/languages.js";

export function registerAuthRoutes(app: AppInstance) {
  app.post(
    "/auth/request-otp",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: { body: z.object({ phone: z.string().min(10).max(20) }) },
    },
    async (req, reply) => {
      const phone = normalizePhone(req.body.phone);
      if (!phone) {
        return reply.status(400).send({ error: "Invalid 10-digit Indian phone number", code: "INVALID_PHONE" });
      }
      const result = await requestOtp(phone);
      if (!result.ok) {
        return reply
          .status(429)
          .header("Retry-After", String(result.retryAfterSeconds))
          .send({ error: "Too many OTP requests", code: result.code, retryAfterSeconds: result.retryAfterSeconds });
      }
      return reply.status(200).send({ ok: true, expiresInSeconds: result.expiresInSeconds, devOtp: result.devOtp });
    },
  );

  app.post(
    "/auth/verify-otp",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        body: z.object({
          phone: z.string().min(10).max(20),
          code: z.string().regex(/^\d{6}$/),
          lang: z.enum(SUPPORTED_LANGS).optional(),
        }),
      },
    },
    async (req, reply) => {
      const phone = normalizePhone(req.body.phone);
      if (!phone) {
        return reply.status(400).send({ error: "Invalid 10-digit Indian phone number", code: "INVALID_PHONE" });
      }
      const result = await verifyOtp(phone, req.body.code);
      if (!result.ok) {
        const status = result.code === "TOO_MANY_ATTEMPTS" ? 429 : 401;
        return reply.status(status).send({ error: "OTP verification failed", code: result.code });
      }

      // New phone => account is created here; returning phone => same account.
      const phoneH = hashPhone(phone);
      const upsert = await pool.query<{ id: string; created: boolean }>(
        `INSERT INTO citizens (phone_hash, phone_enc, lang)
         VALUES ($1, $2, $3)
         ON CONFLICT (phone_hash) WHERE phone_hash IS NOT NULL
         DO UPDATE SET lang = COALESCE($4, citizens.lang)
         RETURNING id, (xmax = 0) AS created`,
        [phoneH, encryptPhone(phone), req.body.lang ?? "hi", req.body.lang ?? null],
      );
      const citizenId = upsert.rows[0]!.id;

      const token = app.jwt.sign({ id: citizenId, kind: "citizen" }, { expiresIn: env.CITIZEN_JWT_TTL });
      return reply.status(200).send({ token, citizenId, isNewUser: upsert.rows[0]!.created });
    },
  );
}

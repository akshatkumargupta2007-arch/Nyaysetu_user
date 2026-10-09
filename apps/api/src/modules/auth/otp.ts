// Build map #D8 — OTP generation, storage and verification (Phone + OTP, no passwords).
//
// Delivery: there is no SMS provider yet (India needs TRAI DLT registration — Bible §18).
// `deliverOtp` is the single seam to plug one in. Until then the code is logged on the
// server, and outside production (or in DEMO_MODE) the API also returns it as `devOtp`.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { pool } from "../../db/client.js";
import { env } from "../../env.js";
import { hashPhone } from "../session/phone.js";

export const OTP_RESEND_COOLDOWN_S = 30;
export const OTP_MAX_PER_HOUR = 5;
export const OTP_MAX_ATTEMPTS = 5;

export function otpExposedInResponse(): boolean {
  return env.NODE_ENV !== "production" || env.DEMO_MODE;
}

function hashCode(phone: string, code: string): string {
  return createHmac("sha256", env.JWT_SECRET).update(`${phone}:${code}`).digest("hex");
}

function newCode(): string {
  if (env.OTP_FIXED_CODE && otpExposedInResponse()) return env.OTP_FIXED_CODE;
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function deliverOtp(phone: string, code: string): Promise<void> {
  // TODO(provider): send via an SMS gateway with a DLT-approved template.
  // Never print the code in production: anyone with log access could log in as the user.
  if (env.NODE_ENV !== "production" || env.DEMO_MODE) {
    console.log(`[otp] code for ${phone.slice(0, 6)}****${phone.slice(-2)}: ${code}`);
  }
}

export type RequestOtpResult =
  | { ok: true; expiresInSeconds: number; devOtp?: string }
  | { ok: false; code: "COOLDOWN" | "TOO_MANY"; retryAfterSeconds: number };

export async function requestOtp(normalizedPhone: string): Promise<RequestOtpResult> {
  const phoneH = hashPhone(normalizedPhone);

  const recent = await pool.query<{ last_s: number | null; last_hour: number }>(
    `SELECT EXTRACT(EPOCH FROM (now() - max(created_at)))::float AS last_s,
            count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS last_hour
     FROM otp_codes WHERE phone_hash = $1`,
    [phoneH],
  );
  const r = recent.rows[0]!;
  // Fixed-code demo: the code is not delivered anywhere and costs nothing, so no resend limits.
  const demoFixed = Boolean(env.OTP_FIXED_CODE) && otpExposedInResponse();
  if (!demoFixed && r.last_s !== null && r.last_s < OTP_RESEND_COOLDOWN_S) {
    return { ok: false, code: "COOLDOWN", retryAfterSeconds: Math.ceil(OTP_RESEND_COOLDOWN_S - r.last_s) };
  }
  if (!demoFixed && r.last_hour >= OTP_MAX_PER_HOUR) {
    return { ok: false, code: "TOO_MANY", retryAfterSeconds: 3600 };
  }

  const code = newCode();
  await pool.query(
    `INSERT INTO otp_codes (phone_hash, code_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' seconds')::interval)`,
    [phoneH, hashCode(normalizedPhone, code), env.OTP_TTL_SECONDS],
  );
  await deliverOtp(normalizedPhone, code);

  return {
    ok: true,
    expiresInSeconds: env.OTP_TTL_SECONDS,
    ...(otpExposedInResponse() ? { devOtp: code } : {}),
  };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; code: "INVALID_OTP" | "EXPIRED_OR_MISSING" | "TOO_MANY_ATTEMPTS" };

/** Verifies against the newest unconsumed, unexpired code. Single-use; limited attempts. */
export async function verifyOtp(normalizedPhone: string, code: string): Promise<VerifyOtpResult> {
  const phoneH = hashPhone(normalizedPhone);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query<{ id: string; code_hash: string; attempts: number }>(
      `SELECT id, code_hash, attempts FROM otp_codes
       WHERE phone_hash = $1 AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [phoneH],
    );
    const row = res.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, code: "EXPIRED_OR_MISSING" };
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      await client.query("ROLLBACK");
      return { ok: false, code: "TOO_MANY_ATTEMPTS" };
    }

    const expected = Buffer.from(row.code_hash, "hex");
    const given = Buffer.from(hashCode(normalizedPhone, code), "hex");
    const match = expected.length === given.length && timingSafeEqual(expected, given);

    if (!match) {
      await client.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
      await client.query("COMMIT");
      return { ok: false, code: "INVALID_OTP" };
    }

    await client.query(`UPDATE otp_codes SET consumed_at = now() WHERE id = $1`, [row.id]);
    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Build map #D8 — Phone + OTP login, end to end against the real database.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../app.js";
import type { AppInstance } from "../../types.js";
import { pool } from "../../db/client.js";
import { hashPhone } from "../session/phone.js";
import { randomTestPhone, createTestCitizen, officerHeaders } from "../../test/auth.js";

describe("Phone + OTP login (#D8)", () => {
  let app: AppInstance;
  const phones: string[] = [];
  const fresh = () => {
    const p = randomTestPhone();
    phones.push(p);
    return p;
  };

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    const hashes = phones.map(hashPhone);
    await pool.query(`DELETE FROM otp_codes WHERE phone_hash = ANY($1)`, [hashes]);
    await pool.query(`DELETE FROM citizens WHERE phone_hash = ANY($1)`, [hashes]);
  });

  const requestOtp = (phone: string) =>
    app.inject({ method: "POST", url: "/auth/request-otp", payload: { phone } });
  const verify = (phone: string, code: string) =>
    app.inject({ method: "POST", url: "/auth/verify-otp", payload: { phone, code } });

  it("new user: request OTP -> verify -> account created and JWT returned", async () => {
    const phone = fresh();
    const r1 = await requestOtp(phone);
    expect(r1.statusCode).toBe(200);
    const { devOtp } = r1.json();
    expect(devOtp).toMatch(/^\d{6}$/); // exposed because NODE_ENV=test (never in production)

    const r2 = await verify(phone, devOtp);
    expect(r2.statusCode).toBe(200);
    const body = r2.json();
    expect(body.isNewUser).toBe(true);
    expect(body.token).toBeTruthy();

    // The token actually works on a protected route.
    const me = await app.inject({ method: "GET", url: "/me/reports", headers: { authorization: `Bearer ${body.token}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toEqual([]);
  });

  it("returning user: same phone logs into the SAME account (no duplicate)", async () => {
    const phone = fresh();
    const a = (await verify(phone, (await requestOtp(phone)).json().devOtp)).json();
    await pool.query(`UPDATE otp_codes SET created_at = created_at - interval '1 minute' WHERE phone_hash = $1`, [hashPhone(phone)]);
    const b = (await verify(phone, (await requestOtp(phone)).json().devOtp)).json();
    expect(b.isNewUser).toBe(false);
    expect(b.citizenId).toBe(a.citizenId);
    const count = await pool.query(`SELECT count(*)::int AS n FROM citizens WHERE phone_hash = $1`, [hashPhone(phone)]);
    expect(count.rows[0].n).toBe(1);
  });

  it("wrong code is rejected, and a code is single-use", async () => {
    const phone = fresh();
    const { devOtp } = (await requestOtp(phone)).json();
    const wrong = devOtp === "000000" ? "111111" : "000000";
    expect((await verify(phone, wrong)).statusCode).toBe(401);
    expect((await verify(phone, devOtp)).statusCode).toBe(200);
    expect((await verify(phone, devOtp)).statusCode).toBe(401); // already consumed
  });

  it("locks out after too many wrong attempts, even with the right code afterwards", async () => {
    const phone = fresh();
    const { devOtp } = (await requestOtp(phone)).json();
    const wrong = devOtp === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await verify(phone, wrong);
    const res = await verify(phone, devOtp);
    expect(res.statusCode).toBe(429);
    expect(res.json().code).toBe("TOO_MANY_ATTEMPTS");
  });

  it("expired codes are rejected", async () => {
    const phone = fresh();
    const { devOtp } = (await requestOtp(phone)).json();
    await pool.query(`UPDATE otp_codes SET expires_at = now() - interval '1 second' WHERE phone_hash = $1`, [hashPhone(phone)]);
    const res = await verify(phone, devOtp);
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("EXPIRED_OR_MISSING");
  });

  it("resend cooldown: a second request within 30s is refused", async () => {
    const phone = fresh();
    expect((await requestOtp(phone)).statusCode).toBe(200);
    const again = await requestOtp(phone);
    expect(again.statusCode).toBe(429);
    expect(again.json().code).toBe("COOLDOWN");
  });

  it("rejects invalid phone numbers and malformed codes", async () => {
    expect((await requestOtp("12345")).statusCode).toBe(400);
    expect((await verify(fresh(), "12ab56")).statusCode).toBe(400);
  });

  it("only a hash of the OTP and phone are stored, never the plain values", async () => {
    const phone = fresh();
    const { devOtp } = (await requestOtp(phone)).json();
    const row = (await pool.query(`SELECT * FROM otp_codes WHERE phone_hash = $1`, [hashPhone(phone)])).rows[0];
    expect(JSON.stringify(row)).not.toContain(devOtp);
    expect(JSON.stringify(row)).not.toContain(phone.slice(3));
  });

  describe("no anonymous access to citizen features", () => {
    const protectedCalls: Array<[string, string]> = [
      ["POST", "/reports/confirm"],
      ["POST", "/uploads/sign"],
      ["POST", "/voice/ask"],
      ["GET", "/me/reports"],
      ["GET", "/tickets/00000000-0000-0000-0000-000000000000/tracking"],
      ["GET", "/reports/00000000-0000-0000-0000-000000000000/stream"],
      ["POST", "/reports/00000000-0000-0000-0000-000000000000/confirm-closure"],
      ["POST", "/tickets/00000000-0000-0000-0000-000000000000/transition"],
    ];
    it.each(protectedCalls)("%s %s -> 401 without a token", async (method, url) => {
      const res = await app.inject({ method: method as "GET" | "POST", url, payload: method === "POST" ? {} : undefined });
      expect(res.statusCode).toBe(401);
    });

    it("pre-login preview: /reports/understand works without a token, but requires real text", async () => {
      const ok = await app.inject({ method: "POST", url: "/reports/understand", payload: { text: "kachra nahi utha", lang: "hi", lat: 21.185, lng: 81.33 } });
      expect(ok.statusCode).toBe(200);
      const empty = await app.inject({ method: "POST", url: "/reports/understand", payload: { text: "  ", lang: "hi", lat: 21.185, lng: 81.33 } });
      expect(empty.statusCode).toBe(400); // text is mandatory (photo alone is not enough)
    });

    it("the old X-Device-Token header no longer authenticates anything", async () => {
      const res = await app.inject({ method: "GET", url: "/me/reports", headers: { "x-device-token": "anything" } });
      expect(res.statusCode).toBe(401);
    });

    it("POST /session and /session/phone no longer exist", async () => {
      expect((await app.inject({ method: "POST", url: "/session", payload: { deviceToken: "x" } })).statusCode).toBe(404);
      expect((await app.inject({ method: "POST", url: "/session/phone", payload: { phone: "9876543210" } })).statusCode).toBe(404);
    });

    it("a forged / tampered token is rejected", async () => {
      const c = await createTestCitizen(app);
      const bad = c.token.slice(0, -3) + "abc";
      const res = await app.inject({ method: "GET", url: "/me/reports", headers: { authorization: `Bearer ${bad}` } });
      expect(res.statusCode).toBe(401);
    });

    it("an officer token cannot act as a citizen, and a citizen token cannot act as an officer", async () => {
      const asCitizen = await app.inject({ method: "GET", url: "/me/reports", headers: officerHeaders(app) });
      expect(asCitizen.statusCode).toBe(401);
      const c = await createTestCitizen(app);
      const asOfficer = await app.inject({ method: "GET", url: "/officer/stats", headers: c.headers });
      expect(asOfficer.statusCode).toBe(401);
    });
  });
});

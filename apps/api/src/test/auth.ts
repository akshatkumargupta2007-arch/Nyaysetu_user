// Test helpers: real citizen/officer rows + signed JWTs (no mocking of auth).
import { randomUUID, randomInt } from "node:crypto";
import { pool } from "../db/client.js";
import { hashPhone, encryptPhone } from "../modules/session/phone.js";
import type { AppInstance } from "../types.js";

export function randomTestPhone(): string {
  return `+91${randomInt(6, 10)}${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`;
}

export async function createTestCitizen(app: AppInstance) {
  const phone = randomTestPhone();
  const res = await pool.query<{ id: string }>(
    `INSERT INTO citizens (phone_hash, phone_enc, lang) VALUES ($1, $2, 'hi') RETURNING id`,
    [hashPhone(phone), encryptPhone(phone)],
  );
  const id = res.rows[0]!.id;
  const token = app.jwt.sign({ id, kind: "citizen" }, { expiresIn: "1h" });
  return { id, phone, token, headers: { authorization: `Bearer ${token}` } };
}

export async function authHeaders(app: AppInstance) {
  return (await createTestCitizen(app)).headers;
}

export function officerHeaders(app: AppInstance, role = "WARD_SUPERVISOR") {
  const token = app.jwt.sign(
    { kind: "officer", id: `test-${randomUUID()}`, tenantId: "cg.bhilai", agencyId: "cg.bhilai.bmc", role, level: 1 },
    { expiresIn: "1h" },
  );
  return { authorization: `Bearer ${token}` };
}

export async function deleteTestCitizen(id: string) {
  await pool.query(`DELETE FROM reports WHERE citizen_id = $1`, [id]);
  await pool.query(`DELETE FROM citizens WHERE id = $1`, [id]);
}

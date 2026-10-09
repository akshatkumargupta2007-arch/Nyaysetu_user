// CA9: officer passcodes: bcrypt, with old SHA-256 hashes upgraded on login.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { buildApp } from "../../app.js";
import { pool } from "../../db/client.js";
import type { AppInstance } from "../../types.js";
import { hashPasscode, verifyPasscode } from "./passcode.js";

let app: AppInstance;
const LEGACY_ID = "test.legacy.officer";
const NEW_ID = "test.bcrypt.officer";
const sha = (p: string) => createHash("sha256").update(p).digest("hex");
const login = (body: object) => app.inject({ method: "POST", url: "/officer/login", payload: body });
const hashOf = async (id: string) => (await pool.query("SELECT passcode_hash FROM officers WHERE id = $1", [id])).rows[0]?.passcode_hash as string | undefined;

beforeAll(async () => {
  app = await buildApp();
  await pool.query(`DELETE FROM officers WHERE id IN ($1, $2)`, [LEGACY_ID, NEW_ID]);
  const base = `INSERT INTO officers (id, tenant_id, agency_id, role, level, name, passcode_hash) VALUES ($1,'cg.bhilai','cg.bhilai.bmc','FIELD_SUPERVISOR',1,$2,$3)`;
  await pool.query(base, [LEGACY_ID, "Legacy Officer", sha("old-passcode-77")]); // an old row: unsalted SHA-256
  await pool.query(base, [NEW_ID, "New Officer", await hashPasscode("new-passcode-88")]); // a new row: bcrypt
});
afterAll(async () => {
  await pool.query(`DELETE FROM officers WHERE id IN ($1, $2)`, [LEGACY_ID, NEW_ID]);
  await app.close();
});

describe("CA9 passcode hashing", () => {
  it("bcrypt hashes verify, differ for the same passcode (salted), and wrong ones fail", async () => {
    const a = await hashPasscode("1234");
    const b = await hashPasscode("1234");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^\$2[aby]\$12\$/);
    expect(await verifyPasscode(a, "1234")).toEqual({ ok: true, needsRehash: false });
    expect((await verifyPasscode(a, "9999")).ok).toBe(false);
  });
  it("an old unsalted SHA-256 hash still verifies, and is flagged for upgrade", async () => {
    expect(await verifyPasscode(sha("1234"), "1234")).toEqual({ ok: true, needsRehash: true });
    expect(await verifyPasscode(sha("1234"), "nope")).toEqual({ ok: false, needsRehash: false });
  });
});

describe("CA9 officer login", () => {
  it("a legacy-hash officer logs in, and the stored hash becomes bcrypt", async () => {
    expect(await hashOf(LEGACY_ID)).toBe(sha("old-passcode-77"));
    const res = await login({ id: LEGACY_ID, passcode: "old-passcode-77" });
    expect(res.statusCode).toBe(200);
    expect(res.json().officer).toMatchObject({ id: LEGACY_ID, role: "FIELD_SUPERVISOR" });
    const upgraded = await hashOf(LEGACY_ID);
    expect(upgraded).toMatch(/^\$2[aby]\$12\$/);
    expect(upgraded).not.toContain(sha("old-passcode-77"));
    expect((await login({ id: LEGACY_ID, passcode: "old-passcode-77" })).statusCode).toBe(200); // still works after the upgrade
  });

  it("a bcrypt officer logs in with the right passcode only", async () => {
    expect((await login({ id: NEW_ID, passcode: "new-passcode-88" })).statusCode).toBe(200);
    expect((await login({ id: NEW_ID, passcode: "wrong" })).statusCode).toBe(401);
  });

  it("an unknown id and a wrong passcode look the same", async () => {
    const a = await login({ id: "no.such.officer", passcode: "x" });
    const b = await login({ id: NEW_ID, passcode: "x" });
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.json()).toEqual(b.json());
  });

  it("a wrong passcode does not upgrade or change the stored hash", async () => {
    const before = await hashOf(NEW_ID);
    await login({ id: NEW_ID, passcode: "wrong" });
    expect(await hashOf(NEW_ID)).toBe(before);
  });

  it("an agency-only login picks the lowest-level officer that the passcode fits (least privilege)", async () => {
    await pool.query("UPDATE officers SET passcode_hash = $1 WHERE agency_id = 'cg.bhilai.bmc' AND id NOT IN ($2,$3)", [sha("shared-9"), LEGACY_ID, NEW_ID]);
    const res = await login({ agencyId: "cg.bhilai.bmc", passcode: "shared-9" });
    expect(res.statusCode).toBe(200);
    const lowest = await pool.query("SELECT min(level) AS l FROM officers WHERE agency_id = 'cg.bhilai.bmc'");
    expect(res.json().officer.level).toBe(lowest.rows[0].l);
  });

  it("needs an id or an agency", async () => {
    expect((await login({ passcode: "1234" })).statusCode).toBe(400);
  });

  it("the token is an officer token (never usable as a citizen)", async () => {
    const res = await login({ id: NEW_ID, passcode: "new-passcode-88" });
    const claims = JSON.parse(Buffer.from(res.json().token.split(".")[1], "base64url").toString());
    expect(claims.kind).toBe("officer");
  });

  it("is rate-limited against guessing (10 a minute)", async () => {
    let last = 0;
    for (let i = 0; i < 14; i++) last = (await login({ id: NEW_ID, passcode: `guess-${i}` })).statusCode;
    expect(last).toBe(429);
  });
});

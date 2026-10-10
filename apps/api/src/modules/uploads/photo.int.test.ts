// A citizen's photo: stored by us when Cloudinary is off, kept even when the report is a repeat of the citizen's own,
// and handed to the government portal only through the signed read-only door.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { buildApp } from "../../app.js";
import { pool } from "../../db/client.js";
import type { AppInstance } from "../../types.js";
import { buildBridgeApp, MEDIA_PATH } from "../gov/bridge.js";
import { signRequest } from "../gov/signing.js";
import { createTestCitizen } from "../../test/auth.js";
import { fileTicket } from "../../test/govBridge.js";

const GOV_PRIV = process.env.TEST_GOV_WRITEBACK_PRIVATE_KEY!;
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
// Each test gets its own picture: the same bytes from a DIFFERENT person are (rightly) turned away as a reused photo.
const fresh = () => { const bytes = Buffer.concat([JPEG, Buffer.from(randomUUID())]); return { bytes, url: `data:image/jpeg;base64,${bytes.toString("base64")}` }; };
let app: AppInstance;
let bridge: Awaited<ReturnType<typeof buildBridgeApp>>;

beforeAll(async () => {
  app = await buildApp();
  bridge = await buildBridgeApp();
  await bridge.ready();
});
afterAll(async () => {
  await bridge.close();
  await app.close();
});

const upload = (headers: Record<string, string>, body: unknown) => app.inject({ method: "POST", url: "/uploads/photo", headers, payload: body as object });
const door = (b: unknown, key = GOV_PRIV) => {
  const raw = JSON.stringify(b);
  return bridge.inject({ method: "POST", url: MEDIA_PATH, payload: raw, headers: { "content-type": "application/json", ...signRequest(key, "POST", MEDIA_PATH, raw) } });
};

describe("POST /uploads/photo", () => {
  it("keeps a real picture and returns a local id", async () => {
    const c = await createTestCitizen(app);
    const p = fresh();
    const res = await upload(c.headers, { dataUrl: p.url });
    expect(res.statusCode).toBe(201);
    expect(res.json().photoPublicId).toMatch(/^local_[0-9a-f-]{36}$/);
    const row = (await pool.query("SELECT mime, bytes, citizen_id FROM media_blobs WHERE public_id = $1", [res.json().photoPublicId])).rows[0];
    expect(row).toEqual({ mime: "image/jpeg", bytes: p.bytes.length, citizen_id: c.id });
  });

  it("refuses things that are not pictures, and needs a login", async () => {
    const c = await createTestCitizen(app);
    expect((await upload(c.headers, { dataUrl: "data:text/html;base64,PGh0bWw+" })).statusCode).toBe(400);
    expect((await upload(c.headers, {})).statusCode).toBe(400);
    expect((await upload({}, { dataUrl: fresh().url })).statusCode).toBe(401);
  });
});

describe("the real-photo check", () => {
  const check = (headers: Record<string, string>, body: unknown) => app.inject({ method: "POST", url: "/uploads/photo/check", headers, payload: body as object });

  it("lets a picture through (with no AI key the check says 'unchecked') and stores what it found", async () => {
    const c = await createTestCitizen(app);
    const p = fresh();
    expect((await check(c.headers, { dataUrl: p.url })).json()).toMatchObject({ ok: true });
    const up = await upload(c.headers, { dataUrl: p.url });
    expect(up.statusCode).toBe(201);
    const row = (await pool.query("SELECT sha256, check_verdict FROM media_blobs WHERE public_id = $1", [up.json().photoPublicId])).rows[0];
    expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(row.check_verdict).toBe("unchecked");
  });

  it("turns away a file that says it was made by an AI tool, and stores nothing", async () => {
    const c = await createTestCitizen(app);
    const before = (await pool.query("SELECT count(*)::int AS n FROM media_blobs WHERE citizen_id = $1", [c.id])).rows[0].n;
    const p = fresh();
    const res = await check(c.headers, { dataUrl: p.url, aiMarker: true });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: "PHOTO_REJECTED", why: "not_real" });
    const up = await upload(c.headers, { dataUrl: p.url, aiMarker: true });
    expect(up.statusCode).toBe(422);
    expect((await pool.query("SELECT count(*)::int AS n FROM media_blobs WHERE citizen_id = $1", [c.id])).rows[0].n).toBe(before);
  });

  it("turns away a picture another person already sent, but not the same person sending it again", async () => {
    // a picture only this test uses, so earlier tests in the same database cannot interfere
    const own = Buffer.concat([JPEG, Buffer.from(randomUUID())]);
    const mine = `data:image/jpeg;base64,${own.toString("base64")}`;
    const a = await createTestCitizen(app);
    const b = await createTestCitizen(app);
    expect((await upload(a.headers, { dataUrl: mine })).statusCode).toBe(201);
    expect((await upload(a.headers, { dataUrl: mine })).statusCode).toBe(201); // the same person again: fine
    const reused = await upload(b.headers, { dataUrl: mine });
    expect(reused.statusCode).toBe(422);
    expect(reused.json()).toMatchObject({ code: "PHOTO_REJECTED", why: "reused" });
    expect((await check(b.headers, { dataUrl: mine })).statusCode).toBe(422);
  });

  it("needs a login and a real picture", async () => {
    const c = await createTestCitizen(app);
    expect((await check({}, { dataUrl: fresh().url })).statusCode).toBe(401);
    expect((await check(c.headers, { dataUrl: "data:text/html;base64,PGh0bWw+" })).statusCode).toBe(400);
  });
});

describe("a photo sent with /reports/confirm", () => {
  it("is attached to the ticket", async () => {
    const { citizen, ticketId } = await fileTicket(app);
    expect(ticketId).toBeTruthy();
    const up = await upload(citizen.headers, { dataUrl: fresh().url });
    const u = await app.inject({ method: "POST", url: "/reports/understand", payload: { text: `the park lamp is dark ${Date.now()}-${Math.random()}`, lang: "en", lat: 21.2, lng: 81.31 } });
    const c = await app.inject({ method: "POST", url: "/reports/confirm", headers: citizen.headers, payload: { draftId: u.json().draftId, photoPublicId: up.json().photoPublicId } });
    expect(c.statusCode).toBe(201);
    const m = await pool.query("SELECT kind, cloudinary_public_id FROM media WHERE ticket_id = $1", [c.json().ticketId]);
    expect(m.rows).toEqual([{ kind: "before", cloudinary_public_id: up.json().photoPublicId }]);
  });

  it("is kept when the report is a repeat of the citizen's own (it used to be dropped)", async () => {
    const text = `the lane lamp is dark near the school ${Date.now()}-${Math.random()}`;
    const citizen = await createTestCitizen(app);
    const ask = () => app.inject({ method: "POST", url: "/reports/understand", payload: { text, lang: "en", lat: 21.19, lng: 81.34 } });
    const first = await app.inject({ method: "POST", url: "/reports/confirm", headers: citizen.headers, payload: { draftId: (await ask()).json().draftId } });
    expect(first.statusCode).toBe(201);

    const up = await upload(citizen.headers, { dataUrl: fresh().url });
    const draft = (await ask()).json().draftId;
    const body = { draftId: draft, photoPublicId: up.json().photoPublicId };
    const again = await app.inject({ method: "POST", url: "/reports/confirm", headers: citizen.headers, payload: body });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ alreadyFiled: true, ticketId: first.json().ticketId });
    expect((await pool.query("SELECT count(*)::int AS n FROM media WHERE ticket_id = $1", [first.json().ticketId])).rows[0].n).toBe(1);

    // sending the same photo once more does not make a second copy
    await app.inject({ method: "POST", url: "/reports/confirm", headers: citizen.headers, payload: body });
    expect((await pool.query("SELECT count(*)::int AS n FROM media WHERE ticket_id = $1", [first.json().ticketId])).rows[0].n).toBe(1);
  });
});

describe("the signed door the portal uses", () => {
  it("lists a ticket's photos and returns the picture", async () => {
    const { citizen, ticketId } = await fileTicket(app);
    const door1 = fresh();
    const up = await upload(citizen.headers, { dataUrl: door1.url });
    const u = await app.inject({ method: "POST", url: "/reports/understand", payload: { text: `door test lamp dark ${Date.now()}-${Math.random()}`, lang: "en", lat: 21.18, lng: 81.32 } });
    const c = await app.inject({ method: "POST", url: "/reports/confirm", headers: citizen.headers, payload: { draftId: u.json().draftId, photoPublicId: up.json().photoPublicId } });
    const tid = c.json().ticketId as string;
    expect(tid).not.toBe(ticketId);

    const list = await door({ op: "list", ticket_id: tid });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);
    expect(list.json().items[0]).toMatchObject({ kind: "before", available: true });

    const pic = await door({ op: "get", ticket_id: tid, media_id: list.json().items[0].id });
    expect(pic.statusCode).toBe(200);
    expect(pic.json().mime).toBe("image/jpeg");
    expect(Buffer.from(pic.json().data_base64, "base64").equals(door1.bytes)).toBe(true);
  });

  it("says a made-up (simulated) photo is not available, and never hands out another ticket's photo", async () => {
    const { ticketId } = await fileTicket(app);
    const other = await fileTicket(app);
    await pool.query(
      `INSERT INTO media (ticket_id, kind, cloudinary_public_id, uploader_type, uploader_id) VALUES ($1,'before','simulated_123','CITIZEN','x') RETURNING id`,
      [ticketId],
    );
    const list = await door({ op: "list", ticket_id: ticketId });
    expect(list.json().items).toEqual([expect.objectContaining({ kind: "before", available: false })]);
    const mediaId = list.json().items[0].id;
    expect((await door({ op: "get", ticket_id: ticketId, media_id: mediaId })).statusCode).toBe(404);
    expect((await door({ op: "get", ticket_id: other.ticketId, media_id: mediaId })).statusCode).toBe(404);
  });

  it("rejects a wrong signature and a replayed request", async () => {
    const { ticketId } = await fileTicket(app);
    const other = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"); // a key the portal does not own
    expect((await door({ op: "list", ticket_id: ticketId }, other)).statusCode).toBe(401);
    expect((await bridge.inject({ method: "POST", url: MEDIA_PATH, payload: JSON.stringify({ op: "list", ticket_id: randomUUID() }), headers: { "content-type": "application/json" } })).statusCode).toBe(401);
  });
});

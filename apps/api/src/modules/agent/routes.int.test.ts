import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { buildApp } from "../../app.js";
import type { AppInstance } from "../../types.js";
import { env } from "../../env.js";
import { pool } from "../../db/client.js";
import { createTestCitizen } from "../../test/auth.js";

describe("POST /agent/session (Bolo)", () => {
  let app: AppInstance;
  const saved = { key: env.ELEVEN_API_KEY, agent: env.ELEVEN_AGENT_ID, cap: env.AGENT_DAILY_CAP, langs: env.AGENT_LANGS };
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { Object.assign(env, { ELEVEN_API_KEY: saved.key, ELEVEN_AGENT_ID: saved.agent, AGENT_DAILY_CAP: saved.cap, AGENT_LANGS: saved.langs }); });
  afterEach(() => { vi.restoreAllMocks(); Object.assign(env, { ELEVEN_API_KEY: saved.key, ELEVEN_AGENT_ID: saved.agent, AGENT_DAILY_CAP: saved.cap, AGENT_LANGS: saved.langs }); });

  const configure = () => Object.assign(env, { ELEVEN_API_KEY: "test-key", ELEVEN_AGENT_ID: "agent_test", AGENT_DAILY_CAP: 2, AGENT_LANGS: "hi,en" });
  const mockEleven = (ok = true) =>
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      ok ? new Response(JSON.stringify({ signed_url: "wss://example.test/convai?token=abc" }), { status: 200 }) : new Response("nope", { status: 500 }),
    );
  const post = (headers: Record<string, string>, body: object = { lang: "hi" }) =>
    app.inject({ method: "POST", url: "/agent/session", headers, payload: body });

  it("needs a signed-in citizen", async () => {
    configure();
    expect((await post({})).statusCode).toBe(401);
  });

  it("says it is not set up when there is no key or agent", async () => {
    const c = await createTestCitizen(app);
    Object.assign(env, { ELEVEN_API_KEY: "", ELEVEN_AGENT_ID: "" });
    const res = await post(c.headers);
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe("AGENT_NOT_CONFIGURED");
    const st = await app.inject({ method: "GET", url: "/agent/status" });
    expect(st.json().enabled).toBe(false);
  });

  it("returns a signed url, the greeting, the language's voice, and never the API key", async () => {
    configure();
    const spy = mockEleven();
    const c = await createTestCitizen(app);
    const res = await post(c.headers, { lang: "en" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.signedUrl).toContain("wss://");
    expect(body.firstMessage).toMatch(/Bolo/);
    expect(body.voiceId).toBe("oO7sLA3dWfQXsKeSAjpA");
    expect(body.maxSeconds).toBe(180);
    expect(JSON.stringify(body)).not.toContain("test-key");
    const [url, init] = spy.mock.calls[0]!;
    expect(String(url)).toContain("agent_id=agent_test");
    expect((init as RequestInit).headers).toMatchObject({ "xi-api-key": "test-key" });
    expect((await pool.query("SELECT count(*)::int AS n FROM agent_sessions WHERE citizen_id = $1", [c.id])).rows[0].n).toBe(1);
  });

  it("refuses languages that are not enabled yet", async () => {
    configure();
    mockEleven();
    const c = await createTestCitizen(app);
    const res = await post(c.headers, { lang: "ta" });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe("AGENT_LANG");
  });

  it("applies the daily cap per citizen", async () => {
    configure();
    mockEleven();
    const a = await createTestCitizen(app);
    const b = await createTestCitizen(app);
    expect((await post(a.headers)).statusCode).toBe(200);
    expect((await post(a.headers)).statusCode).toBe(200);
    const third = await post(a.headers);
    expect(third.statusCode).toBe(429);
    expect(third.json().code).toBe("AGENT_CAP");
    expect((await post(b.headers)).statusCode).toBe(200); // someone else is not affected
  });

  it("reports an upstream failure without creating a session row", async () => {
    configure();
    mockEleven(false);
    const c = await createTestCitizen(app);
    const res = await post(c.headers);
    expect(res.statusCode).toBe(502);
    expect(res.json().code).toBe("AGENT_UPSTREAM");
    expect((await pool.query("SELECT count(*)::int AS n FROM agent_sessions WHERE citizen_id = $1", [c.id])).rows[0].n).toBe(0);
  });
});

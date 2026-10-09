// Test for Build Map #D5 / Bible §17.5 — POST /uploads/sign
import { describe, it, expect } from "vitest";
import { buildApp } from "../../app.js";
import { authHeaders } from "../../test/auth.js";

describe("POST /uploads/sign", () => {
  it("returns 200 with signature parameters for direct upload", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/uploads/sign",
      headers: { "content-type": "application/json", ...(await authHeaders(app)) },
      payload: { folder: "nyaysetu/reports" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      signature: string;
      timestamp: number;
      apiKey: string;
      cloudName: string;
      folder: string;
      simulated: boolean;
    }>();

    expect(body).toMatchObject({
      signature: expect.any(String),
      timestamp: expect.any(Number),
      apiKey: expect.any(String),
      cloudName: expect.any(String),
      folder: "nyaysetu/reports",
      simulated: expect.any(Boolean),
    });
    expect(body.signature.length).toBeGreaterThan(0);
    expect(body.timestamp).toBeGreaterThan(0);
  });

  it("defaults folder to nyaysetu/reports when empty payload sent", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/uploads/sign",
      headers: { "content-type": "application/json", ...(await authHeaders(app)) },
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ folder: string }>();
    expect(body.folder).toBe("nyaysetu/reports");
  });
});

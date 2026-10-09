// Build map #D6 / #C3 — GET /jurisdiction/resolve integration test
import { describe, it, expect } from "vitest";
import { buildApp } from "../../app.js";

describe("GET /jurisdiction/resolve", () => {
  it("returns 200 and a label for valid coordinates", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/jurisdiction/resolve?lat=21.1938&lng=81.3509",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      method: string;
      label: { hi: string; en: string };
    }>();

    expect(body).toHaveProperty("method");
    expect(body).toHaveProperty("label");
    expect(body.label.hi.length).toBeGreaterThan(0);
    expect(body.label.en.length).toBeGreaterThan(0);
  });

  it("returns 400 when invalid lat/lng are passed", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/jurisdiction/resolve?lat=999&lng=81.3509",
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<{ code: string }>();
    expect(body.code).toBe("INVALID_COORDINATES");
  });
});

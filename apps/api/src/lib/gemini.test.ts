import { describe, it, expect } from "vitest";
import { embedText, isMockMode } from "./gemini.js";

describe("gemini client (mock mode, no GEMINI_API_KEY in test env)", () => {
  it("runs in mock mode with no key configured", () => {
    expect(isMockMode).toBe(true);
  });

  it("embedText is deterministic: same text -> same vector", async () => {
    const a = await embedText("naali jam hai");
    const b = await embedText("naali jam hai");
    expect(a).toEqual(b);
  });

  it("embedText returns a unit-normalized 768-dim vector", async () => {
    const v = await embedText("streetlight band hai");
    expect(v).toHaveLength(768);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("different text produces a different vector", async () => {
    const a = await embedText("pani nahi aa raha");
    const b = await embedText("bijli gul hai");
    expect(a).not.toEqual(b);
  });
});

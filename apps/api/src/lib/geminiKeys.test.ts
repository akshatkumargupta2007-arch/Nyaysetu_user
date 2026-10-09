import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetKeyStateForTests, geminiFetch, parseKeys } from "./geminiKeys.js";

const reply = (status: number, body = "{}") => new Response(body, { status });
const keyUsed = (call: unknown[]) => ((call[1] as RequestInit).headers as Record<string, string>)["x-goog-api-key"];

describe("Gemini key rotation", () => {
  beforeEach(() => { _resetKeyStateForTests(); vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());

  it("merges the single key and the list without duplicates", () => {
    expect(parseKeys("a", " b, a ,c,,")).toEqual(["a", "b", "c"]);
    expect(parseKeys("", "")).toEqual([]);
  });

  it("moves to the next key when one is out of quota, and sticks to the working one", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockImplementation(async (_u, init) =>
      keyUsed([_u, init]) === "k1" ? reply(429, "quota") : reply(200));
    expect((await geminiFetch("http://x", {}, ["k1", "k2"])).status).toBe(200);
    expect(f.mock.calls.map((c) => keyUsed(c))).toEqual(["k1", "k2"]);
    await geminiFetch("http://x", {}, ["k1", "k2"]);
    expect(keyUsed(f.mock.calls[2]!)).toBe("k2"); // k1 is parked, no wasted call
  });

  it("skips an invalid key, but does not rotate on an ordinary bad request or server error", async () => {
    const f = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(reply(400, "API key not valid"))
      .mockResolvedValueOnce(reply(200));
    expect((await geminiFetch("http://x", {}, ["bad", "good"])).status).toBe(200);
    _resetKeyStateForTests();
    f.mockReset().mockResolvedValue(reply(400, "bad request body"));
    expect((await geminiFetch("http://x", {}, ["a", "b"])).status).toBe(400);
    expect(f).toHaveBeenCalledTimes(1);
    f.mockReset().mockResolvedValue(reply(503));
    expect((await geminiFetch("http://x", {}, ["a", "b"])).status).toBe(503);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("returns the last failure when every key is exhausted, and never puts the key in the URL", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(429, "quota"));
    expect((await geminiFetch("http://x/y", {}, ["k1", "k2"])).status).toBe(429);
    expect(f).toHaveBeenCalledTimes(2);
    expect(String(f.mock.calls[0]![0])).not.toContain("k1");
  });
});

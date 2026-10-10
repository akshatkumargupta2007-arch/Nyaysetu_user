import { describe, expect, it } from "vitest";
import { REFUSE_CONFIDENCE, combine, isRefusal, sha256Of } from "./photoCheck.js";

const look = (verdict: Parameters<typeof isRefusal>[0]["verdict"], confidence: number, reason = "r") => ({ verdict, confidence, reason });

describe("photo check decision", () => {
  it("refuses only a CONFIDENT 'not a real photo'", () => {
    expect(isRefusal(look("ai_generated", 0.95))).toBe(true);
    expect(isRefusal(look("illustration_or_render", REFUSE_CONFIDENCE))).toBe(true);
    expect(isRefusal(look("screenshot_or_stock", 0.9))).toBe(true);
    expect(isRefusal(look("ai_generated", 0.6))).toBe(false); // not sure enough
    expect(isRefusal(look("real_photo", 0.99))).toBe(false);
    expect(isRefusal(look("unclear", 0.99))).toBe(false);
    expect(isRefusal({ verdict: "unchecked", confidence: null })).toBe(false); // an outage never blocks anyone
  });

  it("a real-looking picture needs no second look and passes as it is", () => {
    const first = look("real_photo", 0.97);
    expect(combine(first, null)).toEqual(first);
  });

  it("two confident looks in a row refuse, and keep the more confident one", () => {
    const out = combine(look("ai_generated", 0.9, "a"), look("ai_generated", 0.97, "b"));
    expect(isRefusal(out)).toBe(true);
    expect(out.reason).toBe("b");
  });

  it("a second look that doubts the first turns it into 'unclear' (accepted, but marked)", () => {
    const out = combine(look("ai_generated", 0.95, "garbled signs"), look("real_photo", 0.8));
    expect(out.verdict).toBe("unclear");
    expect(isRefusal(out)).toBe(false);
    expect(out.reason).toContain("garbled signs");
    const out2 = combine(look("ai_generated", 0.95), look("ai_generated", 0.7)); // second not confident enough
    expect(out2.verdict).toBe("unclear");
  });

  it("fingerprints the bytes, so the same picture is recognised", () => {
    expect(sha256Of(Buffer.from("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Of(Buffer.from("abc"))).not.toBe(sha256Of(Buffer.from("abd")));
  });
});

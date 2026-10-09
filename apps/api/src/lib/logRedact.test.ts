import { describe, expect, it } from "vitest";
import { redactUrl, reqSerializer } from "./logRedact.js";

describe("log redaction", () => {
  it("hides the token of the live streams but keeps the rest of the url", () => {
    expect(redactUrl("/me/stream?token=eyJabc.def.ghi")).toBe("/me/stream?token=[redacted]");
    expect(redactUrl("/reports/1/stream?foo=1&token=secret&bar=2")).toBe("/reports/1/stream?foo=1&token=[redacted]&bar=2");
    expect(redactUrl("/x?access_token=zzz&TOKEN=yyy")).toBe("/x?access_token=[redacted]&TOKEN=[redacted]");
  });
  it("leaves ordinary urls alone", () => {
    expect(redactUrl("/me/reports")).toBe("/me/reports");
    expect(redactUrl("/tickets/abc/tracking?lang=hi")).toBe("/tickets/abc/tracking?lang=hi");
    expect(redactUrl(undefined)).toBeUndefined();
  });
  it("the pino serializer cleans the url and keeps the standard fields", () => {
    const out = reqSerializer({ method: "GET", url: "/me/stream?token=abc", host: "localhost:8080", ip: "1.2.3.4", socket: { remotePort: 5 } });
    expect(out).toEqual({ method: "GET", url: "/me/stream?token=[redacted]", host: "localhost:8080", remoteAddress: "1.2.3.4", remotePort: 5 });
    expect(JSON.stringify(out)).not.toContain("abc");
  });
});

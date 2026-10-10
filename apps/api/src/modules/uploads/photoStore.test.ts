import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES, isLocalPhotoId, isSafeCloudinaryId, isSimulatedPhotoId, parsePhotoDataUrl, sniffMime } from "./photoStore.js";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 0, 0, 0]), Buffer.from("WEBP")]);
const url = (mime: string, b: Buffer) => `data:${mime};base64,${b.toString("base64")}`;

describe("photo store", () => {
  it("recognises a real picture by its first bytes", () => {
    expect(sniffMime(JPEG)).toBe("image/jpeg");
    expect(sniffMime(PNG)).toBe("image/png");
    expect(sniffMime(WEBP)).toBe("image/webp");
    expect(sniffMime(Buffer.from("<html>"))).toBeNull();
  });

  it("accepts a resized JPEG sent as a data URL", () => {
    const p = parsePhotoDataUrl(url("image/jpeg", JPEG));
    expect(p?.mime).toBe("image/jpeg");
    expect(p?.bytes.equals(JPEG)).toBe(true);
  });

  it("trusts the bytes, not the label", () => {
    expect(parsePhotoDataUrl(url("image/jpeg", PNG))?.mime).toBe("image/png");
  });

  it("refuses things that are not pictures", () => {
    expect(parsePhotoDataUrl(url("image/jpeg", Buffer.from("<script>alert(1)</script>")))).toBeNull();
    expect(parsePhotoDataUrl("data:text/html;base64,PGh0bWw+")).toBeNull();
    expect(parsePhotoDataUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBeNull();
    expect(parsePhotoDataUrl("https://example.com/a.jpg")).toBeNull();
    expect(parsePhotoDataUrl("data:image/jpeg;base64,")).toBeNull();
    expect(parsePhotoDataUrl("")).toBeNull();
  });

  it("refuses a picture that is too large", () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(MAX_PHOTO_BYTES)]);
    expect(parsePhotoDataUrl(url("image/jpeg", big))).toBeNull();
  });

  it("tells our own ids from Cloudinary and simulated ones", () => {
    expect(isLocalPhotoId("local_123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isLocalPhotoId("local_x")).toBe(false);
    expect(isSimulatedPhotoId("simulated_1791603047683")).toBe(true);
    expect(isSimulatedPhotoId("nyaysetu/reports/abc")).toBe(false);
  });

  it("only builds a Cloudinary address from a safe id", () => {
    expect(isSafeCloudinaryId("nyaysetu/reports/abc123")).toBe(true);
    expect(isSafeCloudinaryId("../../etc/passwd")).toBe(false);
    expect(isSafeCloudinaryId("a?x=1")).toBe(false);
    expect(isSafeCloudinaryId("a b")).toBe(false);
  });
});

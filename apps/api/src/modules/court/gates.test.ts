import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { hashSet, sha256Hex } from "./hashes.js";
import { runGates, type ProofFile, type Reference } from "./gates.js";
import { templateContract } from "./contract.js";

/** A repeatable "photo": blocky random greys, so different seeds are different pictures. */
async function picture(seed: number, w = 480, h = 360): Promise<Buffer> {
  let s = seed >>> 0;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 0xffffffff; };
  const bw = 16, bh = 12; const small = Buffer.alloc(bw * bh);
  for (let i = 0; i < small.length; i++) small[i] = Math.floor(rnd() * 255);
  return sharp(small, { raw: { width: bw, height: bh, channels: 1 } }).resize(w, h, { kernel: "cubic" }).jpeg({ quality: 90 }).toBuffer();
}
const file = (name: string, bytes: Buffer, video = false): ProofFile => ({ name, mime: video ? "video/mp4" : "image/jpeg", bytes, isVideo: video });
const ticket = { lat: 21.185, lng: 81.33 };
const light = templateContract("00000000-0000-4000-8000-000000000001", "LIGHT_AREA_DARK", "light dead");
const road = templateContract("00000000-0000-4000-8000-000000000002", "ROAD_POTHOLE", "pothole");

async function refFrom(buf: Buffer, kind = "before"): Promise<Reference> { return { id: "r", kind, sha256: sha256Hex(buf), hashes: await hashSet(buf) }; }
const ids = (g: { gates: { id: string; status: string }[] }, id: string) => g.gates.find((x) => x.id === id)!;

describe("reuse gates G1 and G2", () => {
  it("catches the identical file (G1) and never calls a model for it", async () => {
    const before = await picture(1);
    const g = await runGates({ ticket, contract: road, files: [file("again.jpg", before)], references: [await refFrom(before)] });
    expect(ids(g, "G1").status).toBe("fail");
    expect(g.hardFail).toBe(true);
  });
  it("catches a mirrored copy, a 75% crop and a heavily recompressed copy of the original", async () => {
    const before = await picture(2);
    const refs = [await refFrom(before)];
    const variants: Record<string, Buffer> = {
      mirrored: await sharp(before).flop().jpeg({ quality: 85 }).toBuffer(),
      cropped: await sharp(before).extract({ left: 0, top: 0, width: 360, height: 270 }).jpeg({ quality: 85 }).toBuffer(),
      recompressed: await sharp(before).jpeg({ quality: 25 }).toBuffer(),
      resized: await sharp(before).resize(240, 180).jpeg({ quality: 80 }).toBuffer(),
    };
    for (const [name, buf] of Object.entries(variants)) {
      const g = await runGates({ ticket, contract: road, files: [file(`${name}.jpg`, buf)], references: refs });
      expect(g.hardFail, name).toBe(true);
      expect(["G1", "G2"].some((id) => ids(g, id).status === "fail"), name).toBe(true);
    }
  });
  it("does not flag a genuinely different picture", async () => {
    const refs = [await refFrom(await picture(3))];
    for (const seed of [10, 11, 12, 13, 14, 15, 16, 17]) {
      const g = await runGates({ ticket, contract: road, files: [file("new.jpg", await picture(seed))], references: refs });
      expect(ids(g, "G2").status, `seed ${seed}`).toBe("pass");
    }
  });
});

describe("sun and time gates G4 and G5", () => {
  it("a daylight capture time fails G5 for a streetlight contract, with no AI needed", async () => {
    const g = await runGates({ ticket, contract: light, files: [file("day.jpg", await picture(20))], references: [], declaredAt: new Date("2026-10-09T06:30:00Z"), now: new Date("2026-10-09T07:00:00Z") });
    expect(ids(g, "G5").status).toBe("fail");
    expect(g.hardFail).toBe(true);
  });
  it("a night capture time passes G5", async () => {
    const g = await runGates({ ticket, contract: light, files: [file("night.mp4", Buffer.from("not-a-real-video"), true)], references: [], declaredAt: new Date("2026-10-09T17:30:00Z"), now: new Date("2026-10-09T17:40:00Z") });
    expect(ids(g, "G5").status).toBe("pass");
    expect(g.hardFail).toBe(false);
  });
  it("with no capture time at all G5 is unknown (not a failure) and G3 is weak", async () => {
    const g = await runGates({ ticket, contract: light, files: [file("x.jpg", await picture(21))], references: [] });
    expect(ids(g, "G5").status).toBe("unknown");
    expect(ids(g, "G3").status).toBe("weak");
    expect(g.hardFail).toBe(false);
  });
  it("an old capture time fails G4; a contract that needs no darkness skips G5", async () => {
    const g = await runGates({ ticket, contract: road, files: [file("old.jpg", await picture(22))], references: [], declaredAt: new Date("2026-09-01T10:00:00Z"), now: new Date("2026-10-09T10:00:00Z") });
    expect(ids(g, "G4").status).toBe("fail");
    expect(ids(g, "G5").status).toBe("pass");
  });
});

describe("instruction-in-image gate G6", () => {
  it("blocks the AI when the scan says yes, and stays weak when the scan could not run", async () => {
    const f = file("note.jpg", await picture(30));
    const yes = await runGates({ ticket, contract: road, files: [f], references: [], classifyInstruction: async () => "yes" });
    expect(ids(yes, "G6").status).toBe("fail"); expect(yes.blockAi).toBe(true); expect(yes.hardFail).toBe(false);
    const unknown = await runGates({ ticket, contract: road, files: [f], references: [], classifyInstruction: async () => "unknown" });
    expect(ids(unknown, "G6").status).toBe("weak"); expect(unknown.blockAi).toBe(false);
  });
});

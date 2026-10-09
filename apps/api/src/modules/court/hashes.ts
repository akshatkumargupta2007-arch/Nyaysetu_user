// Reuse detection helpers: exact bytes plus perceptual hashes of the picture, its mirror and several crops, so a
// flipped, cropped or recompressed copy of an old photo is still recognised. Pure functions, no database.
import { createHash } from "node:crypto";
import sharp from "sharp";
import { computeDHash, hammingDistance } from "../proof/dhash.js";

export interface HashSet { d: string; m: string; c: string[] }
export const sha256Hex = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

export async function hashSet(buf: Buffer): Promise<HashSet> {
  const img = sharp(buf).rotate();
  const meta = await img.metadata();
  const w = meta.width ?? 0, h = meta.height ?? 0;
  const d = await computeDHash(await img.clone().toBuffer());
  const m = await computeDHash(await img.clone().flop().toBuffer());
  const c: string[] = [];
  if (w >= 64 && h >= 64) {
    const cw = Math.round(w * 0.75), ch = Math.round(h * 0.75);
    for (const [left, top] of [[0, 0], [w - cw, 0], [0, h - ch], [w - cw, h - ch], [Math.round((w - cw) / 2), Math.round((h - ch) / 2)]] as const) {
      c.push(await computeDHash(await img.clone().extract({ left, top, width: cw, height: ch }).toBuffer()));
    }
  }
  return { d, m, c };
}

export interface ReuseHit { distance: number; via: "same" | "mirrored" | "cropped" }
/** Smallest distance between a new photo and one reference, in either direction (the reference may be the cropped one). */
export function reuseDistance(sub: HashSet, ref: HashSet, sameThreshold: number, variantThreshold: number): ReuseHit | null {
  const hits: ReuseHit[] = [];
  const dd = hammingDistance(sub.d, ref.d);
  if (dd <= sameThreshold) hits.push({ distance: dd, via: "same" });
  const dm = Math.min(hammingDistance(sub.m, ref.d), hammingDistance(sub.d, ref.m));
  if (dm <= variantThreshold) hits.push({ distance: dm, via: "mirrored" });
  const crops = [...sub.c.map((x) => hammingDistance(x, ref.d)), ...ref.c.map((x) => hammingDistance(sub.d, x)), ...sub.c.map((x) => hammingDistance(x, ref.m)), ...sub.c.map((x) => hammingDistance(x, ref.d))];
  const dc = crops.length ? Math.min(...crops) : 99;
  if (dc <= variantThreshold) hits.push({ distance: dc, via: "cropped" });
  return hits.length ? hits.sort((a, b) => a.distance - b.distance)[0]! : null;
}

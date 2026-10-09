// Build map #C9 — perceptual difference-hashing (Bible §8). Unlike a
// cryptographic hash, dHash stays close for a cropped/resized/recompressed
// copy of the same photo, which is exactly the "same old photo re-uploaded
// as proof of resolution" fraud pattern (Bible §8's closure-gate kill shot).
//
// Algorithm: grayscale -> resize to 9x8 -> compare each pixel to its right
// neighbour -> 64-bit fingerprint. Two images are "the same" if their
// Hamming distance is small.
import sharp from "sharp";

const HASH_WIDTH = 9; // 9 columns so there are 8 horizontal comparisons per row
const HASH_HEIGHT = 8;

/** Returns a 64-character '0'/'1' string — stored directly in Postgres's bit(64) column. */
export async function computeDHash(imageBuffer: Buffer): Promise<string> {
  const { data } = await sharp(imageBuffer)
    .grayscale()
    .resize(HASH_WIDTH, HASH_HEIGHT, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = "";
  for (let row = 0; row < HASH_HEIGHT; row++) {
    for (let col = 0; col < HASH_WIDTH - 1; col++) {
      const left = data[row * HASH_WIDTH + col]!;
      const right = data[row * HASH_WIDTH + col + 1]!;
      bits += left > right ? "1" : "0";
    }
  }
  return bits; // 64 bits: 8 rows * 8 comparisons
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new Error(`hammingDistance: length mismatch (${a.length} vs ${b.length})`);
  }
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) distance++;
  }
  return distance;
}

export const REUSE_SAME_TICKET_THRESHOLD = 10; // Bible §8: re-uploading the citizen's own before photo
export const REUSE_CROSS_TICKET_THRESHOLD = 6; // Bible §9/B#C9: reused from a different ticket entirely

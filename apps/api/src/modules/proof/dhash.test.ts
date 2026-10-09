// Build map #C9 test: dHash must stay close for a cropped/resized/
// recompressed copy of the same photo, and be clearly far for an unrelated
// photo — this is the exact fraud pattern the closure gate (Bible §8) must
// catch: re-uploading the citizen's own "before" photo as "after" proof.
//
// Fixtures are synthesized with sharp rather than committed as binary
// files, so the test is fully reproducible with no repo bloat. A richer
// fixtures folder with real device photos is Phase I's eval/proof_fixtures/
// concern, not this algorithm-level unit test.
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import {
  computeDHash,
  hammingDistance,
  REUSE_SAME_TICKET_THRESHOLD,
  REUSE_CROSS_TICKET_THRESHOLD,
} from "./dhash.js";

async function makeStructuredImage(opts: {
  size?: number;
  squareColor?: { r: number; g: number; b: number };
}): Promise<Buffer> {
  const size = opts.size ?? 300;
  const bg = { r: 40, g: 120, b: 200 };
  const square = opts.squareColor ?? { r: 220, g: 60, b: 30 };

  const base = sharp({
    create: { width: size, height: size, channels: 3, background: bg },
  });

  // A contrasting square in one corner gives the image real structure (so
  // dHash isn't just measuring a flat gradient), roughly simulating "a
  // pothole-shaped dark patch on a lighter road" without needing a real photo.
  const squareSize = Math.round(size * 0.4);
  const squareSvg = Buffer.from(
    `<svg width="${size}" height="${size}"><rect x="${size * 0.3}" y="${size * 0.3}" width="${squareSize}" height="${squareSize}" fill="rgb(${square.r},${square.g},${square.b})"/></svg>`,
  );

  return base.composite([{ input: squareSvg }]).jpeg().toBuffer();
}

describe("dHash (perceptual difference hash)", () => {
  it("produces a 64-bit fingerprint", async () => {
    const img = await makeStructuredImage({});
    const hash = await computeDHash(img);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[01]{64}$/);
  });

  it("an identical image has Hamming distance 0 from itself", async () => {
    const img = await makeStructuredImage({});
    const h1 = await computeDHash(img);
    const h2 = await computeDHash(img);
    expect(hammingDistance(h1, h2)).toBe(0);
  });

  it("a resized copy of the same photo stays under the reuse threshold", async () => {
    const original = await makeStructuredImage({ size: 400 });
    const resized = await sharp(original).resize(150, 150).jpeg().toBuffer();

    const h1 = await computeDHash(original);
    const h2 = await computeDHash(resized);
    expect(hammingDistance(h1, h2)).toBeLessThanOrEqual(REUSE_SAME_TICKET_THRESHOLD);
  });

  it("a cropped copy of the same photo stays under (or very close to) the reuse threshold", async () => {
    const original = await makeStructuredImage({ size: 400 });
    const cropped = await sharp(original)
      .extract({ left: 20, top: 20, width: 360, height: 360 })
      .jpeg()
      .toBuffer();

    const h1 = await computeDHash(original);
    const h2 = await computeDHash(cropped);
    // A mild crop is a harder case than resize/recompress (it shifts
    // content, not just resolution), so allow a slightly wider margin while
    // still proving it's nowhere near "a different photo" distance.
    expect(hammingDistance(h1, h2)).toBeLessThanOrEqual(REUSE_SAME_TICKET_THRESHOLD + 4);
  });

  it("a heavily recompressed copy of the same photo stays under the reuse threshold", async () => {
    const original = await makeStructuredImage({ size: 400 });
    const recompressed = await sharp(original).jpeg({ quality: 20 }).toBuffer();

    const h1 = await computeDHash(original);
    const h2 = await computeDHash(recompressed);
    expect(hammingDistance(h1, h2)).toBeLessThanOrEqual(REUSE_SAME_TICKET_THRESHOLD);
  });

  it("an unrelated photo is clearly far beyond both reuse thresholds", async () => {
    const photoA = await makeStructuredImage({ squareColor: { r: 220, g: 60, b: 30 } });
    const photoB = await makeStructuredImage({ squareColor: { r: 30, g: 200, b: 60 } });
    // Swap which corner the contrasting shape is in too, for a genuinely
    // different composition rather than just a recolour.
    const differentComposition = await sharp({
      create: { width: 300, height: 300, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="300" height="300"><circle cx="220" cy="80" r="70" fill="rgb(250,250,60)"/></svg>`,
          ),
        },
      ])
      .jpeg()
      .toBuffer();

    const hA = await computeDHash(photoA);
    const hB = await computeDHash(differentComposition);
    const distance = hammingDistance(hA, hB);
    expect(distance).toBeGreaterThan(REUSE_SAME_TICKET_THRESHOLD);
    expect(distance).toBeGreaterThan(REUSE_CROSS_TICKET_THRESHOLD);
    void photoB; // kept for readability of the "two photos, swapped colour" contrast above
  });

  it("hammingDistance throws on mismatched hash lengths rather than silently miscomparing", () => {
    expect(() => hammingDistance("0".repeat(64), "0".repeat(32))).toThrow();
  });
});

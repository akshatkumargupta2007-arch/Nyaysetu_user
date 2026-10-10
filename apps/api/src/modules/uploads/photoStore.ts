// Turns the picture the app sends (a data URL of a resized JPEG) into checked bytes. Pure and testable: no database,
// no network. Only real pictures get through: the first bytes must match JPEG, PNG or WebP, whatever the label says.

export const MAX_PHOTO_BYTES = 2_500_000;
export type PhotoMime = "image/jpeg" | "image/png" | "image/webp";
export interface ParsedPhoto { mime: PhotoMime; bytes: Buffer }

/** The kind of picture these bytes really are, judged by their first bytes. */
export function sniffMime(b: Buffer): PhotoMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

/** `data:image/jpeg;base64,....` -> checked bytes, or null when it is not a usable picture. */
export function parsePhotoDataUrl(dataUrl: string): ParsedPhoto | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!m) return null;
  const bytes = Buffer.from(m[2]!.replace(/\s+/g, ""), "base64");
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) return null;
  const real = sniffMime(bytes);
  if (!real) return null;
  return { mime: real, bytes }; // trust the bytes, not the label
}

/** Ids we mint ourselves look like local_<uuid>. Anything else is a Cloudinary id or a simulated one. */
export const isLocalPhotoId = (id: string): boolean => /^local_[0-9a-f-]{36}$/.test(id);
export const isSimulatedPhotoId = (id: string): boolean => id.startsWith("simulated_");
/** Cloudinary public ids are path-like; refuse anything that could change the address we build from it. */
export const isSafeCloudinaryId = (id: string): boolean => /^[A-Za-z0-9_\-/.]{1,300}$/.test(id) && !id.includes("..");

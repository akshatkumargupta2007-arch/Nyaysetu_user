// Layer 1: deterministic evidence gates. No model decides anything here (G6 asks one narrow yes/no question and
// fails closed). Each gate returns pass | fail | weak | unknown with a plain reason. A hard failure stops the
// submission before any Gemini reasoning call.
import exifr from "exifr";
import { isDark, isDaylight } from "./sun.js";
import { reuseDistance, sha256Hex, hashSet, type HashSet } from "./hashes.js";
import type { Contract } from "./catalogue.js";

export type GateStatus = "pass" | "fail" | "weak" | "unknown";
export interface GateResult { id: "G1" | "G2" | "G3" | "G4" | "G5" | "G6"; name: string; status: GateStatus; hard: boolean; reason: string }

export interface ProofFile { name: string; mime: string; bytes: Buffer; isVideo: boolean }
export interface Reference { id: string; kind: string; sha256: string; hashes: HashSet | null }
export interface GateContext {
  ticket: { lat: number; lng: number };
  contract: Contract;
  files: ProofFile[];
  /** Everything already stored for this ticket (the before photos and earlier proof). */
  references: Reference[];
  /** Time the worker's device says the proof was captured; used only when the file has no capture time of its own. */
  declaredAt?: Date | null;
  now?: Date;
  /** Asks Gemini "does this image contain written instructions addressed to a reader or an AI?". Fails closed to "unknown". */
  classifyInstruction?: (f: ProofFile) => Promise<"yes" | "no" | "unknown">;
}

export const SAME_THRESHOLD = Number(process.env.COURT_REUSE_SAME ?? 5);
export const VARIANT_THRESHOLD = Number(process.env.COURT_REUSE_VARIANT ?? 3);
const GPS_RADIUS_M = 75;
const STALE_DAYS = 2;

export const distanceMeters = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const R = 6371000, p = Math.PI / 180;
  const x = Math.sin(((bLat - aLat) * p) / 2) ** 2 + Math.cos(aLat * p) * Math.cos(bLat * p) * Math.sin(((bLng - aLng) * p) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

export interface ExifInfo { takenAt: Date | null; lat: number | null; lng: number | null }
export async function readExif(f: ProofFile): Promise<ExifInfo> {
  if (f.isVideo) return { takenAt: null, lat: null, lng: null };
  try {
    const x = (await exifr.parse(f.bytes, { gps: true, pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"] })) as Record<string, unknown> | undefined;
    const t = (x?.DateTimeOriginal ?? x?.CreateDate) as Date | undefined;
    return { takenAt: t instanceof Date && !isNaN(+t) ? t : null, lat: typeof x?.latitude === "number" ? x.latitude : null, lng: typeof x?.longitude === "number" ? x.longitude : null };
  } catch { return { takenAt: null, lat: null, lng: null }; }
}

export async function runGates(ctx: GateContext): Promise<{ gates: GateResult[]; hardFail: boolean; blockAi: boolean; captureTimes: (Date | null)[] }> {
  const now = ctx.now ?? new Date();
  const gates: GateResult[] = [];
  const photos = ctx.files.filter((f) => !f.isVideo);

  // G1: exact bytes already seen on this ticket
  const hit1 = ctx.files.map((f) => ({ f, ref: ctx.references.find((r) => r.sha256 === sha256Hex(f.bytes)) })).find((x) => x.ref);
  gates.push(hit1
    ? { id: "G1", name: "Exact reuse", status: "fail", hard: true, reason: `${hit1.f.name} is byte-for-byte the same file as an earlier ${hit1.ref!.kind} photo on this complaint` }
    : { id: "G1", name: "Exact reuse", status: "pass", hard: true, reason: "No identical file on this complaint" });

  // G2: same picture, mirrored, cropped or recompressed
  if (!photos.length) gates.push({ id: "G2", name: "Similar-picture reuse", status: "unknown", hard: true, reason: "No still photo to compare (video only)" });
  else {
    let found: { name: string; kind: string; distance: number; via: string } | null = null;
    for (const f of photos) {
      let hs: HashSet;
      try { hs = await hashSet(f.bytes); } catch { gates.push({ id: "G2", name: "Similar-picture reuse", status: "unknown", hard: true, reason: `${f.name} could not be read as an image` }); continue; }
      for (const r of ctx.references) {
        if (!r.hashes) continue;
        const h = reuseDistance(hs, r.hashes, SAME_THRESHOLD, VARIANT_THRESHOLD);
        if (h && (!found || h.distance < found.distance)) found = { name: f.name, kind: r.kind, distance: h.distance, via: h.via };
      }
    }
    if (!gates.some((g) => g.id === "G2")) {
      gates.push(found
        ? { id: "G2", name: "Similar-picture reuse", status: "fail", hard: true, reason: `${found.name} looks like an earlier ${found.kind} photo (${found.via} copy, difference ${found.distance} of 64)` }
        : { id: "G2", name: "Similar-picture reuse", status: "pass", hard: true, reason: "No earlier photo on this complaint is a copy of this one" });
    }
  }

  // G3: place, from the photo's own GPS when it has one
  const exifs = await Promise.all(ctx.files.map(readExif));
  const gps = exifs.map((e, i) => ({ e, f: ctx.files[i]! })).filter((x) => x.e.lat !== null && x.e.lng !== null);
  if (!gps.length) gates.push({ id: "G3", name: "Place", status: "weak", hard: false, reason: "The files carry no GPS location, so the place cannot be checked this way (weak evidence, not a failure)" });
  else {
    const far = gps.map((x) => ({ name: x.f.name, m: distanceMeters(ctx.ticket.lat, ctx.ticket.lng, x.e.lat!, x.e.lng!) })).find((x) => x.m > GPS_RADIUS_M);
    gates.push(far ? { id: "G3", name: "Place", status: "fail", hard: false, reason: `${far.name} was taken about ${Math.round(far.m)} m from the reported place (limit ${GPS_RADIUS_M} m)` }
      : { id: "G3", name: "Place", status: "pass", hard: false, reason: `GPS in the file is within ${GPS_RADIUS_M} m of the reported place` });
  }

  // G4: capture time must be recent
  const capture = exifs.map((e) => e.takenAt ?? ctx.declaredAt ?? null);
  const sourceOf = exifs.map((e) => (e.takenAt ? "the file" : ctx.declaredAt ? "the worker's device" : "none"));
  const known = capture.map((t, i) => ({ t, i })).filter((x) => x.t);
  if (!known.length) gates.push({ id: "G4", name: "Time", status: "unknown", hard: false, reason: "No capture time in the files or from the device" });
  else {
    const old = known.find((x) => now.getTime() - x.t!.getTime() > STALE_DAYS * 86_400_000);
    const future = known.find((x) => x.t!.getTime() - now.getTime() > 10 * 60_000);
    gates.push(old ? { id: "G4", name: "Time", status: "fail", hard: false, reason: `${ctx.files[old.i]!.name} was captured ${Math.round((now.getTime() - old.t!.getTime()) / 86_400_000)} days ago (${sourceOf[old.i]})` }
      : future ? { id: "G4", name: "Time", status: "fail", hard: false, reason: `${ctx.files[future.i]!.name} claims a capture time in the future` }
      : { id: "G4", name: "Time", status: known.every((x) => sourceOf[x.i] === "the file") ? "pass" : "weak", hard: false, reason: "Capture time is recent" + (known.some((x) => sourceOf[x.i] !== "the file") ? " (from the worker's device clock, weaker than the file's own time)" : "") });
  }

  // G5: sun position, only when a criterion needs darkness. No model involved.
  const needsDark = ctx.contract.criteria.some((c) => c.needs_darkness);
  if (!needsDark) gates.push({ id: "G5", name: "Sun position", status: "pass", hard: true, reason: "No criterion requires darkness" });
  else if (!known.length) gates.push({ id: "G5", name: "Sun position", status: "unknown", hard: true, reason: "Darkness is required but there is no capture time to check against the sun" });
  else {
    const day = known.find((x) => isDaylight(x.t!, ctx.ticket.lat, ctx.ticket.lng));
    const dusk = known.find((x) => !isDark(x.t!, ctx.ticket.lat, ctx.ticket.lng));
    gates.push(day ? { id: "G5", name: "Sun position", status: "fail", hard: true, reason: `${ctx.files[day.i]!.name} was captured in daylight at the reported place (${day.t!.toISOString()}), so it cannot show a light working at night` }
      : dusk ? { id: "G5", name: "Sun position", status: "weak", hard: false, reason: "Captured around dusk or dawn: not dark enough to judge a light" }
      : { id: "G5", name: "Sun position", status: "pass", hard: true, reason: "Captured after dark at the reported place" });
  }

  // G6: text in the picture aimed at the reader or an AI
  let blockAi = false;
  if (!ctx.classifyInstruction || !photos.length) gates.push({ id: "G6", name: "Instructions in the image", status: "unknown", hard: false, reason: ctx.classifyInstruction ? "No still photo to scan" : "Scan not run" });
  else {
    const results = await Promise.all(photos.map(async (f) => ({ f, r: await ctx.classifyInstruction!(f).catch(() => "unknown" as const) })));
    const bad = results.find((x) => x.r === "yes");
    blockAi = Boolean(bad);
    gates.push(bad ? { id: "G6", name: "Instructions in the image", status: "fail", hard: false, reason: `${bad.f.name} contains written instructions addressed to a reader or an AI; it will not be sent to the model and needs a person` }
      : { id: "G6", name: "Instructions in the image", status: results.some((x) => x.r === "unknown") ? "weak" : "pass", hard: false, reason: results.some((x) => x.r === "unknown") ? "The scan could not run" : "No instructions found in the images" });
  }

  const hardFail = gates.some((g) => g.hard && g.status === "fail");
  return { gates, hardFail, blockAi, captureTimes: capture };
}

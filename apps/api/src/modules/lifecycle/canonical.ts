// Build map #E2 & Bible §9 — Canonical JSON and event hash calculation.
import { createHash } from "node:crypto";

/**
 * Deterministically serialize a value to JSON with sorted keys recursively.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalJson(item)).join(",")}]`;
  }

  const entries = Object.entries(obj as Record<string, unknown>)
    .filter(([_, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  const content = entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
    .join(",");

  return `{${content}}`;
}

/**
 * Computes sha256(prev_hash || ":" || canonical_json(event_without_hash))
 */
export function computeEventHash(
  prevHash: string,
  eventData: {
    ticketId: string;
    seq: number;
    type: string;
    fromState: string | null;
    toState: string | null;
    actorType: string;
    actorId: string;
    payload: Record<string, unknown>;
    createdAt: string | Date;
  },
): string {
  const normDate =
    eventData.createdAt instanceof Date
      ? eventData.createdAt.toISOString()
      : new Date(eventData.createdAt).toISOString();

  const canonicalPayload = canonicalJson({
    actorId: eventData.actorId,
    actorType: eventData.actorType,
    createdAt: normDate,
    fromState: eventData.fromState,
    payload: eventData.payload,
    seq: eventData.seq,
    ticketId: eventData.ticketId,
    toState: eventData.toState,
    type: eventData.type,
  });

  return createHash("sha256")
    .update(`${prevHash}:${canonicalPayload}`)
    .digest("hex");
}

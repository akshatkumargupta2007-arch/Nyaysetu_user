// CA4: push tickets from the citizen stack to the separate government portal.
//
// PUSH only: this stack calls gov, gov never gets a credential to this database. For every ticket whose
// ledger moved on since gov last acknowledged it, we send a denormalised row (GOVERNMENT_BIBLE 6.2).
//
// Phone numbers: decrypted here, re-sealed to the government portal's public key, masked. PHONE_ENC_KEY
// never leaves this stack, and the plain number is never put on the wire or in a log.
import { pool } from "../../db/client.js";
import { env } from "../../env.js";
import { decryptPhone } from "../session/phone.js";
import { signRequest } from "./signing.js";
import { maskPhone, sealPhone } from "./phoneSeal.js";

export const SYNC_PATH = "/internal/sync/batch";
const BATCH_SIZE = 200;
const REFERENCE_EVERY_MS = 6 * 60 * 60 * 1000;

// Event payloads are only shared when gov needs them to show the close-request history. Everything else
// (officer notes, proof details, citizen text) stays on this side.
const SHARE_PAYLOAD_FOR = new Set(["CLOSE_REQUESTED_BY_GOV"]);

export const govSyncConfigured = (): boolean => Boolean(env.GOV_SYNC_URL && env.SYNC_SIGNING_PRIVATE_KEY && env.GOV_PHONE_SEAL_PUBLIC_KEY);

type PhoneParts = { masked: string | null; last4: string | null; cipher: string | null };

function sealForGov(phoneEnc: string | null): PhoneParts {
  if (!phoneEnc) return { masked: null, last4: null, cipher: null }; // erased (180 days after closure)
  const plain = decryptPhone(phoneEnc);
  if (!plain) return { masked: null, last4: null, cipher: null };
  const digits = plain.replace(/\D/g, "").slice(-10);
  return { masked: maskPhone(digits), last4: digits.slice(-4), cipher: sealPhone(env.GOV_PHONE_SEAL_PUBLIC_KEY, digits) };
}

export async function pendingTicketIds(limit = BATCH_SIZE): Promise<string[]> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT t.id FROM tickets t LEFT JOIN gov_sync_cursor c ON c.ticket_id = t.id
     WHERE (c.ticket_id IS NULL OR c.acked_seq < t.last_event_seq)
       AND (c.rejected_until IS NULL OR c.rejected_until <= now())   -- a rejected ticket waits (see 0008)
     ORDER BY t.created_at LIMIT $1`,
    [limit],
  );
  return rows.map((r) => r.id);
}

export async function buildTicketPayloads(ids: string[]) {
  if (!ids.length) return [];
  const tickets = await pool.query(
    `SELECT t.id, t.public_code, t.tenant_id, t.boundary_id, t.agency_id, t.department, t.category_code, c.l1 AS category_l1,
            t.state, t.priority_band, t.escalation_level, t.report_count, t.summary_officer_en,
            ST_Y(t.geom) AS lat, ST_X(t.geom) AS lng, t.h3_r9, t.sla_due_at, t.created_at, t.resolved_at, t.closed_at, t.last_event_seq,
            COALESCE(g.acked_seq, 0) AS acked_seq
     FROM tickets t JOIN categories c ON c.code = t.category_code LEFT JOIN gov_sync_cursor g ON g.ticket_id = t.id
     WHERE t.id = ANY($1::uuid[])`,
    [ids],
  );
  const reports = await pool.query(
    `SELECT r.id, r.ticket_id, r.original_text, r.lang, r.created_at, ci.phone_enc
     FROM reports r JOIN citizens ci ON ci.id = r.citizen_id
     WHERE r.ticket_id = ANY($1::uuid[]) ORDER BY r.created_at, r.id`,
    [ids],
  );
  const byTicket = new Map<string, typeof reports.rows>();
  for (const r of reports.rows) byTicket.set(r.ticket_id, [...(byTicket.get(r.ticket_id) ?? []), r]);

  const out = [];
  for (const t of tickets.rows) {
    const rs = byTicket.get(t.id) ?? [];
    const reporters = rs.map((r) => {
      const p = sealForGov(r.phone_enc);
      return { report_id: r.id, phone_masked: p.masked, phone_last4: p.last4, phone_cipher: p.cipher, created_at: new Date(r.created_at).toISOString() };
    });
    const first = rs[0];
    const ev = await pool.query(
      `SELECT seq, type, from_state, to_state, actor_type, payload, created_at FROM events WHERE ticket_id = $1 AND seq > $2 ORDER BY seq`,
      [t.id, t.acked_seq],
    );
    out.push({
      ticket_id: t.id, public_code: t.public_code, tenant_id: t.tenant_id, boundary_id: t.boundary_id, agency_id: t.agency_id,
      department: t.department, category_code: t.category_code, category_l1: t.category_l1, state: t.state, priority_band: t.priority_band,
      escalation_level: t.escalation_level, report_count: t.report_count, summary_officer_en: t.summary_officer_en,
      original_text: first?.original_text ?? null, original_lang: first?.lang ?? null,
      lat: Number(t.lat), lng: Number(t.lng), h3_r9: t.h3_r9,
      phone_masked: reporters[0]?.phone_masked ?? null, phone_cipher: reporters[0]?.phone_cipher ?? null, reporters,
      sla_due_at: t.sla_due_at ? new Date(t.sla_due_at).toISOString() : null, created_at: new Date(t.created_at).toISOString(),
      resolved_at: t.resolved_at ? new Date(t.resolved_at).toISOString() : null, closed_at: t.closed_at ? new Date(t.closed_at).toISOString() : null,
      events: ev.rows.map((e) => ({
        seq: e.seq, type: e.type, from_state: e.from_state, to_state: e.to_state, actor_type: e.actor_type,
        payload: SHARE_PAYLOAD_FOR.has(e.type) ? e.payload : null, created_at: new Date(e.created_at).toISOString(),
      })),
      last_event_seq: t.last_event_seq,
    });
  }
  return out;
}

export async function buildReference() {
  const [tenants, boundaries, agencies, categories] = await Promise.all([
    pool.query(`SELECT id, name FROM tenants`),
    pool.query(`SELECT id, tenant_id, kind, name, approximate, ST_AsGeoJSON(geom)::json AS geometry FROM boundaries`),
    pool.query(`SELECT id, name, kind FROM agencies`),
    pool.query(`SELECT code, l1, names, icon FROM categories`),
  ]);
  return { tenants: tenants.rows, boundaries: boundaries.rows, agencies: agencies.rows, categories: categories.rows };
}

export type PushResult = { ok: boolean; sent: number; acked: number; rejected: number; error?: string };

async function post(body: unknown): Promise<{ status: number; json: any }> {
  const raw = JSON.stringify(body);
  const headers = { "content-type": "application/json", ...signRequest(env.SYNC_SIGNING_PRIVATE_KEY, "POST", SYNC_PATH, raw) };
  const res = await fetch(`${env.GOV_SYNC_URL.replace(/\/$/, "")}${SYNC_PATH}`, { method: "POST", headers, body: raw, signal: AbortSignal.timeout(20_000) });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

let lastReferenceAt = 0;

/** Pushes one batch. The cursor only advances for tickets gov acknowledged. */
export async function pushOnce(opts: { forceReference?: boolean } = {}): Promise<PushResult> {
  if (!govSyncConfigured()) return { ok: false, sent: 0, acked: 0, rejected: 0, error: "not configured" };
  const ids = await pendingTicketIds();
  const sendReference = opts.forceReference || Date.now() - lastReferenceAt > REFERENCE_EVERY_MS;
  if (!ids.length && !sendReference) return { ok: true, sent: 0, acked: 0, rejected: 0 };

  const body = { ...(sendReference ? { reference: await buildReference() } : {}), tickets: await buildTicketPayloads(ids) };
  let res;
  try {
    res = await post(body);
  } catch (err) {
    return { ok: false, sent: ids.length, acked: 0, rejected: 0, error: `gov unreachable: ${(err as Error).message}` };
  }
  if (res.status !== 200) return { ok: false, sent: ids.length, acked: 0, rejected: 0, error: `gov answered ${res.status} ${res.json?.code ?? ""}` };
  if (sendReference) lastReferenceAt = Date.now();

  const acked: { ticket_id: string; seq: number }[] = res.json.acked ?? [];
  for (const a of acked) {
    await pool.query(
      `INSERT INTO gov_sync_cursor (ticket_id, acked_seq, updated_at) VALUES ($1,$2,now())
       ON CONFLICT (ticket_id) DO UPDATE SET acked_seq = GREATEST(gov_sync_cursor.acked_seq, EXCLUDED.acked_seq),
         reject_count = 0, rejected_until = NULL, reject_reason = NULL, updated_at = now()`,
      [a.ticket_id, a.seq],
    );
  }
  // Rejected tickets back off: 2, 4, 8 ... minutes, at most 24 hours, so one unfixable ticket cannot be re-sent
  // every 30 seconds forever or crowd newer tickets out of the batch.
  const rejected: { ticket_id: string; reason?: string }[] = res.json.rejected ?? [];
  for (const r of rejected) {
    await pool.query(
      `INSERT INTO gov_sync_cursor (ticket_id, acked_seq, reject_count, rejected_until, reject_reason, updated_at)
       VALUES ($1, 0, 1, now() + interval '2 minutes', $2, now())
       ON CONFLICT (ticket_id) DO UPDATE SET
         reject_count = gov_sync_cursor.reject_count + 1,
         rejected_until = now() + LEAST(interval '1 minute' * power(2, gov_sync_cursor.reject_count + 1), interval '24 hours'),
         reject_reason = EXCLUDED.reject_reason, updated_at = now()`,
      [r.ticket_id, String(r.reason ?? "rejected").slice(0, 200)],
    );
  }
  return { ok: true, sent: ids.length, acked: acked.length, rejected: rejected.length };
}

let running = false;
/** Pushes until nothing is pending (at most `maxBatches` per call). Never runs twice at once. */
export async function runGovSync(maxBatches = 10, opts: { forceReference?: boolean } = {}): Promise<PushResult[]> {
  if (running) return [];
  running = true;
  const results: PushResult[] = [];
  try {
    for (let i = 0; i < maxBatches; i++) {
      const r = await pushOnce(i === 0 ? opts : {});
      results.push(r);
      if (!r.ok || r.sent < BATCH_SIZE) break;
    }
  } finally {
    running = false;
  }
  return results;
}

// Build map #D9 — "Your complaints" list, scoped to the logged-in phone account (#D8).
import { pool } from '../../db/client.js';
import type { AppInstance } from '../../types.js';
import { citizenAuth, requireCitizenAuth } from '../auth/middleware.js';
import { subscribeCitizen, type CitizenLiveEvent } from '../gov/citizenEvents.js';

export interface ComplaintCardItem {
  id: string;
  ticketId: string;
  ticketCode: string;
  categoryCode: string;
  categoryNames: { hi: string; en: string } | null;
  l1: string | null;
  place: { hi: string; en: string } | null;
  summary: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  /** An official asked the citizen to verify the fix, and the citizen has not answered yet. */
  pending_close_request: { requested_at: string; note: string | null; official_name: string | null } | null;
}

export function registerSessionRoutes(app: AppInstance) {
  app.get('/me/reports', {
    preValidation: [requireCitizenAuth],
    config: {
      rateLimit: { max: 60, timeWindow: '1 minute' }
    }
  }, async (req, reply) => {
    const citizenId = req.citizen!.id;
    try {
      const reportsRes = await pool.query<{
        id: string;
        ticket_id: string;
        public_code: string;
        category_code: string;
        names: { hi: string; en: string } | null;
        l1: string | null;
        place: { hi: string; en: string } | null;
        summary_citizen: string;
        state: string;
        created_at: string;
        gov_requested_at: string | null;
        gov_note: string | null;
        gov_official: string | null;
      }>(`SELECT r.id, r.ticket_id, t.public_code, t.category_code, c.names, c.l1, b.name AS place,
                r.summary_citizen, t.state, r.created_at,
                gr.created_at AS gov_requested_at, gr.payload->>'note' AS gov_note, gr.payload->>'gov_user_name' AS gov_official
         FROM reports r
         JOIN tickets t ON t.id = r.ticket_id
         LEFT JOIN LATERAL (
           -- the newest gov request, but only while it is unanswered: the ticket is still waiting for the
           -- citizen AND the request came after the work was last marked done
           SELECT e.created_at, e.payload FROM events e
           WHERE e.ticket_id = t.id AND e.type = 'CLOSE_REQUESTED_BY_GOV' AND t.state = 'WORK_DONE_PENDING_CONFIRMATION'
             AND e.seq > COALESCE((SELECT max(w.seq) FROM events w WHERE w.ticket_id = t.id AND w.type = 'STATE_CHANGED' AND w.to_state = 'WORK_DONE_PENDING_CONFIRMATION'), 0)
           ORDER BY e.seq DESC LIMIT 1
         ) gr ON true
         LEFT JOIN categories c ON c.code = t.category_code
         LEFT JOIN boundaries b ON b.id = t.boundary_id
         WHERE r.citizen_id = $1
         ORDER BY r.created_at DESC
         LIMIT 20`, [citizenId]);

      const items: ComplaintCardItem[] = reportsRes.rows.map((r) => ({
        id: r.id,
        ticketId: r.ticket_id,
        ticketCode: r.public_code,
        categoryCode: r.category_code,
        categoryNames: r.names,
        l1: r.l1,
        place: r.place,
        summary: r.summary_citizen,
        state: r.state,
        createdAt: r.created_at,
        updatedAt: r.created_at,
        pending_close_request: r.gov_requested_at
          ? { requested_at: new Date(r.gov_requested_at).toISOString(), note: r.gov_note, official_name: r.gov_official }
          : null,
      }));

      return reply.status(200).send(items);
    } catch (err) {
      return reply.status(200).send([]);
    }
  });

  // ── CA5: one live stream per citizen ────────────────────────────────────────
  // The app opens this once and keeps it open; it hears about a government "please verify" request and about
  // state changes of any of its tickets, without refreshing. EventSource cannot set headers, so (like the
  // per-ticket stream) the login token may come as ?token=. A missed event is never lost: on every (re)connect
  // the app re-fetches /me/reports, which is the source of truth.
  app.get('/me/stream', { preValidation: [citizenAuth({ allowQueryToken: true })] }, async (req, reply) => {
    const citizenId = req.citizen!.id;
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': req.headers.origin ?? '*',
    });
    const send = (event: string, data: unknown) => {
      if (!reply.raw.writableEnded) reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    send('ready', { ok: true });
    const off = subscribeCitizen(citizenId, (e: CitizenLiveEvent) => send(e.type, e));
    const ping = setInterval(() => { if (!reply.raw.writableEnded) reply.raw.write(': ping\n\n'); }, 15_000);
    req.raw.on('close', () => {
      clearInterval(ping);
      off();
    });
  });
}

// Bolo's hands. Each function is a "client tool" the ElevenLabs agent can call; it runs in the citizen's own browser
// with the citizen's own login, against the normal NyaySetu API. The agent never gets a database or another
// citizen's data, and it cannot file anything by itself: filing happens only when the person taps Send in show_review.
// Every tool returns a short JSON string; errors are plain codes, never stack traces.
//
// Dependencies are passed in so the same code runs in the browser and in the scripted agent tests:
//   api         { understand, confirm, myReports, tracking, confirmClosure }
//   lang        'hi' | 'en' ...
//   getCoords   () => { lat, lng }
//   askPlace    () => Promise<{ lat, lng, address } | null>   opens the map tray and waits
//   askPhoto    () => Promise<dataUrl | null>                  opens the photo tray and waits
//   askReview   (info) => Promise<'send' | 'cancel'>           shows the final check and waits for Send
//   uploadPhoto (dataUrl) => Promise<{ photoPublicId }>
//   setCoords   ({lat,lng,accuracy}) => void
//   navigate    (screen) => void          only called for allow-listed screens
//   onFiled     (filed) => void           called once the complaint is filed (the screen then shows Done)
//   onFinish    () => void
export const SCREENS = { home: '/home', my_problems: '/problems' };

const out = (o) => JSON.stringify(o);
const fail = (code, message) => out({ error: code, message });

export function createTools({ api, lang, getCoords, askPlace, askPhoto, askReview, uploadPhoto, setCoords, navigate, onFiled, onFinish, onTool }) {
  let draft = null;   // { draftId, blocked, summary, department }
  let photo = null;   // data URL taken during this chat
  let address = '';
  const filedDrafts = new Set();
  const note = (name, args) => { try { onTool && onTool(name, args); } catch { /* UI only */ } };

  const pickTicket = async (code) => {
    const mine = await api.myReports();
    const rows = mine.items || mine.reports || mine || [];
    if (!Array.isArray(rows) || !rows.length) return null;
    if (code) {
      const want = String(code).replace(/\s+/g, '').toUpperCase();
      return rows.find((r) => String(r.ticketCode || r.publicCode || '').replace(/\s+/g, '').toUpperCase() === want) || null;
    }
    return rows[0];
  };

  return {
    request_location: async () => {
      note('request_location', {});
      try {
        const p = await askPlace();
        if (!p) return fail('NO_PLACE', 'The citizen did not choose a place. Ask where it is.');
        if (typeof p.lat === 'number' && typeof p.lng === 'number') setCoords({ lat: p.lat, lng: p.lng, accuracy: 0 });
        address = p.address || '';
        return out({ place_set: true, address: address || null });
      } catch { return fail('PLACE_FAILED', 'Could not open the map. Ask the citizen to type the place.'); }
    },

    understand_complaint: async ({ text } = {}) => {
      note('understand_complaint', { text });
      if (!text || String(text).trim().length < 3) return fail('NO_TEXT', 'Ask the citizen what is wrong.');
      const c = getCoords();
      try {
        const r = await api.understand({ text: String(text).slice(0, 1000), lang, lat: c.lat, lng: c.lng, inputMode: 'voice' });
        const u = r.understanding || {};
        const needsDetail = r.gate === 'clarify';
        const dept = r.routing && r.routing.department ? (r.routing.department[lang] || r.routing.department.en || null) : null;
        draft = { draftId: r.draftId, blocked: needsDetail, summary: u.summary_citizen || '', department: dept };
        return out({
          summary: draft.summary || null,
          department: dept,
          needs_more_detail: needsDetail,
          question_to_ask: needsDetail ? (u.clarifying_question || null) : null,
          already_reported_nearby: Boolean(r.duplicateOf),
          next: needsDetail ? 'Ask the question, then call understand_complaint again with the fuller description.' : 'Read the summary back and ask if it is right.',
        });
      } catch (e) {
        if (e && e.network) return fail('NETWORK', 'No internet. Suggest typing later.');
        return fail(e && e.code ? e.code : 'UNDERSTAND_FAILED', 'Could not understand it. Suggest typing it with the Write button.');
      }
    },

    request_photo: async () => {
      note('request_photo', {});
      try {
        const dataUrl = await askPhoto();
        if (dataUrl) { photo = dataUrl; return out({ photo: 'added' }); }
        return out({ photo: 'skipped' });
      } catch { return out({ photo: 'skipped' }); }
    },

    // The person taps Send on screen. Only then is anything filed.
    show_review: async () => {
      note('show_review', {});
      if (!draft) return fail('NO_DRAFT', 'Nothing is ready. Call understand_complaint first.');
      if (draft.blocked) return fail('NEEDS_DETAIL', 'More detail is needed first.');
      if (filedDrafts.has(draft.draftId)) return fail('ALREADY_FILED', 'This one is already filed.');
      let choice;
      try { choice = await askReview({ summary: draft.summary, department: draft.department, address, photo }); } catch { choice = 'cancel'; }
      if (choice !== 'send') return out({ sent: false, message: 'The citizen did not send it. Ask what to change.' });
      try {
        let ph = {};
        if (photo) { try { ph = await uploadPhoto(photo); } catch { /* a photo is optional */ } }
        const filed = await api.confirm(draft.draftId, ph);
        filedDrafts.add(draft.draftId);
        onFiled && onFiled(filed);
        return out({ sent: true, ticket_code: filed.publicCode, joined_existing: Boolean(filed.merged), next: 'Say the number slowly, digit by digit, then call finish_complaint.' });
      } catch (e) {
        if (e && e.status === 401) return fail('NOT_SIGNED_IN', 'The citizen must sign in first.');
        if (e && e.code === 'DRAFT_GONE') return fail('DRAFT_GONE', 'Too much time passed. Start again.');
        return fail(e && e.code ? e.code : 'CONFIRM_FAILED', 'Could not send it. Suggest the Speak button.');
      }
    },

    finish_complaint: async () => { note('finish_complaint', {}); onFinish && onFinish(); return out({ ok: true }); },

    track_complaint: async ({ ticket_code } = {}) => {
      note('track_complaint', { ticket_code });
      try {
        const t = await pickTicket(ticket_code);
        if (!t) return fail('NOT_FOUND', ticket_code ? 'No complaint with that number is yours.' : 'The citizen has no complaints yet.');
        const tr = await api.tracking(t.ticketId || t.id);
        return out({
          ticket_code: tr.publicCode,
          problem: tr.categoryNames ? (tr.categoryNames[lang] || tr.categoryNames.en) : null,
          stage: tr.stage,
          department: tr.department ? (tr.department[lang] || tr.department.en || null) : null,
          estimate: tr.etaText || null,
          place: tr.place ? (tr.place[lang] || tr.place.en) : null,
        });
      } catch (e) {
        return fail(e && e.status === 401 ? 'NOT_SIGNED_IN' : 'TRACK_FAILED', 'Could not check. Suggest My problems.');
      }
    },

    confirm_closure: async ({ fixed, note: why, ticket_code } = {}) => {
      note('confirm_closure', { fixed });
      if (typeof fixed !== 'boolean') return fail('BAD_ARGS', 'Ask: is it fixed, yes or no?');
      try {
        const t = await pickTicket(ticket_code);
        if (!t) return fail('NOT_FOUND', 'No such complaint of yours.');
        const r = await api.confirmClosure(t.ticketId || t.id, fixed, why ? String(why).slice(0, 300) : undefined);
        return out({ recorded: true, fixed, state: r && r.state ? r.state : null });
      } catch (e) {
        if (e && (e.status === 409 || (e.status === 400 && /ILLEGAL/.test(String(e.code || ''))))) return fail('NOT_WAITING', 'That complaint is not waiting for your answer right now.');
        return fail('CLOSURE_FAILED', 'Could not record it. Suggest My problems.');
      }
    },

    go_to: async ({ screen } = {}) => {
      note('go_to', { screen });
      if (!Object.prototype.hasOwnProperty.call(SCREENS, screen)) return fail('BAD_SCREEN', 'Allowed: ' + Object.keys(SCREENS).join(', '));
      navigate(screen);
      return out({ opened: screen });
    },
  };
}

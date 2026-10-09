// Every call to the NyaySetu backend. Screens never call fetch() directly.
import { API_URL, FALLBACK_COORDS } from './config.js';
import { auth, store } from './store.js';

export class ApiError extends Error {
  constructor(status, code, message, extra) {
    super(message || code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
    this.extra = extra;
    this.network = status === 0;
  }
}

async function call(path, { method = 'GET', body, form, authed = false } = {}) {
  const headers = {};
  const token = auth.token();
  if (token && (authed || true)) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server');
  }
  if (res.status === 401 && authed) auth.clear();
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new ApiError(res.status, data?.code, data?.error, data);
  return data;
}

export const api = {
  // login (Phone + OTP)
  requestOtp: (phone, lang) => call('/auth/request-otp', { method: 'POST', body: { phone } }),
  verifyOtp: (phone, code, lang) => call('/auth/verify-otp', { method: 'POST', body: { phone, code, lang } }),

  // composing a complaint (works before login: this is the "what we understood" preview)
  transcribe: (blob, lang) => {
    const form = new FormData();
    form.append('audio', blob, blob.type.includes('mp4') ? 'rec.m4a' : 'rec.webm');
    form.append('lang', lang);
    return call('/voice/transcribe', { method: 'POST', form });
  },
  resolveLocation: (lat, lng) => call(`/jurisdiction/resolve?lat=${lat}&lng=${lng}`),
  // Demo tenant is Bhilai only. If the person's real location is outside every tenant, retry once at the
  // demo coordinates so the flow still works (set VITE_DEMO_FALLBACK=false to turn this off).
  understand: async ({ text, lang, lat, lng, inputMode }) => {
    const go = (la, ln) => call('/reports/understand', { method: 'POST', body: { text, lang, lat: la, lng: ln, inputMode } });
    try {
      return await go(lat, lng);
    } catch (e) {
      if (e.code === 'NO_JURISDICTION' && import.meta.env.VITE_DEMO_FALLBACK !== 'false') {
        store.setCoords({ lat: FALLBACK_COORDS.lat, lng: FALLBACK_COORDS.lng, accuracy: 0 });
        return go(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng);
      }
      throw e;
    }
  },

  // needs login
  signUpload: () => call('/uploads/sign', { method: 'POST', body: { folder: 'nyaysetu/reports' }, authed: true }),
  confirm: (draftId, photo) => call('/reports/confirm', { method: 'POST', body: { draftId, ...photo }, authed: true }),
  myReports: () => call('/me/reports', { authed: true }),
  tracking: (ticketId) => call(`/tickets/${ticketId}/tracking`, { authed: true }),
  // confirmed=false is the "No, it is still broken" answer: it reopens the SAME complaint (same number).
  // `photoPublicId` is a new photo uploaded from the re-report screen; `note` is typed text or a transcript.
  confirmClosure: (ticketId, confirmed, note, photoPublicId) =>
    call(`/reports/${ticketId}/confirm-closure`, { method: 'POST', body: { confirmed, note, photoPublicId }, authed: true }),
};

// Uploads the saved photo straight to Cloudinary (the API never touches image bytes).
export async function uploadPhoto(dataUrl) {
  const sign = await api.signUpload();
  if (sign.simulated) return { photoPublicId: `simulated_${Date.now()}` }; // no Cloudinary keys configured
  const blob = await (await fetch(dataUrl)).blob();
  const form = new FormData();
  form.append('file', blob, 'photo.jpg');
  form.append('api_key', sign.apiKey);
  form.append('timestamp', String(sign.timestamp));
  form.append('signature', sign.signature);
  form.append('folder', sign.folder);
  let res;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, { method: 'POST', body: form });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Photo upload failed');
  }
  if (!res.ok) throw new ApiError(res.status, 'UPLOAD_FAILED', 'Photo upload failed');
  return { photoPublicId: (await res.json()).public_id };
}

/** Files the complaint the person has composed. Needs login. Returns the server's answer. */
export async function fileComplaint() {
  const understood = store.understood();
  if (!understood?.draftId) throw new ApiError(400, 'NO_DRAFT', 'Nothing to send yet');
  const dataUrl = store.photo();
  let photo = {};
  if (dataUrl) {
    try { photo = await uploadPhoto(dataUrl); } catch (e) { if (e.network) throw e; /* photo is optional */ }
  }
  const filed = await api.confirm(understood.draftId, photo);
  store.setFiled(filed);
  return filed;
}

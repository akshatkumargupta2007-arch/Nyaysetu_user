// What the person has entered so far (kept for the visit, like the cipher design's own keys).
const KEYS = {
  text: 'cipher.text',
  mode: 'cipher.mode',
  photo: 'cipher.photo',
  address: 'cipher.address',
  coords: 'cipher.coords',
  understood: 'cipher.understood',
  filed: 'cipher.filed',
  selected: 'cipher.selected',
  selcode: 'cipher.selcode',
  phone: 'cipher.phone',
  devOtp: 'cipher.devotp',
};
const TOKEN_KEY = 'nyaysetu_citizen_token';

const get = (k) => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } };
const set = (k, v) => { try { v ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k); } catch {} };
const getJson = (k) => { try { return JSON.parse(get(k) || 'null'); } catch { return null; } };

export const store = {
  text: () => get(KEYS.text),
  setText: (t, mode = 'text') => { set(KEYS.text, t); set(KEYS.mode, mode); set(KEYS.understood, ''); },
  mode: () => get(KEYS.mode) || 'text',
  photo: () => get(KEYS.photo),
  address: () => get(KEYS.address),
  setAddress: (a) => set(KEYS.address, a),
  coords: () => getJson(KEYS.coords),
  setCoords: (c) => set(KEYS.coords, c ? JSON.stringify(c) : ''),
  understood: () => getJson(KEYS.understood),
  setUnderstood: (u) => set(KEYS.understood, u ? JSON.stringify(u) : ''),
  filed: () => getJson(KEYS.filed),
  setFiled: (f) => set(KEYS.filed, f ? JSON.stringify(f) : ''),
  selected: () => get(KEYS.selected),
  setSelected: (id, code = '') => { set(KEYS.selected, id); set(KEYS.selcode, code); },
  selectedCode: () => get(KEYS.selcode),
  phone: () => get(KEYS.phone),
  setPhone: (p) => set(KEYS.phone, p),
  devOtp: () => get(KEYS.devOtp),
  setDevOtp: (c) => set(KEYS.devOtp, c),
  /** Start a fresh complaint (keeps the login). */
  clearDraft: () => { for (const k of ['text', 'mode', 'photo', 'address', 'coords', 'understood', 'filed']) set(KEYS[k], ''); },
};

// Login token lives in localStorage so it survives closing the tab.
export const auth = {
  token: () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch {} },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch {} },
  isLoggedIn: () => !!auth.token(),
};

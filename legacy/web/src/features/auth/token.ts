// Build map #D8 — citizen JWT storage (Phone + OTP login).
const KEY = "nyaysetu_citizen_token"; // same key VoiceAssistant already reads
export const getToken = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t: string) => { try { localStorage.setItem(KEY, t); } catch { /* ignore */ } };
export const clearToken = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };
export const authHeaders = (): Record<string, string> => { const t = getToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

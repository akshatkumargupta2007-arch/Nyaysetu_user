// CB1: one live connection per logged-in citizen (GET /me/stream). The server tells us when a government official
// asks for a "please verify" and when any of our tickets changes state. We do not render events directly: we simply
// re-fetch the list, because the list is the source of truth and a missed event can then never matter.
import { useEffect, useRef } from 'react';
import { API_URL } from './config.js';
import { auth } from './store.js';

export function useMeStream(onChange) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const token = auth.token();
    if (!token || typeof EventSource === 'undefined') return undefined;
    let closed = false;
    let es;
    let retry;
    const open = () => {
      if (closed) return;
      es = new EventSource(`${API_URL}/me/stream?token=${encodeURIComponent(token)}`);
      // 'ready' arrives on every (re)connection: refresh once so nothing sent while we were offline is missed
      es.addEventListener('ready', () => cb.current());
      es.addEventListener('close_request', () => cb.current());
      es.addEventListener('state', () => cb.current());
      es.onerror = () => {
        // EventSource retries by itself; if the browser gave up (closed), try again in a few seconds
        if (es.readyState === 2 && !closed) { retry = setTimeout(open, 5000); }
      };
    };
    open();
    return () => { closed = true; clearTimeout(retry); try { es.close(); } catch {} };
  }, []);
}

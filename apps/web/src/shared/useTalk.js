// All the logic of the Talk (voice helper) screen, shared by the phone and the desktop design. The screens only draw.
// Talks to ElevenLabs through a signed link from our API; the agent's hands are in boloTools.js and work with the
// person's own login. Nothing is filed unless the person taps Send on the review tray.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import { API_URL, FALLBACK_COORDS } from './config.js';
import { auth, store } from './store.js';
import { api, uploadPhoto, ApiError } from './api.js';
import { createTools, SCREENS } from './boloTools.js';
import { T } from './i18n.js';

const SPEECH_LOCALE = { hi: 'hi-IN', en: 'en-IN', bn: 'bn-IN', mr: 'mr-IN', gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', ta: 'ta-IN', te: 'te-IN', or: 'or-IN', as: 'as-IN' };
const LANG_NAME = { hi: 'Hindi', en: 'English', bn: 'Bengali', mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', ta: 'Tamil', te: 'Telugu', or: 'Odia', as: 'Assamese' };

async function post(path, body) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token()}` }, body: JSON.stringify(body) });
  } catch { throw new ApiError(0, 'NETWORK', 'Cannot reach the server'); }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new ApiError(res.status, data && data.code, data && data.error, data);
  return data;
}

const ERRORS = {
  MIC_DENIED: 'The microphone is off. Turn it on, or use Speak.',
  AGENT_NOT_CONFIGURED: 'The voice helper is not ready yet. Please use Speak.',
  AGENT_CAP: 'You have used the voice helper enough for today. Please use Speak.',
  AGENT_LANG: 'The voice helper is not available in this language yet. Please use Speak.',
  AGENT_UPSTREAM: 'The voice helper is not reachable right now. Please use Speak.',
  NETWORK: 'Check your internet.',
};

export function useTalk({ lang, go }) {
  const [cur, setCur] = useState({ text: '', me: false });
  const [prevText, setPrev] = useState('');
  const [finished, setFinished] = useState(false);
  const [ask, setAsk] = useState('');           // '' | 'photo' | 'place' | 'review'
  const [err, setErr] = useState('');
  const [starting, setStarting] = useState(false);
  const [photoSrc, setPhoto] = useState('');
  const [address, setAddress] = useState('');
  const [located, setLocated] = useState(false);
  const [listening, setListening] = useState(false);
  const [pin, setPin] = useState(() => store.coords() || FALLBACK_COORDS);
  const [dropKey, setDropKey] = useState(0);
  const [mapOn, setMapOn] = useState(false);
  const [review, setReview] = useState({ summary: '', department: '' });
  const [locMsg, setLocMsg] = useState('');
  const [filedCode, setFiledCode] = useState('');
  const curRef = useRef(cur); curRef.current = cur;
  const resolvers = useRef({});
  const timer = useRef(null);
  const addressRef = useRef(''); addressRef.current = address;
  const pinRef = useRef(pin); pinRef.current = pin;

  const addLine = (who, text) => { setPrev(curRef.current.text); setCur({ text, me: who === 'me' }); };
  const waitFor = (kind) => new Promise((resolve) => { resolvers.current[kind] = resolve; setAsk(kind); });
  const settle = (kind, value) => { setAsk(''); const r = resolvers.current[kind]; if (r) { r(value); delete resolvers.current[kind]; } };

  const tools = useMemo(() => createTools({
    api, lang, uploadPhoto,
    getCoords: () => { const c = store.coords(); return c ? { lat: c.lat, lng: c.lng } : { lat: FALLBACK_COORDS.lat, lng: FALLBACK_COORDS.lng }; },
    setCoords: (c) => store.setCoords(c),
    askPlace: () => waitFor('place'),
    askPhoto: () => waitFor('photo'),
    askReview: (info) => { setReview({ summary: info.summary, department: info.department }); return waitFor('review'); },
    navigate: (screen) => go(SCREENS[screen]),
    onFiled: (f) => { store.setFiled(f); setFiledCode(f.publicCode || ''); },
    onFinish: () => { setAsk(''); setFinished(true); },
    onTool: () => {},
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lang]);

  // Dev only: lets a person (or a test) open the trays by hand without the voice agent.
  if (import.meta.env.DEV && typeof window !== 'undefined') window.__talkDebug = { open: (k) => { if (k === 'review') setReview({ summary: 'Street light is not working', department: 'Electrical Department' }); setAsk(k); }, finish: () => setFinished(true) };

  const conv = useConversation({
    clientTools: tools,
    onMessage: (m) => { if (m && m.message) addLine((m.role || m.source) === 'user' ? 'me' : 'ai', m.message); },
    onError: () => setErr(T('Something went wrong. Please use Speak.')),
    onDisconnect: () => { clearTimeout(timer.current); setStarting(false); },
  });
  const connected = conv.status === 'connected';
  const connecting = starting || conv.status === 'connecting';

  const start = async () => {
    if (connected || connecting) return;
    setErr(''); setFinished(false); setAsk(''); setCur({ text: '', me: false }); curRef.current = { text: '', me: false }; setPrev('');
    setStarting(true);
    try {
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { const e = new Error('mic'); e.code = 'MIC_DENIED'; throw e; }
      stream.getTracks().forEach((t) => t.stop());
      const s = await post('/agent/session', { lang });
      conv.startSession({
        signedUrl: s.signedUrl, connectionType: 'websocket',
        overrides: { agent: { language: s.language, firstMessage: s.firstMessage }, tts: { voiceId: s.voiceId } },
        dynamicVariables: { lang_name: LANG_NAME[s.language] || 'Hindi' },
      });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { try { conv.endSession(); } catch {} }, s.maxSeconds * 1000);
    } catch (e) {
      setErr(T(ERRORS[e.code] || 'Something went wrong. Please use Speak.'));
    } finally { setStarting(false); }
  };
  useEffect(() => {
    if (auth.isLoggedIn()) start();
    return () => { clearTimeout(timer.current); try { conv.endSession(); } catch {} };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- the trays ----
  const saveAddr = (a) => { try { sessionStorage.setItem('cipher.address', a); } catch {} };
  const onAddress = (e) => { setAddress(e.target.value); saveAddr(e.target.value); };
  const pick = async (lat, lng) => {
    store.setCoords({ lat, lng, accuracy: 0 });
    setPin({ lat, lng });
    let a = lat.toFixed(4) + ', ' + lng.toFixed(4);
    try { const j = await api.resolveLocation(lat, lng); a = (j.label && (j.label[lang] || j.label.en)) || a; } catch {}
    setAddress(a); saveAddr(a); setLocated(true);
  };
  const here = () => {
    setLocMsg('');
    if (!navigator.geolocation) { setLocMsg(T('Location is not available. Type or say the place.')); return; }
    navigator.geolocation.getCurrentPosition(
      async (p) => { await pick(p.coords.latitude, p.coords.longitude); setDropKey((k) => k + 1); },
      () => setLocMsg(T('Location is off. Turn it on, or type the place.')),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };
  const speak = () => {
    if (listening) return;
    setListening(true);
    let ended = false;
    const finish = (t) => { if (ended) return; ended = true; setListening(false); if (t) { setAddress(t); saveAddr(t); } };
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const r = new SR();
        r.lang = SPEECH_LOCALE[lang] || 'en-IN';
        r.onresult = (ev) => finish(ev.results[0][0].transcript);
        r.onerror = () => finish(addressRef.current);
        r.onend = () => finish(addressRef.current);
        r.start();
        return;
      }
    } catch {}
    finish(addressRef.current);
  };
  const okPlace = () => settle('place', { lat: pinRef.current.lat, lng: pinRef.current.lng, address: addressRef.current });
  const onPick = (e) => {
    const input = e.target;
    const f = input.files && input.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 900 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', 0.82);
        try { sessionStorage.setItem('cipher.photo', url); } catch {}
        setPhoto(url);
        settle('photo', url);
      };
      img.onerror = () => settle('photo', null);
      img.src = fr.result;
    };
    fr.onerror = () => settle('photo', null);
    fr.readAsDataURL(f);
    try { input.value = ''; } catch {}
  };
  const skipPhoto = () => settle('photo', null);
  const sendNow = () => settle('review', 'send');
  const cancelReview = () => settle('review', 'cancel');
  const restart = () => { if (connected) { try { conv.endSession(); } catch {} } else start(); };
  const end = () => { try { conv.endSession(); } catch {} };

  const mode = connecting ? 'thinking' : connected ? (ask ? 'listening' : conv.isSpeaking ? 'speaking' : 'listening') : 'idle';
  const label = ask === 'photo' ? T('Send a photo') : ask === 'place' ? T('Where is it?') : ask === 'review' ? T('Send?')
    : mode === 'listening' ? T('Listening') : mode === 'thinking' ? T('Thinking') : mode === 'speaking' ? T('Speaking') : T('Tap to talk');
  return {
    cur, prevText, finished, ask, err, mode, label, orbClass: 'orb-' + mode, photoSrc, address, located, listening, pin, dropKey, mapOn, setMapOn, review, locMsg, filedCode,
    onAddress, pick, here, speak, okPlace, onPick, skipPhoto, sendNow, cancelReview, restart, end, connected,
  };
}

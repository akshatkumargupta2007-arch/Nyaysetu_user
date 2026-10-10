// CB3: the "No, it is still broken" screen's content: a voice box, a photo box and a text box, in the same style as
// the original report flow. Sending reopens the SAME complaint (same number) with the new words and photo.
import React, { useEffect, useRef, useState } from 'react';
import { T } from './i18n.js';
import { api, uploadPhoto } from './api.js';
import { store } from './store.js';
import { startRecording } from './recorder.js';
import { askMic } from './permissions.js';
import { getLang } from '../phone/lib/voice.js';

const G = '#1F6B3A';

/** Shrinks a photo the same way the Photo screen does, so uploads stay small. */
function shrink(file) {
  return new Promise((ok, no) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 900 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = no;
      img.src = fr.result;
    };
    fr.onerror = no;
    fr.readAsDataURL(file);
  });
}

export default function ReReportBody({ big = false, onDone, onBack }) {
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState('');
  const [status, setStatus] = useState('idle'); // idle | recording | working
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const rec = useRef(null);
  const ticketId = store.selected();
  const k = big ? 1.25 : 1; // the desktop layout is a little larger
  const px = (n) => `${Math.round(n * k)}px`;

  useEffect(() => { askMic(); }, []);
  useEffect(() => () => { try { rec.current && rec.current.stop(); } catch { /* ignore */ } }, []);
  useEffect(() => { if (!ticketId) onBack(); }, [ticketId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleMic() {
    if (status === 'working' || busy) return;
    if (status === 'recording') {
      setStatus('working'); setMsg(T('Understanding...'));
      const { blob, ms } = await rec.current.stop();
      rec.current = null;
      if (ms < 800) { setStatus('idle'); setMsg(T('Too short. Tap the mic and speak.')); return; }
      try {
        const r = await api.transcribe(blob, getLang());
        const t = (r.text || '').trim();
        if (t.length < 3) { setStatus('idle'); setMsg(T('We could not hear you. Tap the mic and try again.')); return; }
        setText((prev) => (prev ? `${prev} ${t}` : t));
        setStatus('idle'); setMsg('');
      } catch (e) {
        setStatus('idle');
        setMsg(e.network ? T('No internet. Tap the mic to try again.') : T('We could not understand the audio. Tap the mic to try again.'));
      }
      return;
    }
    try {
      rec.current = await startRecording();
      setStatus('recording'); setMsg(T('Listening... tap the mic to stop'));
    } catch {
      setStatus('idle'); setMsg(T('The microphone is not allowed. Go back and use Write.'));
    }
  }

  async function pick(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try { setPhoto(await shrink(f)); } catch { setMsg(T('Could not read that photo.')); }
    try { e.target.value = ''; } catch { /* ignore */ }
  }

  const canSend = (text.trim().length >= 3 || photo) && !busy && status !== 'working';
  async function send() {
    if (!canSend) return;
    setBusy(true); setMsg('');
    try {
      let photoPublicId;
      if (photo) {
        try { photoPublicId = (await uploadPhoto(photo)).photoPublicId; } catch (e) { if (e.network || e.code === 'PHOTO_REJECTED') throw e; /* a photo is optional */ }
      }
      await api.confirmClosure(ticketId, false, text.trim() || undefined, photoPublicId);
      store.setFiled({ publicCode: store.selectedCode() }); // the Sent page shows the SAME complaint number
      onDone();
    } catch (e) {
      setBusy(false);
      if (e.code === 'PHOTO_REJECTED') { setPhoto(null); setMsg(T('This does not look like a real photo. Please take a new photo.')); return; }
      setMsg(e.network ? T('No internet. Please try again.') : T('Could not send. Please try again.'));
    }
  }

  const box = { display: 'flex', alignItems: 'center', gap: px(14), boxSizing: 'border-box', minHeight: px(84), padding: `${px(10)} ${px(16)}`, background: '#FFFFFF', border: '3px solid #DDE6D8', borderRadius: px(24), font: 'inherit', textAlign: 'left', cursor: 'pointer', color: '#1E2B22' };
  const iconWrap = { flex: 'none', width: px(56), height: px(56), borderRadius: px(18), background: '#EFF5D5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
  const recording = status === 'recording';

  return (
    <main style={{ padding: `${px(10)} ${px(20)} 0`, display: 'flex', flexDirection: 'column', gap: px(14), width: '100%', maxWidth: big ? '760px' : undefined, margin: big ? '0 auto' : undefined, boxSizing: 'border-box' }}>
      <h1 style={{ margin: 0, fontSize: px(30), lineHeight: 1.15, fontWeight: 700, color: G }}>{T("What's still wrong? Tell us")}</h1>

      {/* voice box */}
      <button type="button" onClick={toggleMic} aria-pressed={recording} style={{ ...box, minHeight: px(104), background: recording ? '#B4491F' : G, border: '0', color: '#FFFFFF' }}>
        <span style={{ ...iconWrap, background: '#FFFFFF' }}>
          <svg width={px(30)} height={px(30)} viewBox="0 0 24 24" fill="none" stroke={recording ? '#B4491F' : G} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </span>
        <span style={{ fontSize: px(26), fontWeight: 700 }}>{recording ? T('Listening... tap the mic to stop') : T('Speak')}</span>
      </button>

      {/* photo box */}
      <label style={box}>
        <span style={iconWrap}>
          <svg width={px(30)} height={px(30)} viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
          </svg>
        </span>
        <span style={{ fontSize: px(22), fontWeight: 700, flex: 1 }}>{photo ? T('Photo added') : T('Add a photo')}</span>
        {photo && <img src={photo} alt="" style={{ width: px(60), height: px(60), objectFit: 'cover', borderRadius: px(12) }} />}
        <input type="file" accept="image/*" capture="environment" onChange={pick} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} aria-label={T('Add a photo')} />
      </label>

      {/* text box */}
      <label style={{ ...box, flexDirection: 'column', alignItems: 'stretch', cursor: 'text', gap: px(6) }}>
        <span style={{ fontSize: px(18), fontWeight: 700, color: G }}>{T('Write')}</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          rows={big ? 4 : 3}
          style={{ width: '100%', boxSizing: 'border-box', border: 0, outline: 'none', resize: 'none', font: 'inherit', fontSize: px(20), background: 'transparent', color: '#1E2B22' }}
        />
      </label>

      {msg && <p role="status" style={{ margin: 0, fontSize: px(18), fontWeight: 700, color: '#B4491F' }}>{msg}</p>}

      <button type="button" onClick={send} disabled={!canSend} style={{ height: px(72), borderRadius: px(22), border: 0, background: G, color: '#FFFFFF', font: 'inherit', fontSize: px(26), fontWeight: 700, opacity: canSend ? 1 : 0.5, cursor: canSend ? 'pointer' : 'not-allowed' }}>
        {busy ? T('Sending...') : T('Send')}
      </button>
    </main>
  );
}

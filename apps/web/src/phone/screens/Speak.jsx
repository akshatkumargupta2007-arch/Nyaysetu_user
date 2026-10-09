import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import './Speak.css';
import { api, fileComplaint } from '../../shared/api.js';
import { store, auth } from '../../shared/store.js';
import { FALLBACK_COORDS } from '../../shared/config.js';
import { startRecording } from '../../shared/recorder.js';
import { askMic } from '../../shared/permissions.js';

export default function Speak() {
  const listen = useScreenVoice('speak', 'Speak now. Say what is wrong.');
  const [typed, setTyped] = useState(() => store.text());
  const [status, setStatus] = useState('idle'); // idle | recording | working | error
  const [msg, setMsg] = useState('');
  const rec = useRef(null);
  useEffect(() => { askMic(); }, []); // shows the browser's "allow microphone?" pop-up on arrival
  useEffect(() => () => { try { rec.current && rec.current.stop(); } catch {} }, []);
  const retype = async () => {
    if (status === 'working') return;
    if (status === 'recording') {
      setStatus('working'); setMsg(T("Understanding..."));
      const { blob, ms } = await rec.current.stop();
      rec.current = null;
      if (ms < 800) { setStatus('idle'); setMsg(T("Too short. Tap the mic and speak.")); return; }
      try {
        const r = await api.transcribe(blob, getLang());
        const t = (r.text || '').trim();
        if (t.length < 3) { setStatus('idle'); setMsg(T("We could not hear you. Tap the mic and try again.")); return; }
        setTyped(t); store.setText(t, 'voice'); setStatus('idle'); setMsg('');
      } catch (e) {
        setStatus('error');
        setMsg(e.network ? T("No internet. Tap the mic to try again.") : T("We could not understand the audio. Tap the mic to try again."));
      }
      return;
    }
    try {
      stopVoice();
      rec.current = await startRecording();
      setStatus('recording'); setMsg(T("Listening... tap the mic to stop"));
    } catch {
      setStatus('error'); setMsg(T("The microphone is not allowed. Go back and use Write."));
    }
  };
  const shown = typed && status !== 'recording' && status !== 'working' ? typed : (msg || typed || T("Tap the mic and speak"));
  const okGo = () => { if (store.text().trim().length < 3) { setMsg('Please say what is wrong first.'); return false; } };

  return (
    <div className="sc-speak" style={{ position: "relative", isolation: "isolate", width: "390px", height: "844px", overflow: "hidden", boxSizing: "border-box", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "19px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "14px 20px 0 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/home" aria-label="Go back" style={{ justifySelf: "start", width: "52px", height: "52px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </TLink>
        <Brand size="s" />
      </div>
        <span role="img" aria-label="Step 1 of 3" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <i style={{ display: "block", width: "28px", height: "10px", borderRadius: "5px", background: "#1F6B3A" }}>
          </i>
          <i style={{ display: "block", width: "10px", height: "10px", borderRadius: "5px", background: "#C5D8C6" }}>
          </i>
          <i style={{ display: "block", width: "10px", height: "10px", borderRadius: "5px", background: "#C5D8C6" }}>
          </i>
        </span>
        <button className="pill" type="button" aria-label="Listen to this page" onClick={listen} style={{ justifySelf: "end", height: "48px", padding: "0 14px", display: "inline-flex", alignItems: "center", gap: "6px", background: "transparent", border: "2px solid #1F6B3A", borderRadius: "24px", color: "#1F6B3A", font: "inherit", fontSize: "17px", fontWeight: "700", cursor: "pointer" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M16.500 8.500a5 5 0 0 1 0 7M19 6a8.500 8.500 0 0 1 0 12" />
          </svg> {T("Listen")} </button>
      </header>
      <main style={{ padding: "20px 20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
        <h1 style={{ margin: "0", fontSize: "40px", lineHeight: "1.1", fontWeight: "700", textAlign: "center" }}> {T("Speak now")} </h1>
        <button type="button" aria-label={T("Say it again")} onClick={retype} style={{ position: "relative", width: "200px", height: "200px", padding: "0", border: "0", background: "transparent", cursor: "pointer" }}>
          <span className="ring">
          </span>
          <span className="ring two">
          </span>
          <span style={{ position: "absolute", left: "34px", top: "34px", width: "132px", height: "132px", borderRadius: "50%", background: "#1F6B3A", boxShadow: "0 12px 30px rgba(31,107,58,0.35)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </span>
        </button>
        <div className="wave" aria-hidden="true">
          <i>
          </i>
          <i>
          </i>
          <i>
          </i>
          <i>
          </i>
          <i>
          </i>
          <i>
          </i>
          <i>
          </i>
        </div>
        <p style={{ boxSizing: "border-box", width: "100%", minHeight: "112px", margin: "0", padding: "18px 20px", background: "#FFFFFF", border: "2px solid #DDE6D8", borderRadius: "24px", fontSize: "24px", fontWeight: "700" }}>
          {shown}
          <span className="caret">
          </span>
        </p>
      </main>
      <div style={{ flexGrow: "1" }}>
      </div>
      <div style={{ padding: "0 20px 24px" }}>
        <TLink className="solid" to="/where" onClick={okGo} style={{ height: "72px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", borderRadius: "22px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "26px", fontWeight: "700", textDecoration: "none" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.800" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.500l4.500 4.500L19 7.500" />
          </svg>
          OK
        </TLink>
      </div>
    </div>
  );
}

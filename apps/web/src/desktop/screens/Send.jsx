import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import { fileComplaint as _file, api } from '../../shared/api.js';
import { store, auth } from '../../shared/store.js';
import { FALLBACK_COORDS } from '../../shared/config.js';
import './Send.css';

export default function Send() {
  const listen = useScreenVoice('send', 'Check and tap Send.');
  const go = useGo();
  const [photo] = useState(() => store.photo());
  const [address] = useState(() => { try { return sessionStorage.getItem('cipher.address') || ''; } catch { return 'Sector 6, Bhilai'; } });
  const hasPhoto = !!photo;
  const noPhoto = !photo;
  // What the AI understood, written in the language the person chose (sample text for now).
  const aiLang = getLang();
  const aiDir = 'ltr';
  const [aiText, setAiText] = useState(T("Understanding..."));
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState('');
  const alive = useRef(true);
  const run = () => {
    let text = store.text().trim();
    // A photo with no words still goes through: officers see the photo, the AI files it for triage.
    if (text.length < 3 && store.photo()) text = 'A civic problem in my area, see the attached photo.';
    if (text.length < 3) { setAiText(T("Tell us what is wrong. Tap here and speak.")); return; }
    const c = store.coords() || FALLBACK_COORDS;
    setAiText(T("Understanding..."));
    api.understand({ text, lang: aiLang, lat: c.lat, lng: c.lng, inputMode: store.mode() })
      .then((r) => { if (!alive.current) return; store.setUnderstood(r); setAiText(r.understanding.summary_citizen || text); setReady(true); })
      .catch((e) => { if (alive.current) setAiText(e.network ? T("No internet. Tap here to try again.") : e.code === 'FST_ERR_VALIDATION' ? T("Please say or write what is wrong. Tap here.") : e.code === 'NO_JURISDICTION' ? T("We do not cover this area yet.") : T("We could not read this. Tap here and say it again.")); });
  };
  useEffect(() => { alive.current = true; run(); return () => { alive.current = false; }; }, []);
  const send = () => {
    if (sending) return false;
    if (!ready) {
      // Never ignore the tap: still reading -> wait; nothing written -> go and say it; failed -> try again.
      if (aiText === T("Understanding...")) setSendErr(T("Please wait a moment. We are reading your complaint."));
      else if (store.text().trim().length < 3 && !store.photo()) setSendErr(T("Please say or write what is wrong, or add a photo."));
      else { setSendErr(''); run(); }
      return false;
    }
    if (!auth.isLoggedIn()) { go('/phone'); return false; }
    setSending(true); setSendErr(T("Sending..."));
    _file().then(() => go('/sent')).catch((e) => { setSending(false); if (e.network) go('/not-sent'); else if (e.code === 'PHOTO_REJECTED') { try { sessionStorage.removeItem('cipher.photo'); } catch {} go('/photo-rejected'); } else setSendErr(T("Could not send. Please try again.")); });
    return false;
  };

  return (
    <div className="sc-send" style={{ position: "relative", isolation: "isolate", width: "100%", minHeight: "900px", boxSizing: "border-box", overflow: "hidden", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Sans Arabic',system-ui,sans-serif", fontSize: "20px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "relative", zIndex: "2", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "28px 40px 0 28px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/where" aria-label="Go back" style={{ justifySelf: "start", width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </TLink>
        <Brand size="l" />
      </div>
        <span role="img" aria-label="Step 3 of 3" style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
          <i style={{ display: "block", width: "14px", height: "14px", borderRadius: "7px", background: "#1F6B3A" }}>
          </i>
          <i style={{ display: "block", width: "14px", height: "14px", borderRadius: "7px", background: "#1F6B3A" }}>
          </i>
          <i style={{ display: "block", width: "46px", height: "14px", borderRadius: "7px", background: "#1F6B3A" }}>
          </i>
        </span>
        <button className="pill" type="button" aria-label="Listen to this page" onClick={listen} style={{ justifySelf: "end", height: "60px", padding: "0 28px", display: "inline-flex", alignItems: "center", gap: "10px", background: "transparent", border: "2px solid #1F6B3A", borderRadius: "30px", color: "#1F6B3A", font: "inherit", fontSize: "23px", fontWeight: "700", cursor: "pointer" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
          </svg> {T("Listen")} </button>
      </header>
      <main style={{ flex: "1 1 auto", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "16px 40px 48px", display: "flex", justifyContent: "center", gap: "36px", flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: "48px" }}>
        <TLink className="card r1" to="/photo" aria-label="Change the photo" style={{ position: "relative", flex: "1.15 1 560px", minHeight: "620px", borderRadius: "40px", overflow: "hidden", border: "3px solid #DDE6D8", background: "#BFD9C5", display: "block" }}>
          {hasPhoto && (
            <>
            <img src={photo} alt="Your photo" style={{ position: "absolute", inset: "0", display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
            </>
          )}
          {noPhoto && (
            <>
            <div style={{ position: "absolute", inset: "0" }}>
              <svg viewBox="0 0 350 220" preserveAspectRatio="xMidYMid slice" style={{ display: "block", width: "100%", height: "100%" }} role="img" aria-label="Sample photo">
                <rect width="350" height="220" fill="#BFD9C5" />
                <circle cx="288" cy="40" r="22" fill="#F5E3B5" />
                <g fill="#8DB596">
                  <rect x="0" y="90" width="70" height="100" />
                  <rect x="250" y="80" width="60" height="110" />
                </g>
                <g fill="#6C9A78">
                  <rect x="20" y="124" width="86" height="70" />
                  <polygon points="14,124 63,90 112,124" />
                  <rect x="236" y="130" width="84" height="64" />
                  <polygon points="230,130 278,96 326,130" />
                </g>
                <rect x="0" y="176" width="350" height="44" fill="#4B6B55" />
                <rect x="165" y="30" width="12" height="150" fill="#38523F" />
                <path d="M171 34q-2-26 38-26" fill="none" stroke="#38523F" strokeWidth="10" strokeLinecap="round" />
                <path d="M194 4h30l-5 14h-20z" fill="#9AA6A4" />
              </svg>
            </div>
            </>
          )}
          <span style={{ position: "absolute", right: "20px", bottom: "20px", width: "68px", height: "68px", borderRadius: "50%", background: "#FFFFFF", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(30,43,34,0.2)" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 20h4L19 9l-4-4L4 16v4z" />
              <path d="M13 7l4 4" />
            </svg>
          </span>
        </TLink>
        <div className="r2" style={{ flex: "1 1 560px", maxWidth: "640px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "22px" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: "76px", lineHeight: "1.05", fontWeight: "700" }}> {T("Send?")} </h1>
          <TLink className="card" to="/speak" dir={aiDir} aria-label="What AI understood. Tap to say it again" style={{ display: "flex", alignItems: "center", gap: "22px", minHeight: "180px", boxSizing: "border-box", padding: "18px 26px", background: "#FFFFFF", border: "3px solid #1F6B3A", borderRadius: "28px", color: "#1E2B22", textDecoration: "none" }}>
            <span style={{ flex: "none", width: "72px", height: "72px", borderRadius: "22px", background: "#EFF5D5", display: "inline-flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-start" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
                <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
              </svg>
            </span>
            <span lang={aiLang} style={{ flexGrow: "1", minWidth: "0", fontSize: "36px", fontWeight: "700", lineHeight: "1.35" }}>
              {sendErr || aiText}
            </span>
          </TLink>
          <TLink className="card" to="/where" style={{ display: "flex", alignItems: "center", gap: "22px", minHeight: "124px", boxSizing: "border-box", padding: "18px 26px", background: "#FFFFFF", border: "3px solid #DDE6D8", borderRadius: "28px", color: "#1E2B22", textDecoration: "none" }}>
            <span style={{ flex: "none", width: "72px", height: "72px", borderRadius: "22px", background: "#EFF5D5", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
                <circle cx="12" cy="9.5" r="2.5" />
              </svg>
            </span>
            <span style={{ flexGrow: "1", minWidth: "0", fontSize: "32px", fontWeight: "700" }}>
              {address}
            </span>
          </TLink>
          <TLink className="solid" to="/sent" onClick={send} style={{ marginTop: "10px", height: "92px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "28px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "32px", fontWeight: "700", textDecoration: "none" }}> {T("Send")} <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
            </svg>
          </TLink>
        </div>
      </main>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import './Code.css';
import WhatsAppOverlay from '../../shared/WhatsAppOverlay.jsx';
import { api, fileComplaint } from '../../shared/api.js';
import { store, auth } from '../../shared/store.js';
import { FALLBACK_COORDS } from '../../shared/config.js';
import { useGo as _useGo2 } from '../components/Transition.jsx';

export default function Code() {
  const listen = useScreenVoice('code', 'Type the code we sent you, then tap OK.');
  const go2 = _useGo2();
  const groupRef = useRef(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [wa, setWa] = useState('');
  const digits = () => Array.from(groupRef.current ? groupRef.current.querySelectorAll('input') : []).map((i) => i.value).join('');
  useEffect(() => {
    const dev = store.devOtp(); // only present when the server runs in dev/demo mode
    if (dev && groupRef.current) groupRef.current.querySelectorAll('input').forEach((i, n) => { i.value = dev[n] || ''; });
  }, []);
  const verify = () => {
    if (busy) return false;
    const code = digits();
    if (code.length !== 6) { setErr('Please type all 6 digits.'); return false; }
    setBusy(true); setErr('');
    api.verifyOtp(store.phone(), code, getLang())
      .then((r) => { auth.set(r.token); store.setDevOtp(''); setWa('verified'); return new Promise((ok) => setTimeout(ok, 2000)).then(() => go2('/home')); })
      .catch((e) => {
        setBusy(false);
        if (e.network) setErr('No internet. Please try again.');
        else if (e.code === 'TOO_MANY_ATTEMPTS') setErr(T("Too many wrong codes. Tap Again for a new code."));
        else if (e.code === 'INVALID_OTP') setErr(T("That code is not right."));
        else if (e.code === 'EXPIRED_OR_MISSING') setErr(T("The code expired. Tap Again."));
        else setErr('Could not send your complaint. Please try again.');
      });
    return false;
  };
  const again = () => {
    setErr('');
    api.requestOtp(store.phone()).then((r) => { store.setDevOtp(r.devOtp || ''); if (r.devOtp && groupRef.current) groupRef.current.querySelectorAll('input').forEach((i, n) => { i.value = r.devOtp[n] || ''; }); setErr(T("A new code was sent.")); })
      .catch((e) => setErr(e.code === 'COOLDOWN' ? 'Please wait a little before asking again.' : T("Could not send a code.")));
  };
  const onCode = (e) => {
    const t = e.target;
    if (!t || t.tagName !== 'INPUT') return;
    t.classList.remove('cellpop');
    void t.offsetWidth;
    if (t.value) {
      t.classList.add('cellpop');
      const n = t.nextElementSibling;
      if (n) n.focus();
    }
  };

  return (
    <>
    <WhatsAppOverlay mode={wa} />
    <div className="sc-code" style={{ width: "390px", height: "844px", overflow: "hidden", boxSizing: "border-box", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "19px", lineHeight: "1.4", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "14px 20px 0 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/phone" aria-label="Go back" style={{ justifySelf: "start", width: "52px", height: "52px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </TLink>
        <Brand size="s" />
      </div>
        <span>
        </span>
        <button className="pill" type="button" aria-label="Listen to this page" onClick={listen} style={{ justifySelf: "end", height: "48px", padding: "0 14px", display: "inline-flex", alignItems: "center", gap: "6px", background: "transparent", border: "2px solid #1F6B3A", borderRadius: "24px", color: "#1F6B3A", font: "inherit", fontSize: "17px", fontWeight: "700", cursor: "pointer" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M16.500 8.500a5 5 0 0 1 0 7M19 6a8.500 8.500 0 0 1 0 12" />
          </svg> {T("Listen")} </button>
      </header>
      <main style={{ padding: "20px 20px 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "22px" }}>
        <svg width="132" height="132" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="56" fill="#E3F1E6" />
          <rect x="36" y="12" width="48" height="92" rx="10" fill="#FFFFFF" stroke="#1F6B3A" strokeWidth="3" />
          <path d="M54 20h12" stroke="#1F6B3A" strokeWidth="3" strokeLinecap="round" />
          <rect x="43" y="34" width="34" height="22" rx="8" fill="#1F6B3A" />
          <path d="M50 56l-2 8 9-8z" fill="#1F6B3A" />
          <circle cx="52" cy="45" r="2.500" fill="#FFFFFF" />
          <circle cx="60" cy="45" r="2.500" fill="#FFFFFF" />
          <circle cx="68" cy="45" r="2.500" fill="#FFFFFF" />
          <rect x="43" y="68" width="34" height="8" rx="4" fill="#C5D8C6" />
          <rect x="43" y="82" width="24" height="8" rx="4" fill="#C5D8C6" />
        </svg>
        <h1 style={{ margin: "0", fontSize: "40px", lineHeight: "1.1", fontWeight: "700" }}> {T("Code")} </h1>
        {err && (<p role="alert" style={{ margin: 0, textAlign: 'center', fontSize: '20px', fontWeight: 700, color: '#B4491F' }}>{err}</p>)}
        <div role="group" ref={groupRef} aria-label="Enter the 6-digit code" onInput={onCode} style={{ width: "100%", display: "flex", gap: "8px" }}>
          <input type="text" inputMode="numeric" maxLength="1" aria-label="Code digit 1" style={{ flex: "1 1 0", minWidth: "0", height: "68px", boxSizing: "border-box", padding: "0", textAlign: "center", font: "inherit", fontSize: "30px", fontWeight: "700", background: "#FFFFFF", border: "3px solid #1F6B3A", borderRadius: "14px" }} />
          <input type="text" inputMode="numeric" maxLength="1" aria-label="Code digit 2" style={{ flex: "1 1 0", minWidth: "0", height: "68px", boxSizing: "border-box", padding: "0", textAlign: "center", font: "inherit", fontSize: "30px", fontWeight: "700", background: "#FFFFFF", border: "3px solid #1F6B3A", borderRadius: "14px" }} />
          <input type="text" inputMode="numeric" maxLength="1" aria-label="Code digit 3" style={{ flex: "1 1 0", minWidth: "0", height: "68px", boxSizing: "border-box", padding: "0", textAlign: "center", font: "inherit", fontSize: "30px", fontWeight: "700", background: "#FFFFFF", border: "3px solid #1F6B3A", borderRadius: "14px" }} />
          <input type="text" inputMode="numeric" maxLength="1" aria-label="Code digit 4" style={{ flex: "1 1 0", minWidth: "0", height: "68px", boxSizing: "border-box", padding: "0", textAlign: "center", font: "inherit", fontSize: "30px", fontWeight: "700", background: "#FFFFFF", border: "3px solid #1F6B3A", borderRadius: "14px" }} />
          <input type="text" inputMode="numeric" maxLength="1" aria-label="Code digit 5" style={{ flex: "1 1 0", minWidth: "0", height: "68px", boxSizing: "border-box", padding: "0", textAlign: "center", font: "inherit", fontSize: "30px", fontWeight: "700", background: "#FFFFFF", border: "3px solid #1F6B3A", borderRadius: "14px" }} />
          <input type="text" inputMode="numeric" maxLength="1" aria-label="Code digit 6" style={{ flex: "1 1 0", minWidth: "0", height: "68px", boxSizing: "border-box", padding: "0", textAlign: "center", font: "inherit", fontSize: "30px", fontWeight: "700", background: "#FFFFFF", border: "3px solid #1F6B3A", borderRadius: "14px" }} />
        </div>
        <TLink className="solid" to="/sent" onClick={verify} style={{ width: "100%", height: "72px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", borderRadius: "22px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "26px", fontWeight: "700", textDecoration: "none" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.500l4.500 4.500L19 7.500" />
          </svg>
          OK
        </TLink>
        <button className="pill" type="button" onClick={again} style={{ minHeight: "52px", padding: "0 20px", border: "0", borderRadius: "26px", background: "transparent", font: "inherit", fontSize: "20px", fontWeight: "700", color: "#1F6B3A", textDecoration: "underline", textUnderlineOffset: "4px", cursor: "pointer" }}> {T("Again")} </button>
      </main>
      <div style={{ flexGrow: "1" }}>
      </div>
      <svg viewBox="0 0 390 170" preserveAspectRatio="xMidYMax slice" style={{ display: "block", width: "100%", height: "auto" }} aria-hidden="true">
        <ellipse cx="90" cy="196" rx="220" ry="74" fill="#D3EBD8" />
        <ellipse cx="330" cy="200" rx="200" ry="70" fill="#C2E3CB" />
        <g fill="#5C8A68">
          <rect x="57" y="112" width="6" height="40" />
          <rect x="147" y="128" width="5" height="26" />
          <rect x="300" y="108" width="7" height="44" />
          <rect x="360" y="126" width="5" height="28" />
        </g>
        <g fill="#7FBE8E">
          <circle cx="60" cy="100" r="30" />
          <circle cx="150" cy="116" r="20" />
          <circle cx="303" cy="94" r="32" />
          <circle cx="362" cy="114" r="20" />
        </g>
        <g fill="#4F6B58">
          <rect x="186" y="134" width="56" height="5" />
          <rect x="186" y="122" width="56" height="4" />
          <rect x="190" y="139" width="4" height="14" />
          <rect x="234" y="139" width="4" height="14" />
        </g>
        <rect x="0" y="152" width="390" height="18" fill="#B2DBBE" />
      </svg>
    </div>
    </>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import './Phone.css';
import WhatsAppOverlay from '../../shared/WhatsAppOverlay.jsx';
import { api, fileComplaint } from '../../shared/api.js';
import { store, auth } from '../../shared/store.js';
import { FALLBACK_COORDS } from '../../shared/config.js';
import { useGo as _useGo } from '../components/Transition.jsx';

export default function Phone() {
  const listen = useScreenVoice('phone', 'Type your phone number, then tap OK.');
  const go2 = _useGo();
  const [phone, setPhone] = useState(() => store.phone());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [wa, setWa] = useState('');
  const submit = () => {
    if (busy) return false;
    if (!/^[6-9]\d{9}$/.test(phone)) { setErr('Please type a 10-digit phone number.'); return false; }
    setBusy(true); setErr(''); setWa('connecting');
    Promise.all([api.requestOtp(phone).catch((e) => (e.code === 'COOLDOWN' ? { cooldown: true } : Promise.reject(e))), new Promise((ok) => setTimeout(ok, 2400))])
      .then(([r]) => { store.setPhone(phone); if (!r.cooldown) store.setDevOtp(r.devOtp || ''); go2('/code'); })
      .catch((e) => {
        setBusy(false); setWa('');
        if (e.code === 'COOLDOWN') { store.setPhone(phone); go2('/code'); }
        else if (e.code === 'TOO_MANY') setErr('Too many tries. Please wait and try later.');
        else setErr(e.network ? 'No internet. Please try again.' : 'Could not send the code. Please try again.');
      });
    return false;
  };

  return (
    <>
    <WhatsAppOverlay mode={wa} />
    <div className="sc-phone" style={{ position: "relative", isolation: "isolate", width: "100%", minHeight: "900px", boxSizing: "border-box", overflow: "hidden", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Sans Arabic',system-ui,sans-serif", fontSize: "20px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "relative", zIndex: "2", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "28px 40px 0 28px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/voice" aria-label="Go back" style={{ justifySelf: "start", width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </TLink>
        <Brand size="l" />
      </div>
        <span>
        </span>
        <button className="pill" type="button" aria-label="Listen to this page" onClick={listen} style={{ justifySelf: "end", height: "60px", padding: "0 28px", display: "inline-flex", alignItems: "center", gap: "10px", background: "transparent", border: "2px solid #1F6B3A", borderRadius: "30px", color: "#1F6B3A", font: "inherit", fontSize: "23px", fontWeight: "700", cursor: "pointer" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
          </svg> {T("Listen")} </button>
      </header>
      <main style={{ flex: "1 1 auto", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "8px 40px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "24px" }}>
        <div className="r1" style={{ width: "100%", maxWidth: "820px", boxSizing: "border-box", padding: "36px 56px 44px", background: "#FFFFFF", border: "2px solid #DDE6D8", borderRadius: "48px", boxShadow: "0 24px 56px rgba(31,107,58,0.10)", display: "flex", flexDirection: "column", gap: "28px" }}>
          <h1 style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", margin: "0" }}> {T("Your phone number")} </h1>
          <svg width="170" height="170" viewBox="0 0 120 120" style={{ alignSelf: "center" }} aria-hidden="true">
            <circle cx="60" cy="60" r="58" fill="#EAF3CF" />
            <rect x="38" y="20" width="44" height="82" rx="9" fill="#FFFFFF" stroke="#1F6B3A" strokeWidth="4" />
            <path d="M54 28h12" stroke="#1F6B3A" strokeWidth="3" strokeLinecap="round" />
            <circle cx="60" cy="86" r="5" fill="#1F6B3A" />
            <circle cx="60" cy="54" r="10" fill="#1F6B3A" />
            <path d="M42 80c2-11 9-16 18-16s16 5 18 16z" fill="#1F6B3A" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <label htmlFor="phone" style={{ fontSize: "40px", fontWeight: "700", textAlign: "center" }}> {T("Phone")} </label>
          {err && (<p role="alert" style={{ margin: 0, textAlign: 'center', fontSize: '20px', fontWeight: 700, color: '#B4491F' }}>{err}</p>)}
            <div style={{ display: "flex", gap: "14px" }}>
              <span style={{ flex: "none", height: "104px", boxSizing: "border-box", padding: "0 28px", display: "inline-flex", alignItems: "center", fontSize: "44px", fontWeight: "700", color: "#1F6B3A", background: "#E3F1E6", border: "4px solid #1F6B3A", borderRadius: "26px" }}>
                +91
              </span>
              <input id="phone" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setErr(""); }} inputMode="numeric" autoComplete="tel-national" maxLength="10" style={{ flex: "1 1 0", minWidth: "0", letterSpacing: "0.06em", height: "104px", boxSizing: "border-box", padding: "0 28px", font: "inherit", fontSize: "48px", fontWeight: "700", color: "#1E2B22", background: "#FFFFFF", border: "4px solid #1F6B3A", borderRadius: "26px" }} />
            </div>
          </div>
          <TLink className="solid" to="/code" onClick={submit} style={{ height: "92px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "28px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "32px", fontWeight: "700", textDecoration: "none" }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            {T("Continue with WhatsApp")}
          </TLink>
        </div>
      </main>
      <svg viewBox="0 0 1560 170" preserveAspectRatio="xMidYMax slice" style={{ display: "block", width: "100%", height: "170px" }} aria-hidden="true">
        <defs>
          <g id="t">
            <g fill="#D2E8D5">
              <rect x="0" y="70" width="52" height="82" />
              <rect x="52" y="48" width="40" height="104" />
              <rect x="104" y="84" width="60" height="68" />
              <rect x="236" y="66" width="46" height="86" />
              <rect x="282" y="88" width="50" height="64" />
            </g>
            <g fill="#F6FAF4">
              <rect x="12" y="84" width="8" height="10" />
              <rect x="28" y="84" width="8" height="10" />
              <rect x="12" y="104" width="8" height="10" />
              <rect x="28" y="104" width="8" height="10" />
              <rect x="62" y="64" width="8" height="10" />
              <rect x="76" y="64" width="8" height="10" />
              <rect x="62" y="86" width="8" height="10" />
              <rect x="76" y="86" width="8" height="10" />
              <rect x="246" y="82" width="8" height="10" />
              <rect x="262" y="82" width="8" height="10" />
              <rect x="246" y="104" width="8" height="10" />
              <rect x="262" y="104" width="8" height="10" />
            </g>
            <g fill="#A9D6B3">
              <rect x="116" y="114" width="56" height="36" />
              <polygon points="110,114 144,90 178,114" />
              <rect x="196" y="120" width="44" height="30" />
              <polygon points="190,120 218,100 246,120" />
              <circle cx="14" cy="126" r="18" />
              <rect x="12" y="134" width="4" height="16" />
              <rect x="296" y="116" width="62" height="34" />
              <polygon points="290,116 327,92 364,116" />
            </g>
            <circle cx="372" cy="62" r="34" fill="#F5E3B5" opacity="0.7" />
            <rect x="368" y="70" width="5" height="80" fill="#4F6B58" />
            <rect x="352" y="68" width="20" height="4" fill="#4F6B58" />
            <circle cx="354" cy="74" r="6" fill="#E0A526" />
            <rect x="0" y="150" width="390" height="20" fill="#1F6B3A" />
            <path d="M0 160H390" stroke="#F7F9F2" strokeWidth="2" strokeDasharray="18 14" />
            <g className="bus">
              <rect x="0" y="136" width="36" height="13" rx="4" fill="#F7F9F2" />
              <rect x="4" y="139" width="6" height="5" rx="1" fill="#1F6B3A" />
              <rect x="13" y="139" width="6" height="5" rx="1" fill="#1F6B3A" />
              <rect x="22" y="139" width="6" height="5" rx="1" fill="#1F6B3A" />
              <circle cx="9" cy="150" r="3" fill="#1E2B22" />
              <circle cx="27" cy="150" r="3" fill="#1E2B22" />
            </g>
          </g>
        </defs>
        <use href="#t" />
        <g transform="translate(780 0) scale(-1 1)">
          <use href="#t" />
        </g>
        <use href="#t" x="780" />
        <g transform="translate(1560 0) scale(-1 1)">
          <use href="#t" />
        </g>
      </svg>
    </div>
    </>
  );
}

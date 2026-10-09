import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import mapImg from '../assets/sector6.png';
import './Status.css';
import { api } from '../../shared/api.js';
import { store, auth } from '../../shared/store.js';
import { useGo as _useGoX } from '../components/Transition.jsx';


export default function Status() {
  const goX = _useGoX();
  const [t, setT] = useState(null);
  useEffect(() => {
    const id = store.selected();
    if (!id || !auth.isLoggedIn()) { goX('/problems'); return; }
    api.tracking(id).then(setT).catch((e) => { if (e.status === 401) goX('/phone'); });
  }, []);
  const L = getLang() === 'hi' ? 'hi' : 'en';
  const code = t ? t.publicCode : store.selectedCode();
  const title = t && t.categoryNames ? t.categoryNames[L] : '';
  const place = t && t.place ? t.place[L] : '';
  const hours = t && t.etaText ? (t.etaText.match(/\d+/) || [])[0] : null;
  const eta = hours ? (L === 'hi' ? t.etaText : (+hours >= 48 ? T('About {n} days', { n: Math.round(+hours / 24) }) : T('About {n} h', { n: hours }))) : '-';
  const team = t && t.department ? t.department[L] : '';
  const listen = useScreenVoice('status_intro', t ? (L === 'hi' ? 'आपकी शिकायत ' + code + ' पर काम चल रहा है।' : 'Your complaint ' + code + ' is being handled.') : T("Loading."));

  return (
    <div className="sc-status" style={{ position: "relative", isolation: "isolate", width: "100%", minHeight: "900px", boxSizing: "border-box", overflow: "hidden", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Sans Arabic',system-ui,sans-serif", fontSize: "20px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "relative", zIndex: "2", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "28px 40px 0 28px", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "12px", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/problems" aria-label="Go back" style={{ justifySelf: "start", width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </TLink>
        <Brand size="l" />
      </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <h1 style={{ margin: "0", fontSize: "46px", lineHeight: "1.1", fontWeight: "700", color: "#1F6B3A" }}>{title}</h1>
          <span style={{ fontSize: "22px", color: "#4A5A4F" }}>{code}</span>
        </div>
        <button className="pill" type="button" aria-label="Listen to this page" onClick={listen} style={{ justifySelf: "end", height: "60px", padding: "0 28px", display: "inline-flex", alignItems: "center", gap: "10px", background: "transparent", border: "2px solid #1F6B3A", borderRadius: "30px", color: "#1F6B3A", font: "inherit", fontSize: "23px", fontWeight: "700", cursor: "pointer" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
          </svg> {T("Listen")} </button>
      </header>
      <main style={{ flex: "1 1 auto", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "20px 40px 32px", display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: "48px" }}>
        <section className="r1" aria-label={T("Where the team is")} style={{ position: "relative", flex: "1.25 1 560px", minHeight: "560px", borderRadius: "40px", overflow: "hidden", background: "#FFFFFF", border: "2px solid #DDE6D8" }}>
          <img src={mapImg} alt="" style={{ position: "absolute", inset: "0", display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
          <svg viewBox="0 0 768 512" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: "0", width: "100%", height: "100%" }} aria-hidden="true">
            <path d="M150 400L230 360L400 294L362 196" fill="none" stroke="#FFFFFF" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M150 400L230 360L400 294L362 196" fill="none" stroke="#1F6B3A" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 20">
              <animate attributeName="stroke-dashoffset" from="0" to="-42" dur="1.4s" repeatCount="indefinite" />
            </path>
            <circle cx="362" cy="196" r="12" fill="none" stroke="#E0A526" strokeWidth="5">
              <animate attributeName="r" values="12;46" dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0" dur="2.2s" repeatCount="indefinite" />
            </circle>
            <g transform="translate(362 196)">
              <path d="M0 0c-14-16-22-24-22-36a22 22 0 0 1 44 0c0 12-8 20-22 36z" fill="#E0A526" stroke="#FFFFFF" strokeWidth="4" />
              <circle cy="-36" r="8" fill="#FFFFFF" />
            </g>
            <g>
              <animateMotion dur="20s" repeatCount="indefinite" path="M150 400L230 360L400 294L362 196" />
              <circle r="34" fill="#1F6B3A" stroke="#FFFFFF" strokeWidth="6" />
              <g transform="translate(-22 -22) scale(1.85)" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6h11v10H2zM13 9h4l4 4v3h-8" />
                <circle cx="7" cy="17.5" r="1.5" />
                <circle cx="17" cy="17.5" r="1.5" />
              </g>
            </g>
          </svg>
          <span style={{ position: "absolute", right: "14px", bottom: "8px", padding: "1px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.85)", fontSize: "13px", color: "#4A5A4F" }}>
            © OpenStreetMap
          </span>
          <span style={{ position: "absolute", right: "16px", top: "16px", padding: "10px 22px", borderRadius: "999px", background: "#FFFFFF", border: "2px solid #DDE6D8", fontSize: "26px", fontWeight: "700" }}>{place}</span>
        </section>
        <div className="r2" style={{ flex: "1 1 480px", maxWidth: "640px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "20px" }}>
          <section style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "24px", color: "#4A5A4F" }}> {T("Team arrives")} </span>
              <span style={{ fontSize: "76px", fontWeight: "700", lineHeight: "1.05", color: "#1F6B3A" }}>{eta}</span>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 24px", borderRadius: "999px", background: "#EFF5D5", fontSize: "26px", fontWeight: "700" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
              </svg> {T("Electricity")} </span>
          </section>
          <div className="prog" role="img" aria-label="Step 3 of 5: team on the way" style={{ display: "flex", alignItems: "center" }}>
            <span style={{ flex: "none", width: "52px", height: "52px", borderRadius: "50%", background: "#2F6B4F", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <span style={{ flex: "1 1 0", height: "6px", background: "#2F6B4F" }}>
            </span>
            <span style={{ flex: "none", width: "52px", height: "52px", borderRadius: "50%", background: "#2F6B4F", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <span style={{ flex: "1 1 0", height: "6px", background: "#2F6B4F" }}>
            </span>
            <span className="ring" style={{ flex: "none", width: "60px", height: "60px", borderRadius: "50%", background: "#1F6B3A", boxShadow: "0 0 0 6px #CBE5D0", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 6h11v10H2zM13 9h4l4 4v3h-8" />
                <circle cx="7" cy="17.5" r="1.5" />
                <circle cx="17" cy="17.5" r="1.5" />
              </svg>
            </span>
            <span style={{ flex: "1 1 0", height: "6px", background: "#C5D8C6" }}>
            </span>
            <span style={{ flex: "none", width: "52px", height: "52px", boxSizing: "border-box", borderRadius: "50%", border: "3px solid #C5D8C6", background: "#F7F9F2", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9AA6A4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14.5 6.5a4 4 0 0 0-5 5L3 18l3 3 6.5-6.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z" />
              </svg>
            </span>
            <span style={{ flex: "1 1 0", height: "6px", background: "#C5D8C6" }}>
            </span>
            <span style={{ flex: "none", width: "52px", height: "52px", boxSizing: "border-box", borderRadius: "50%", border: "3px solid #C5D8C6", background: "#F7F9F2", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9AA6A4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
          </div>
          <ol style={{ listStyle: "none", margin: "0", padding: "0", display: "flex", flexDirection: "column", gap: "10px" }}>
            <li style={{ display: "flex", alignItems: "center", gap: "16px", padding: "11px 24px", borderRadius: "22px", background: "#E3F1E6", border: "2px solid #E3F1E6" }}>
              <span style={{ flex: "none", width: "140px", fontSize: "26px", fontWeight: "700", whiteSpace: "nowrap", color: "#14502B" }}>
                2:05 PM
              </span>
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "27px", fontWeight: "700" }}> {T("Team on the way")} </span>
                <span style={{ fontSize: "21px", color: "#4A5A4F" }}>{team}</span>
              </span>
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: "16px", padding: "11px 24px", borderRadius: "22px", background: "#FFFFFF", border: "2px solid #DDE6D8" }}>
              <span style={{ flex: "none", width: "140px", fontSize: "26px", fontWeight: "700", whiteSpace: "nowrap", color: "#4A5A4F" }}>
                10:20 AM
              </span>
              <span style={{ fontSize: "27px" }}> {T("Sent to Electricity")} </span>
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: "16px", padding: "11px 24px", borderRadius: "22px", background: "#FFFFFF", border: "2px solid #DDE6D8" }}>
              <span style={{ flex: "none", width: "140px", fontSize: "26px", fontWeight: "700", whiteSpace: "nowrap", color: "#4A5A4F" }}>
                10:12 AM
              </span>
              <span style={{ fontSize: "27px" }}> {T("Received")} </span>
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: "16px", padding: "11px 24px", borderRadius: "22px", border: "2px dashed #C5D8C6", color: "#566657" }}>
              <span style={{ flex: "none", width: "140px", fontSize: "26px", fontWeight: "700", whiteSpace: "nowrap", color: "#4A5A4F" }}> {T("Next")} </span>
              <span style={{ fontSize: "27px" }}> {T("Fixing the problem")} </span>
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: "16px", padding: "11px 24px", borderRadius: "22px", border: "2px dashed #C5D8C6", color: "#566657" }}>
              <span style={{ flex: "none", width: "140px", fontSize: "26px", fontWeight: "700", whiteSpace: "nowrap", color: "#4A5A4F" }}> {T("Then")} </span>
              <span style={{ fontSize: "27px" }}> {T("Fixed")} </span>
            </li>
          </ol>
          <a className="solid" href="#call" style={{ height: "92px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "28px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "32px", fontWeight: "700", textDecoration: "none" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
            </svg> {T("Call Team")} </a>
        </div>
      </main>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import './Home.css';
import { api, fileComplaint } from '../../shared/api.js';
import { store, auth } from '../../shared/store.js';
import { FALLBACK_COORDS } from '../../shared/config.js';


export default function Home() {
  const listen = useScreenVoice('home', 'Something wrong in your area? Tap Speak.');
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState(() => store.text());
  const [err, setErr] = useState('');
  const onText = (e) => { setText(e.target.value); store.setText(e.target.value, 'text'); setErr(''); };
  const okWrite = () => { if (text.trim().length < 3) { setErr('Please write what is wrong.'); return false; } };
  const notWriting = !writing;
  const openWrite = () => setWriting(true);
  const closeWrite = () => setWriting(false);

  return (
    <div className="sc-home" style={{ position: "relative", isolation: "isolate", width: "100%", minHeight: "900px", boxSizing: "border-box", overflow: "hidden", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Sans Arabic',system-ui,sans-serif", fontSize: "20px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "relative", zIndex: "2", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "24px 32px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Brand size="l" />
        <button className="pill" type="button" aria-label="Listen to this page" onClick={listen} style={{ height: "60px", padding: "0 28px", display: "inline-flex", alignItems: "center", gap: "10px", background: "transparent", border: "2px solid #1F6B3A", borderRadius: "30px", color: "#1F6B3A", font: "inherit", fontSize: "23px", fontWeight: "700", cursor: "pointer" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
          </svg> {T("Listen")} </button>
      </header>
      <main style={{ flex: "1 1 auto", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "8px 40px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "32px" }}>
        <h1 className="r1" style={{ margin: "0", maxWidth: "1200px", textAlign: "center", fontSize: "96px", lineHeight: "1.04", fontWeight: "700", letterSpacing: "-0.02em" }}> {T("Something wrong")} <br />
          <span style={{ color: "#1F6B3A" }}> {T("in your area?")} </span>
        </h1>
        {writing && (
          <>
          <div className="enter" style={{ width: "100%", maxWidth: "860px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <label htmlFor="issue" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}> {T("Write here")} </label>
            <textarea id="issue" value={text} onChange={onText} style={{ height: "220px", boxSizing: "border-box", padding: "20px 24px", resize: "none", font: "inherit", fontSize: "26px", lineHeight: "1.35", color: "#1E2B22", background: "#FFFFFF", border: "3px solid #1F6B3A", borderRadius: "28px", boxShadow: "0 8px 24px rgba(31,107,58,0.12)" }}>
            </textarea>
            {err && (<p role="alert" style={{ margin: 0, textAlign: 'center', fontSize: '20px', fontWeight: 700, color: '#B4491F' }}>{err}</p>)}
            <div style={{ display: "flex", gap: "16px" }}>
              <button className="alt" type="button" aria-label="Back" onClick={closeWrite} style={{ flex: "none", width: "76px", height: "76px", boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#EFF5D5", border: "3px solid #1F6B3A", borderRadius: "22px", cursor: "pointer" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5M11 6l-6 6 6 6" />
                </svg>
              </button>
              <TLink className="solid" to="/where" onClick={okWrite} style={{ flex: "1 1 0", height: "92px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "28px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "32px", fontWeight: "700", textDecoration: "none" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                OK
              </TLink>
            </div>
          </div>
          </>
        )}
        {notWriting && (
          <>
          <div className="enter r2" style={{ width: "100%", maxWidth: "1200px", display: "flex", flexWrap: "wrap", gap: "16px" }}>
            <TLink className="big" to="/speak" style={{ flex: "2 1 480px", height: "152px", boxSizing: "border-box", padding: "0 28px", display: "flex", alignItems: "center", gap: "22px", background: "#1F6B3A", borderRadius: "28px", color: "#FFFFFF", textDecoration: "none" }}>
              <span className="micdot" style={{ flex: "none", width: "100px", height: "100px", borderRadius: "50%", background: "#FFFFFF", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
              </span>
              <span style={{ fontSize: "52px", fontWeight: "700", lineHeight: "1.1" }}> {T("Speak")} </span>
            </TLink>
            <TLink className="alt" to="/photo" style={{ flex: "1 1 240px", height: "152px", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", background: "#EFF5D5", border: "3px solid #1F6B3A", borderRadius: "28px", color: "#1F6B3A", fontSize: "30px", fontWeight: "700", textDecoration: "none" }}>
              <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg> {T("Photo")} </TLink>
            <button className="alt" type="button" onClick={openWrite} style={{ flex: "1 1 240px", height: "152px", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", background: "#EFF5D5", border: "3px solid #1F6B3A", borderRadius: "28px", color: "#1F6B3A", font: "inherit", fontSize: "30px", fontWeight: "700", cursor: "pointer" }}>
              <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                <path d="M13 7l4 4" />
              </svg> {T("Write")} </button>
          </div>
          </>
        )}
        <TLink className="link r3" to="/problems" style={{ minHeight: "64px", padding: "0 24px", borderRadius: "32px", display: "inline-flex", alignItems: "center", gap: "12px", color: "#1F6B3A", fontSize: "30px", fontWeight: "700", textDecoration: "underline", textUnderlineOffset: "6px" }}> {T("My problems")} <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </TLink>
      </main>
      <div style={{ position: "relative" }}>
        <svg viewBox="0 0 1560 160" preserveAspectRatio="xMidYMax slice" style={{ display: "block", width: "100%", height: "190px" }} aria-hidden="true">
          <defs>
            <g id="tile">
              <g className="smoke" fill="#EAF3E8">
                <ellipse cx="178" cy="22" rx="16" ry="8" />
                <ellipse cx="194" cy="10" rx="13" ry="6" />
                <ellipse cx="208" cy="38" rx="12" ry="6" />
              </g>
              <g fill="#C4E2CA">
                <rect x="329" y="60" width="3" height="46" />
                <rect x="119" y="86" width="2.4" height="20" />
              </g>
              <g className="spin" stroke="#C4E2CA" strokeWidth="3" strokeLinecap="round">
                <path d="M330.500 60V40M330.500 60l-17 10M330.500 60l17 10" />
              </g>
              <g className="spin s2" stroke="#C4E2CA" strokeWidth="2.4" strokeLinecap="round">
                <path d="M120.200 86V72M120.200 86l-12 7M120.200 86l12 7" />
              </g>
              <g fill="#D2E8D5">
                <polygon points="168,144 171,30 183,30 186,144" />
                <polygon points="198,144 200,50 210,50 212,144" />
                <path d="M238 144C244 114 244 96 240 78H284C280 96 280 114 286 144Z" />
                <rect x="96" y="100" width="64" height="44" />
                <polygon points="96,100 96,86 112,100 112,86 128,100 128,86 144,100 144,86 160,100" />
              </g>
              <g fill="#BADDC1">
                <rect x="170" y="44" width="14" height="6" />
                <rect x="170" y="62" width="14" height="6" />
                <rect x="8" y="80" width="34" height="64" />
                <rect x="46" y="58" width="30" height="86" />
                <rect x="302" y="72" width="30" height="72" />
                <rect x="336" y="92" width="54" height="52" />
              </g>
              <g fill="#F1F7EF">
                <rect className="tw" x="14" y="88" width="6" height="6" />
                <rect x="28" y="88" width="6" height="6" />
                <rect x="14" y="104" width="6" height="6" />
                <rect className="tw t2" x="28" y="104" width="6" height="6" />
                <rect x="14" y="120" width="6" height="6" />
                <rect className="tw t3" x="28" y="120" width="6" height="6" />
                <rect x="52" y="66" width="6" height="6" />
                <rect className="tw t2" x="64" y="66" width="6" height="6" />
                <rect className="tw" x="52" y="84" width="6" height="6" />
                <rect x="64" y="84" width="6" height="6" />
                <rect x="52" y="102" width="6" height="6" />
                <rect className="tw t3" x="64" y="102" width="6" height="6" />
                <rect x="308" y="80" width="6" height="6" />
                <rect className="tw t3" x="320" y="80" width="6" height="6" />
                <rect className="tw" x="308" y="98" width="6" height="6" />
                <rect x="320" y="98" width="6" height="6" />
                <rect x="344" y="100" width="6" height="6" />
                <rect className="tw t2" x="358" y="100" width="6" height="6" />
                <rect x="372" y="100" width="6" height="6" />
              </g>
              <g fill="#8CC79A">
                <circle cx="86" cy="124" r="18" />
                <circle cx="146" cy="128" r="16" />
                <circle cx="264" cy="126" r="18" />
                <circle cx="388" cy="126" r="16" />
              </g>
              <g fill="#5FAE78">
                <circle cx="22" cy="134" r="14" />
                <circle cx="118" cy="136" r="12" />
                <circle cx="226" cy="136" r="12" />
                <circle cx="296" cy="136" r="14" />
                <circle cx="358" cy="136" r="13" />
              </g>
              <rect x="206" y="118" width="3" height="26" fill="#38523F" />
              <circle cx="207.5" cy="116" r="5" fill="#E0A526" />
            </g>
          </defs>
          <g className="bird" stroke="#5C8A68" strokeWidth="2" fill="none" strokeLinecap="round">
            <path d="M20 30q5-6 10 0q5-6 10 0" />
          </g>
          <g className="bird b2" stroke="#5C8A68" strokeWidth="2" fill="none" strokeLinecap="round">
            <path d="M0 52q4-5 8 0q4-5 8 0" />
          </g>
          <use href="#tile" x="0" />
          <g transform="translate(780 0) scale(-1 1)">
            <use href="#tile" />
          </g>
          <use href="#tile" x="780" />
          <g transform="translate(1560 0) scale(-1 1)">
            <use href="#tile" />
          </g>
          <g transform="translate(560 40)">
            <circle className="ping" r="6" fill="none" stroke="#E0A526" strokeWidth="2.5" />
            <path d="M0 12c-5-6-8-9-8-13a8 8 0 0 1 16 0c0 4-3 7-8 13z" fill="#E0A526" />
            <circle cy="-1" r="2.8" fill="#FFFFFF" />
          </g>
          <rect x="0" y="144" width="1560" height="16" fill="#4F7A5C" />
          <path d="M0 152H1560" stroke="#F7F9F2" strokeWidth="2" strokeDasharray="16 14" />
          <g className="bus">
            <rect x="0" y="132" width="36" height="13" rx="4" fill="#1F6B3A" />
            <rect x="4" y="135" width="6" height="5" rx="1" fill="#E3F1E6" />
            <rect x="13" y="135" width="6" height="5" rx="1" fill="#E3F1E6" />
            <rect x="22" y="135" width="6" height="5" rx="1" fill="#E3F1E6" />
            <circle cx="9" cy="146" r="3" fill="#1E2B22" />
            <circle cx="27" cy="146" r="3" fill="#1E2B22" />
          </g>
        </svg>
        <footer style={{ background: "#1F6B3A" }}>
          <nav aria-label="Footer" style={{ maxWidth: "1360px", margin: "0 auto", display: "flex", justifyContent: "center", gap: "24px", padding: "4px 32px", fontSize: "19px" }}>
            <TLink to="/privacy" style={{ minHeight: "56px", padding: "0 16px", display: "inline-flex", alignItems: "center", color: "#FFFFFF" }}> {T("Privacy")} </TLink>
            <a href="#call" style={{ minHeight: "56px", padding: "0 16px", display: "inline-flex", alignItems: "center", color: "#FFFFFF" }}> {T("Call us")} </a>
          </nav>
        </footer>
      </div>
    </div>
  );
}

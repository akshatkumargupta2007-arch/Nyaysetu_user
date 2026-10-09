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
    <div className="sc-home" style={{ position: "relative", isolation: "isolate", width: "390px", height: "844px", overflow: "hidden", boxSizing: "border-box", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "19px", lineHeight: "1.4", display: "flex", flexDirection: "column" }}>
      <svg viewBox="0 0 390 844" style={{ position: "absolute", left: "0", top: "0", width: "390px", height: "844px", zIndex: "-1", pointerEvents: "none" }} aria-hidden="true">
        <g fill="#EAF3E8">
          <g className="cloud">
            <ellipse cx="0" cy="96" rx="30" ry="11" />
            <ellipse cx="20" cy="88" rx="22" ry="10" />
            <ellipse cx="-22" cy="90" rx="18" ry="8" />
          </g>
          <g className="cloud c2">
            <ellipse cx="0" cy="190" rx="26" ry="9" />
            <ellipse cx="18" cy="183" rx="18" ry="8" />
          </g>
        </g>
        <g fill="#8CC79A">
          <ellipse className="leaf l1" cx="330" cy="0" rx="7" ry="3.5" />
          <ellipse className="leaf l2" cx="240" cy="0" rx="6" ry="3" fill="#5FAE78" />
          <ellipse className="leaf l3" cx="150" cy="0" rx="7" ry="3.5" />
          <ellipse className="leaf l4" cx="70" cy="0" rx="6" ry="3" fill="#5FAE78" />
          <ellipse className="leaf l5" cx="370" cy="0" rx="6" ry="3" />
        </g>
      </svg>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 0" }}>
        <Brand size="s" />
        <button className="pill" type="button" aria-label="Listen to this page" onClick={listen} style={{ height: "48px", padding: "0 14px", display: "inline-flex", alignItems: "center", gap: "6px", background: "transparent", border: "2px solid #1F6B3A", borderRadius: "24px", color: "#1F6B3A", font: "inherit", fontSize: "17px", fontWeight: "700", cursor: "pointer" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M16.500 8.500a5 5 0 0 1 0 7M19 6a8.500 8.500 0 0 1 0 12" />
          </svg> {T("Listen")} </button>
      </header>
      <main style={{ padding: "20px 20px 0", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <h1 style={{ margin: "0", fontSize: "42px", lineHeight: "1.08", fontWeight: "700", letterSpacing: "-0.01em" }}>
            {T("Something wrong")}{' '}
            <span style={{ color: "#1F6B3A" }}> {T("in your area?")} </span>
          </h1>
        </div>
        {writing && (
          <>
          <div className="enter" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <label htmlFor="issue" style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}> {T("Write here")} </label>
            <textarea id="issue" value={text} onChange={onText} style={{ height: "200px", boxSizing: "border-box", padding: "18px 20px", resize: "none", font: "inherit", fontSize: "24px", lineHeight: "1.35", color: "#1E2B22", background: "#FFFFFF", border: "3px solid #1F6B3A", borderRadius: "28px", boxShadow: "0 8px 24px rgba(31,107,58,0.12)" }}>
            </textarea>
            {err && (<p role="alert" style={{ margin: 0, textAlign: 'center', fontSize: '20px', fontWeight: 700, color: '#B4491F' }}>{err}</p>)}
            <div style={{ display: "flex", gap: "12px" }}>
              <button className="alt" type="button" aria-label="Back" onClick={closeWrite} style={{ flex: "none", width: "72px", height: "72px", boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#EFF5D5", border: "3px solid #1F6B3A", borderRadius: "22px", cursor: "pointer" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 12H5M11 6l-6 6 6 6" />
                </svg>
              </button>
              <TLink className="big" to="/where" onClick={okWrite} style={{ flex: "1 1 0", minWidth: "0", height: "72px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "#1F6B3A", border: "0", borderRadius: "22px", color: "#FFFFFF", font: "inherit", fontSize: "26px", fontWeight: "700", textDecoration: "none", cursor: "pointer" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.500l4.500 4.500L19 7.500" />
                </svg>
                OK
              </TLink>
            </div>
          </div>
          </>
        )}
        {notWriting && (
          <>
          <div className="enter" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", gap: "12px" }}>
              <TLink className="big" to="/speak" style={{ flex: "1 1 0", minWidth: "0", height: "124px", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", borderRadius: "28px", color: "#FFFFFF", textDecoration: "none", position: "relative", background: "#1F6B3A", border: "0" }}>
                <span className="micdot" style={{ flex: "none", width: "58px", height: "58px", borderRadius: "50%", background: "#FFFFFF", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  </svg>
                </span>
                <span style={{ fontSize: "26px", fontWeight: "700", lineHeight: "1.1" }}>
                  {T("Speak")}
                </span>
              </TLink>
              <TLink className="talk" to="/talk" aria-label="Talk to the AI voice assistant" style={{ flex: "1 1 0", minWidth: "0", height: "124px", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", borderRadius: "28px", color: "#FFFFFF", textDecoration: "none", position: "relative", background: "linear-gradient(160deg,#0F3F22,#1F6B3A)", border: "3px solid #E0A526" }}>
                <span style={{ position: "absolute", top: "10px", right: "10px", padding: "2px 10px", borderRadius: "99px", background: "#E0A526", color: "#14502B", fontSize: "13px", fontWeight: "700", letterSpacing: ".06em" }}>
                  {T("AI")}
                </span>
                <span className="tb" style={{ flex: "none", width: "58px", height: "58px", borderRadius: "50%", background: "#E0A526", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <i>
                  </i>
                  <i>
                  </i>
                  <i>
                  </i>
                  <i>
                  </i>
                </span>
                <span style={{ fontSize: "26px", fontWeight: "700", lineHeight: "1.1" }}>
                  {T("Talk")}
                </span>
              </TLink>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <TLink className="alt" to="/photo" style={{ flex: "1 1 0", minWidth: "0", height: "116px", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", background: "#EFF5D5", border: "3px solid #1F6B3A", borderRadius: "28px", color: "#1F6B3A", font: "inherit", fontSize: "22px", fontWeight: "700", textDecoration: "none", cursor: "pointer" }}>
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                  <circle cx="12" cy="13" r="3.500" />
                </svg>
                {T("Photo")}
              </TLink>
              <button className="alt" type="button" onClick={openWrite} style={{ flex: "1 1 0", minWidth: "0", height: "116px", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", background: "#EFF5D5", border: "3px solid #1F6B3A", borderRadius: "28px", color: "#1F6B3A", font: "inherit", fontSize: "22px", fontWeight: "700", cursor: "pointer" }}>
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                  <path d="M13 7l4 4" />
                </svg>
                {T("Write")}
              </button>
            </div>
          </div>
          </>
        )}
        <TLink className="link" to="/problems" style={{ alignSelf: "center", minHeight: "52px", padding: "0 18px", borderRadius: "26px", display: "inline-flex", alignItems: "center", gap: "8px", color: "#1F6B3A", fontSize: "20px", fontWeight: "700", textDecoration: "underline", textUnderlineOffset: "4px" }}> {T("My problems")} <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </TLink>
      </main>
      <div style={{ flexGrow: "1" }}>
      </div>
      <svg viewBox="0 0 390 160" preserveAspectRatio="xMidYMax slice" style={{ display: "block", width: "100%", height: "auto" }} aria-hidden="true">
        <circle cx="338" cy="46" r="24" fill="#F5E3B5" />
        <circle cx="330" cy="42" r="2.4" fill="#1E2B22" />
        <circle cx="346" cy="42" r="2.4" fill="#1E2B22" />
        <path d="M329 51q9 8 18 0" fill="none" stroke="#1E2B22" strokeWidth="2.4" strokeLinecap="round" />
        <g className="bird" stroke="#5C8A68" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M20 30q5-6 10 0q5-6 10 0" />
        </g>
        <g className="bird b2" stroke="#5C8A68" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M0 52q4-5 8 0q4-5 8 0" />
        </g>
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
        <g transform="translate(60 40)">
          <circle className="ping" r="6" fill="none" stroke="#E0A526" strokeWidth="2.5" />
          <path d="M0 12c-5-6-8-9-8-13a8 8 0 0 1 16 0c0 4-3 7-8 13z" transform="translate(0 0)" fill="#E0A526" />
          <circle cy="-1" r="2.8" fill="#FFFFFF" />
        </g>
        <rect x="0" y="144" width="390" height="16" fill="#4F7A5C" />
        <path d="M0 152H390" stroke="#F7F9F2" strokeWidth="2" strokeDasharray="16 14" />
        <g className="bus">
          <rect x="0" y="132" width="36" height="13" rx="4" fill="#1F6B3A" />
          <rect x="4" y="135" width="6" height="5" rx="1" fill="#E3F1E6" />
          <rect x="13" y="135" width="6" height="5" rx="1" fill="#E3F1E6" />
          <rect x="22" y="135" width="6" height="5" rx="1" fill="#E3F1E6" />
          <circle cx="9" cy="146" r="3" fill="#1E2B22" />
          <circle cx="27" cy="146" r="3" fill="#1E2B22" />
        </g>
        <rect x="206" y="118" width="3" height="26" fill="#38523F" />
        <circle cx="207.5" cy="116" r="5" fill="#E0A526" />
      </svg>
      <footer style={{ background: "#1F6B3A" }}>
        <nav aria-label="Footer" style={{ display: "flex", justifyContent: "center", gap: "16px", padding: "2px 20px", fontSize: "17px" }}>
          <TLink to="/privacy" style={{ minHeight: "52px", padding: "0 14px", display: "inline-flex", alignItems: "center", color: "#FFFFFF" }}> {T("Privacy")} </TLink>
          <a href="#call" style={{ minHeight: "52px", padding: "0 14px", display: "inline-flex", alignItems: "center", color: "#FFFFFF" }}> {T("Call us")} </a>
        </nav>
      </footer>
    </div>
  );
}

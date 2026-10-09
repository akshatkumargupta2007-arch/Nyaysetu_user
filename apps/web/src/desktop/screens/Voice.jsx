import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import './Voice.css';

export default function Voice() {
  const [on, setOn] = useState(() => isVoiceOn());
  const ASK = 'Do you want AI voice? Tap the switch to turn it on or off, then tap OK.';
  useEffect(() => {
    setVoiceOn(isVoiceOn());
    say(ASK, 'voice_ask');
    return () => stopVoice();
  }, []);
  const listen = () => say(ASK, 'voice_ask');
  const toggle = () => {
    const next = !on;
    setOn(next);
    setVoiceOn(next);
    if (next) say('Voice is on.', 'voice_on');
    else stopVoice();
  };

  return (
    <div className="sc-voice" style={{ position: "relative", isolation: "isolate", width: "100%", minHeight: "900px", boxSizing: "border-box", overflow: "hidden", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Sans Arabic',system-ui,sans-serif", fontSize: "20px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "relative", zIndex: "2", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "28px 40px 0 28px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/" aria-label="Go back" style={{ justifySelf: "start", width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
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
      <main style={{ flex: "1 1 auto", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "16px 40px 48px", display: "flex", alignItems: "center", justifyContent: "center", gap: "36px", flexDirection: "row", flexWrap: "wrap", gap: "56px 120px" }}>
        <div className="r1" style={{ flex: "0 1 520px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "26px" }}>
          <svg width="300" height="300" viewBox="0 0 168 168" aria-hidden="true">
            <circle className="sring" cx="84" cy="84" r="60" fill="none" stroke="#1F6B3A" strokeWidth="3" />
            <circle className="sring r2" cx="84" cy="84" r="60" fill="none" stroke="#1F6B3A" strokeWidth="3" />
            <circle cx="84" cy="84" r="62" fill="#1F6B3A" />
            <g fill="#FFFFFF">
              <rect className="bar" x="48" y="66" width="10" height="36" rx="5" />
              <rect className="bar b2" x="64" y="52" width="10" height="64" rx="5" />
              <rect className="bar b3" x="79" y="42" width="10" height="84" rx="5" />
              <rect className="bar b4" x="94" y="52" width="10" height="64" rx="5" />
              <rect className="bar b5" x="110" y="66" width="10" height="36" rx="5" />
            </g>
          </svg>
          <h1 style={{ margin: "0", fontSize: "76px", lineHeight: "1.05", fontWeight: "700" }}> {T("AI voice")} </h1>
          <p style={{ margin: "0", fontSize: "28px", color: "#4A5A4F" }}> {T("Reads each page out loud.")} </p>
        </div>
        <div className="r2" style={{ flex: "0 1 560px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "44px" }}>
          <div style={{ "--W": "500px", "--H": "236px", "--D": "196px", "--P": "20px", "--F": "64px" }}>
            <button className="sw" type="button" role="switch" aria-checked={on} aria-label="AI voice" onClick={toggle}>
              <span className="lab l-on"> {T("On")} </span>
              <span className="lab l-off"> {T("Off")} </span>
              <span className="knob">
                <span className="disc">
                  <span className="ic ic-on">
                    <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 9v6h4l5 4V5L8 9H4z" />
                      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
                    </svg>
                  </span>
                  <span className="ic ic-off">
                    <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#B4491F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 9v6h4l5 4V5L8 9H4z" />
                      <path d="M17 9l5 6M22 9l-5 6" />
                    </svg>
                  </span>
                </span>
              </span>
            </button>
          </div>
          <p style={{ margin: "0", textAlign: "center", fontSize: "22px", color: "#4A5A4F" }}> {T("You can tap Listen on any page to hear it again.")} </p>
          <TLink className="solid" to="/phone" style={{ width: "100%", height: "92px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "28px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "32px", fontWeight: "700", textDecoration: "none" }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            OK
          </TLink>
        </div>
      </main>
    </div>
  );
}

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
    <div className="sc-voice" style={{ width: "390px", height: "844px", overflow: "hidden", boxSizing: "border-box", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "19px", lineHeight: "1.3", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "14px 20px 0 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/" aria-label="Go back" style={{ justifySelf: "start", width: "52px", height: "52px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
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
      <main style={{ flex: "1 1 auto", padding: "0 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "22px" }}>
        <div style={{ position: "relative", width: "168px", height: "168px" }}>
          <svg width="168" height="168" viewBox="0 0 168 168" aria-hidden="true">
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
        </div>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "6px" }}>
          <h1 style={{ margin: "0", fontSize: "44px", lineHeight: "1.1", fontWeight: "700" }}> {T("AI voice")} </h1>
          <p style={{ margin: "0", fontSize: "20px", color: "#4A5A4F" }}> {T("Reads each page out loud.")} </p>
        </div>
        <div style={{ "--W": "288px", "--H": "136px", "--D": "108px", "--P": "14px", "--F": "34px", marginTop: "6px" }}>
          <button className="sw" type="button" role="switch" aria-checked={on} aria-label="AI voice" onClick={toggle}>
            <span className="lab l-on"> {T("On")} </span>
            <span className="lab l-off"> {T("Off")} </span>
            <span className="knob">
              <span className="disc">
                <span className="ic ic-on">
                  <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 9v6h4l5 4V5L8 9H4z" />
                    <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
                  </svg>
                </span>
                <span className="ic ic-off">
                  <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#B4491F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 9v6h4l5 4V5L8 9H4z" />
                    <path d="M17 9l5 6M22 9l-5 6" />
                  </svg>
                </span>
              </span>
            </span>
          </button>
        </div>
      </main>
      <div style={{ flex: "0 0 auto", padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <p style={{ margin: "0", textAlign: "center", fontSize: "18px", color: "#4A5A4F" }}> {T("You can tap Listen on any page to hear it again.")} </p>
        <TLink className="solid" to="/phone" style={{ height: "72px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", borderRadius: "22px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "26px", fontWeight: "700", textDecoration: "none" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.500l4.500 4.500L19 7.500" />
          </svg>
          OK
        </TLink>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import './PhotoRejected.css';

export default function PhotoRejected() {
  const listen = useScreenVoice('reject_ai', 'This photo looks made by AI. Please take a real photo.');

  return (
    <div className="sc-photorejected" style={{ position: "relative", isolation: "isolate", width: "100%", minHeight: "900px", boxSizing: "border-box", overflow: "hidden", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Sans Arabic',system-ui,sans-serif", fontSize: "20px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "relative", zIndex: "2", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "28px 40px 0 28px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/photo" aria-label="Go back" style={{ justifySelf: "start", width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
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
      <main style={{ flex: "1 1 auto", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "16px 40px 48px", display: "flex", alignItems: "center", justifyContent: "center", gap: "36px", flexDirection: "row", flexWrap: "wrap", gap: "48px 96px" }}>
        <div className="r1" style={{ flex: "0 1 560px", display: "flex", justifyContent: "center" }}>
          <svg width="540" height="428" viewBox="0 0 240 190" aria-hidden="true">
            <circle cx="120" cy="96" r="88" fill="#FCE9DF" />
            <g className="frame">
              <rect x="52" y="44" width="136" height="104" rx="12" fill="#FFFFFF" stroke="#DDE6D8" strokeWidth="3" />
              <rect x="60" y="52" width="120" height="88" rx="6" fill="#BFD9C5" />
              <circle cx="156" cy="70" r="9" fill="#F5E3B5" />
              <rect x="60" y="86" width="26" height="40" fill="#8DB596" />
              <polygon points="64,100 88,84 112,100 112,126 64,126" fill="#6C9A78" />
              <rect x="60" y="120" width="120" height="20" fill="#4B6B55" />
              <rect x="116" y="64" width="4" height="60" fill="#38523F" />
              <rect x="120" y="64" width="16" height="3" fill="#38523F" />
            </g>
            <g className="warn">
              <circle cx="182" cy="52" r="26" fill="#B4491F" stroke="#F7F9F2" strokeWidth="5" />
              <path d="M172 42l20 20M192 42l-20 20" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
            </g>
          </svg>
        </div>
        <div className="r2" style={{ flex: "1 1 480px", maxWidth: "640px", display: "flex", flexDirection: "column", gap: "28px" }}>
          <h1 style={{ margin: "0", fontSize: "80px", lineHeight: "1.08", fontWeight: "700" }}> {T("Use a real photo")} </h1>
          <section style={{ padding: "26px 30px", background: "#FFF6F0", border: "2px solid #F0C9B4", borderRadius: "32px", display: "flex", alignItems: "center", gap: "20px" }}>
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#A63F17" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 21V4M5 4h12l-2.5 4L17 12H5" />
            </svg>
            <p style={{ margin: "0", fontSize: "36px", fontWeight: "700", lineHeight: "1.25" }}> {T("This photo looks AI-made.")} </p>
          </section>
          <TLink className="solid" to="/photo" style={{ height: "92px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "28px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "32px", fontWeight: "700", textDecoration: "none" }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg> {T("Photo")} </TLink>
          <a className="text" href="#call" style={{ alignSelf: "flex-start", minHeight: "64px", padding: "0 28px", borderRadius: "32px", display: "inline-flex", alignItems: "center", gap: "12px", color: "#1F6B3A", fontSize: "30px", fontWeight: "700", textDecoration: "underline", textUnderlineOffset: "5px" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
            </svg> {T("Call us")} </a>
        </div>
      </main>
    </div>
  );
}

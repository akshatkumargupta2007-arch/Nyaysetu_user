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
    <div className="sc-photorejected" style={{ width: "390px", height: "844px", overflow: "hidden", boxSizing: "border-box", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "19px", lineHeight: "1.3", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "14px 20px 0 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/photo" aria-label="Go back" style={{ justifySelf: "start", width: "52px", height: "52px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
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
      <main style={{ padding: "24px 20px 0", display: "flex", flexDirection: "column", alignItems: "stretch", gap: "22px" }}>
        <svg width="260" height="206" viewBox="0 0 240 190" style={{ alignSelf: "center" }} aria-hidden="true">
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
        <h1 style={{ margin: "0", fontSize: "40px", lineHeight: "1.1", fontWeight: "700", textAlign: "center" }}> {T("Use a real photo")} </h1>
        <section style={{ padding: "18px 20px", background: "#FFF6F0", border: "2px solid #F0C9B4", borderRadius: "24px", display: "flex", alignItems: "center", gap: "14px" }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#A63F17" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
            <path d="M5 21V4M5 4h12l-2.500 4L17 12H5" />
          </svg>
          <p style={{ margin: "0", fontSize: "24px", fontWeight: "700", lineHeight: "1.2" }}> {T("This photo looks AI-made.")} </p>
        </section>
      </main>
      <div style={{ flexGrow: "1" }}>
      </div>
      <div style={{ padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <TLink className="solid" to="/photo" style={{ height: "72px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "#1F6B3A", borderRadius: "22px", color: "#FFFFFF", fontSize: "26px", fontWeight: "700", textDecoration: "none" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
            <circle cx="12" cy="13" r="3.500" />
          </svg> {T("Photo")} </TLink>
        <a className="text" href="#call" style={{ alignSelf: "center", minHeight: "52px", padding: "0 22px", borderRadius: "26px", display: "inline-flex", alignItems: "center", gap: "8px", color: "#1F6B3A", fontSize: "22px", fontWeight: "700", textDecoration: "underline", textUnderlineOffset: "4px" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
          </svg> {T("Call us")} </a>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import './NeedsFix.css';

export default function NeedsFix() {
  const listen = useScreenVoice('flag_mismatch', 'This problem needs a fix. The photo and the place do not match.');

  return (
    <div className="sc-needsfix" style={{ width: "390px", height: "844px", overflow: "hidden", boxSizing: "border-box", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "19px", lineHeight: "1.3", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "14px 20px 0 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/problems" aria-label="Go back" style={{ justifySelf: "start", width: "52px", height: "52px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
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
          <rect x="68" y="38" width="104" height="128" rx="14" fill="#FFFFFF" stroke="#DDE6D8" strokeWidth="3" />
          <rect x="98" y="30" width="44" height="16" rx="8" fill="#1F6B3A" />
          <rect x="82" y="62" width="76" height="8" rx="4" fill="#C5D8C6" />
          <rect x="82" y="80" width="56" height="8" rx="4" fill="#C5D8C6" />
          <rect x="82" y="98" width="68" height="8" rx="4" fill="#C5D8C6" />
          <rect x="82" y="116" width="40" height="8" rx="4" fill="#C5D8C6" />
          <g className="warn">
            <circle cx="170" cy="56" r="26" fill="#B4491F" stroke="#F7F9F2" strokeWidth="5" />
            <g className="flag">
              <path d="M162 70V44M162 44h16l-4 6 4 6h-16" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
        </svg>
        <h1 style={{ margin: "0", fontSize: "40px", lineHeight: "1.1", fontWeight: "700", textAlign: "center" }}> {T("Needs a fix")} </h1>
        <section style={{ padding: "18px 20px", background: "#FFF6F0", border: "2px solid #F0C9B4", borderRadius: "24px", display: "flex", alignItems: "center", gap: "14px" }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#A63F17" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
            <path d="M5 21V4M5 4h12l-2.500 4L17 12H5" />
          </svg>
          <p style={{ margin: "0", fontSize: "24px", fontWeight: "700", lineHeight: "1.2" }}> {T("The photo and the place do not match.")} </p>
        </section>
      </main>
      <div style={{ flexGrow: "1" }}>
      </div>
      <div style={{ padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <TLink className="solid" to="/send" style={{ height: "72px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "#1F6B3A", borderRadius: "22px", color: "#FFFFFF", fontSize: "26px", fontWeight: "700", textDecoration: "none" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16v4z" />
            <path d="M13 7l4 4" />
          </svg> {T("Fix")} </TLink>
        <a className="text" href="#call" style={{ alignSelf: "center", minHeight: "52px", padding: "0 22px", borderRadius: "26px", display: "inline-flex", alignItems: "center", gap: "8px", color: "#1F6B3A", fontSize: "22px", fontWeight: "700", textDecoration: "underline", textUnderlineOffset: "4px" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
          </svg> {T("Call us")} </a>
      </div>
    </div>
  );
}

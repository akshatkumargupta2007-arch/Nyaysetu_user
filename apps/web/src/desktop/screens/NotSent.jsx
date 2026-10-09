import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import './NotSent.css';

export default function NotSent() {
  const listen = useScreenVoice('not_sent', 'Not sent. Check your internet and tap Again.');

  return (
    <div className="sc-notsent" style={{ position: "relative", isolation: "isolate", width: "100%", minHeight: "900px", boxSizing: "border-box", overflow: "hidden", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Sans Arabic',system-ui,sans-serif", fontSize: "20px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "relative", zIndex: "2", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "28px 40px 0 28px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/send" aria-label="Go back" style={{ justifySelf: "start", width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
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
          <svg width="540" height="450" viewBox="0 0 240 200" aria-hidden="true">
            <circle cx="120" cy="100" r="92" fill="#FCE9DF" />
            <path d="M78 134h84a28 28 0 0 0 4-55.7A40 40 0 0 0 88 86a24 24 0 0 0-10 48z" fill="#FFFFFF" stroke="#DDE6D8" strokeWidth="3" />
            <g className="slash">
              <path d="M82 56l76 86" stroke="#B4491F" strokeWidth="10" strokeLinecap="round" />
            </g>
          </svg>
        </div>
        <div className="r2" style={{ flex: "1 1 480px", maxWidth: "640px", display: "flex", flexDirection: "column", gap: "28px" }}>
          <h1 style={{ margin: "0", fontSize: "80px", lineHeight: "1.08", fontWeight: "700" }}> {T("Not sent")} </h1>
          <p style={{ margin: "0", fontSize: "40px", fontWeight: "700", color: "#A63F17" }}> {T("Check your internet.")} </p>
          <TLink className="solid" to="/send" style={{ height: "92px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "28px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "32px", fontWeight: "700", textDecoration: "none" }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5" />
            </svg> {T("Again")} </TLink>
          <a className="text" href="#call" style={{ alignSelf: "flex-start", minHeight: "64px", padding: "0 28px", borderRadius: "32px", display: "inline-flex", alignItems: "center", gap: "12px", color: "#1F6B3A", fontSize: "30px", fontWeight: "700", textDecoration: "underline", textUnderlineOffset: "5px" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
            </svg> {T("Call us")} </a>
        </div>
      </main>
    </div>
  );
}

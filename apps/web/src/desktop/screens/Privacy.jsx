import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import './Privacy.css';

export default function Privacy() {
  const listen = useScreenVoice('privacy', 'Privacy. Your phone number is used to send you news about your problem. Your photo and place help the team find it. Only the people who fix problems can see them.');

  return (
    <div className="sc-privacy" style={{ position: "relative", isolation: "isolate", width: "100%", minHeight: "900px", boxSizing: "border-box", overflow: "hidden", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Sans Arabic',system-ui,sans-serif", fontSize: "20px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "relative", zIndex: "2", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "28px 40px 0 28px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/home" aria-label="Go back" style={{ justifySelf: "start", width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
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
      <main style={{ flex: "1 1 auto", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "16px 40px 48px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "36px", gap: "24px", paddingBottom: "32px" }}>
        <svg className="r1" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="58" fill="#EAF3CF" />
          <path d="M60 18l34 12v26c0 22-14 38-34 46-20-8-34-24-34-46V30z" fill="#1F6B3A" />
          <rect x="46" y="54" width="28" height="24" rx="5" fill="#FFFFFF" />
          <path d="M51 54v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
          <circle cx="60" cy="66" r="3.5" fill="#1F6B3A" />
        </svg>
        <h1 className="r1" style={{ margin: "0", fontSize: "72px", lineHeight: "1.08", fontWeight: "700" }}> {T("Privacy")} </h1>
        <div style={{ width: "100%", maxWidth: "1280px", display: "flex", flexWrap: "wrap", gap: "28px" }}>
          <section className="r2" style={{ flex: "1 1 320px", boxSizing: "border-box", padding: "30px 34px", background: "#FFFFFF", border: "2px solid #DDE6D8", borderRadius: "40px", display: "flex", flexDirection: "column", gap: "22px" }}>
            <span style={{ width: "80px", height: "80px", borderRadius: "26px", background: "#EFF5D5", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
              </svg>
            </span>
            <span style={{ fontSize: "34px", fontWeight: "700", lineHeight: "1.3" }}> {T("Your phone number is used to send you news about your problem.")} </span>
          </section>
        <section className="r2" style={{ flex: "1 1 320px", boxSizing: "border-box", padding: "30px 34px", background: "#FFFFFF", border: "2px solid #DDE6D8", borderRadius: "40px", display: "flex", flexDirection: "column", gap: "22px" }}>
            <span style={{ width: "80px", height: "80px", borderRadius: "26px", background: "#EFF5D5", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
              </svg>
            </span>
            <span style={{ fontSize: "34px", fontWeight: "700", lineHeight: "1.3" }}> {T("A government official handling your complaint may call you to confirm it or understand it better. Your number won't be shared with anyone else.")} </span>
          </section>
          <section className="r2" style={{ flex: "1 1 320px", boxSizing: "border-box", padding: "30px 34px", background: "#FFFFFF", border: "2px solid #DDE6D8", borderRadius: "40px", display: "flex", flexDirection: "column", gap: "22px" }}>
            <span style={{ width: "80px", height: "80px", borderRadius: "26px", background: "#EFF5D5", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </span>
            <span style={{ fontSize: "34px", fontWeight: "700", lineHeight: "1.3" }}> {T("Your photo and place help the team find the problem.")} </span>
          </section>
          <section className="r2" style={{ flex: "1 1 320px", boxSizing: "border-box", padding: "30px 34px", background: "#FFFFFF", border: "2px solid #DDE6D8", borderRadius: "40px", display: "flex", flexDirection: "column", gap: "22px" }}>
            <span style={{ width: "80px", height: "80px", borderRadius: "26px", background: "#EFF5D5", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
            <span style={{ fontSize: "34px", fontWeight: "700", lineHeight: "1.3" }}> {T("Only the people who fix problems can see them.")} </span>
          </section>
        </div>
        <div style={{ width: "100%", maxWidth: "520px" }}>
          <TLink className="solid" to="/home" style={{ height: "92px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "28px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "32px", fontWeight: "700", textDecoration: "none" }}>
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

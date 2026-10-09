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
    <div className="sc-privacy" style={{ width: "390px", height: "844px", overflow: "hidden", boxSizing: "border-box", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "19px", lineHeight: "1.3", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "14px 20px 0 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/home" aria-label="Go back" style={{ justifySelf: "start", width: "52px", height: "52px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
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
      <main style={{ padding: "16px 20px 0", display: "flex", flexDirection: "column", gap: "14px" }}>
        <svg width="104" height="104" viewBox="0 0 120 120" style={{ alignSelf: "center" }} aria-hidden="true">
          <circle cx="60" cy="60" r="58" fill="#EAF3CF" />
          <path d="M60 18l34 12v26c0 22-14 38-34 46-20-8-34-24-34-46V30z" fill="#1F6B3A" />
          <rect x="46" y="54" width="28" height="24" rx="5" fill="#FFFFFF" />
          <path d="M51 54v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
          <circle cx="60" cy="66" r="3.500" fill="#1F6B3A" />
        </svg>
        <h1 style={{ margin: "0", fontSize: "40px", lineHeight: "1.1", fontWeight: "700", textAlign: "center" }}> {T("Privacy")} </h1>
        <section style={{ display: "flex", alignItems: "center", gap: "14px", minHeight: "84px", boxSizing: "border-box", padding: "12px 16px", background: "#FFFFFF", border: "2px solid #DDE6D8", borderRadius: "22px" }}>
          <span style={{ flex: "none", width: "52px", height: "52px", borderRadius: "16px", background: "#EFF5D5", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
            </svg>
          </span>
          <span style={{ fontSize: "21px", fontWeight: "700", lineHeight: "1.25" }}> {T("Your phone number is used to send you news about your problem.")} </span>
        </section>
        <section style={{ display: "flex", alignItems: "center", gap: "14px", minHeight: "84px", boxSizing: "border-box", padding: "12px 16px", background: "#FFFFFF", border: "2px solid #DDE6D8", borderRadius: "22px" }}>
          <span style={{ flex: "none", width: "52px", height: "52px", borderRadius: "16px", background: "#EFF5D5", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
            </svg>
          </span>
          <span style={{ fontSize: "21px", fontWeight: "700", lineHeight: "1.25" }}> {T("A government official handling your complaint may call you to confirm it or understand it better. Your number won't be shared with anyone else.")} </span>
        </section>
        <section style={{ display: "flex", alignItems: "center", gap: "14px", minHeight: "84px", boxSizing: "border-box", padding: "12px 16px", background: "#FFFFFF", border: "2px solid #DDE6D8", borderRadius: "22px" }}>
          <span style={{ flex: "none", width: "52px", height: "52px", borderRadius: "16px", background: "#EFF5D5", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.500" />
            </svg>
          </span>
          <span style={{ fontSize: "21px", fontWeight: "700", lineHeight: "1.25" }}> {T("Your photo and place help the team find the problem.")} </span>
        </section>
        <section style={{ display: "flex", alignItems: "center", gap: "14px", minHeight: "84px", boxSizing: "border-box", padding: "12px 16px", background: "#FFFFFF", border: "2px solid #DDE6D8", borderRadius: "22px" }}>
          <span style={{ flex: "none", width: "52px", height: "52px", borderRadius: "16px", background: "#EFF5D5", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </span>
          <span style={{ fontSize: "21px", fontWeight: "700", lineHeight: "1.25" }}> {T("Only the people who fix problems can see them.")} </span>
        </section>
      </main>
      <div style={{ flexGrow: "1" }}>
      </div>
      <div style={{ padding: "0 20px 24px" }}>
        <TLink className="solid" to="/home" style={{ height: "72px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", borderRadius: "22px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "26px", fontWeight: "700", textDecoration: "none" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.500l4.500 4.500L19 7.500" />
          </svg>
          OK
        </TLink>
      </div>
    </div>
  );
}

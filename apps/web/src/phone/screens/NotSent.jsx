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
    <div className="sc-notsent" style={{ width: "390px", height: "844px", overflow: "hidden", boxSizing: "border-box", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "19px", lineHeight: "1.3", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "14px 20px 0 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/send" aria-label="Go back" style={{ justifySelf: "start", width: "52px", height: "52px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
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
      <main style={{ padding: "56px 20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "30px" }}>
        <svg width="240" height="200" viewBox="0 0 240 200" aria-hidden="true">
          <circle cx="120" cy="100" r="92" fill="#FCE9DF" />
          <path d="M78 134h84a28 28 0 0 0 4-55.700A40 40 0 0 0 88 86a24 24 0 0 0-10 48z" fill="#FFFFFF" stroke="#DDE6D8" strokeWidth="3" />
          <g className="slash">
            <path d="M82 56l76 86" stroke="#B4491F" strokeWidth="10" strokeLinecap="round" />
          </g>
        </svg>
        <h1 style={{ margin: "0", fontSize: "44px", lineHeight: "1.1", fontWeight: "700", textAlign: "center" }}> {T("Not sent")} </h1>
        <p style={{ margin: "0", fontSize: "26px", fontWeight: "700", color: "#A63F17", textAlign: "center" }}> {T("Check your internet.")} </p>
      </main>
      <div style={{ flexGrow: "1" }}>
      </div>
      <div style={{ padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <TLink className="solid" to="/send" style={{ height: "72px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "#1F6B3A", borderRadius: "22px", color: "#FFFFFF", fontSize: "26px", fontWeight: "700", textDecoration: "none" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.500-5.800M20 4v5h-5" />
          </svg> {T("Again")} </TLink>
        <a className="text" href="#call" style={{ alignSelf: "center", minHeight: "52px", padding: "0 22px", borderRadius: "26px", display: "inline-flex", alignItems: "center", gap: "8px", color: "#1F6B3A", fontSize: "22px", fontWeight: "700", textDecoration: "underline", textUnderlineOffset: "4px" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
          </svg> {T("Call us")} </a>
      </div>
    </div>
  );
}

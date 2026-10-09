import React, { useState, useEffect, useRef } from 'react';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { say, auto, stopVoice, useScreenVoice, useCodeVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import './Sent.css';
import Brand from '../../shared/Brand.jsx';
import { api, fileComplaint } from '../../shared/api.js';
import { store, auth } from '../../shared/store.js';
import { FALLBACK_COORDS } from '../../shared/config.js';


export default function Sent() {
  const filed = store.filed();
  const code = filed ? filed.publicCode : '-';
  useCodeVoice('sent_intro', filed ? filed.publicCode : '', filed ? 'Sent. Your number is ' + filed.publicCode.split('').join(' ') + '.' : 'Sent.');
  useEffect(() => () => store.clearDraft(), []);
  const extra = filed && filed.merged ? T('{n} other people reported this too. Your voice was added.', { n: filed.reportCount - 1 }) : '';

  return (
    <div className="sc-sent" style={{ position: "relative", isolation: "isolate", width: "100%", minHeight: "900px", boxSizing: "border-box", overflow: "hidden", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Sans Arabic',system-ui,sans-serif", fontSize: "20px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "absolute", top: "26px", left: "40px", zIndex: 6 }}><Brand size="l" style={{ background: "rgba(247,249,242,0.92)", padding: "4px 12px 4px 4px", borderRadius: 999, boxShadow: "0 1px 4px rgba(31,107,58,0.18)" }} /></div>
      <main style={{ flex: "1 1 auto", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "16px 40px 48px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "36px", paddingTop: "8px", paddingBottom: "24px", gap: "28px" }}>
        <div className="badge" style={{ position: "relative", width: "190px", height: "190px" }}>
          <span className="dot" style={{ left: "6px", bottom: "36px", width: "14px", height: "14px", background: "#E0A526", animationDelay: ".9s" }}>
          </span>
          <span className="dot" style={{ right: "4px", bottom: "60px", width: "18px", height: "18px", background: "#9CC3AE", animationDelay: "1.4s" }}>
          </span>
          <span className="dot" style={{ left: "48px", top: "6px", width: "12px", height: "12px", background: "#1F6B3A", animationDelay: "2s" }}>
          </span>
          <svg width="190" height="190" viewBox="0 0 168 168" aria-hidden="true">
            <circle cx="84" cy="84" r="76" fill="#E3EFE8" />
            <circle className="circ" cx="84" cy="84" r="60" fill="none" stroke="#2F6B4F" strokeWidth="8" strokeLinecap="round" transform="rotate(-90 84 84)" />
            <path className="tick" d="M58 86l19 19 35-40" fill="none" stroke="#2F6B4F" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="r3" style={{ margin: "0", fontSize: "84px", lineHeight: "1.05", fontWeight: "700", color: "#1F5239" }}> {T("Sent!")} </h1>
        <div className="r3" style={{ width: "100%", maxWidth: "680px", boxSizing: "border-box", padding: "20px 36px", background: "#FFFFFF", border: "2px solid #DDE6D8", borderRadius: "36px", textAlign: "center", display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "26px", color: "#4A5A4F" }}> {T("Your number")} </span>
          <span style={{ fontSize: "64px", fontWeight: "700", letterSpacing: "0.04em", color: "#1F6B3A" }}>
            {code}
          </span>
          <span style={{ fontSize: "18px", color: "#4A5A4F" }}>
            {extra}
          </span>
        </div>
        <div className="r4" style={{ width: "100%", maxWidth: "860px", display: "flex", flexWrap: "wrap", gap: "16px" }}>
          <TLink className="solid" to="/problems" style={{ flex: "1 1 280px", height: "92px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "28px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "32px", fontWeight: "700", textDecoration: "none" }}> {T("My problems")} <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </TLink>
          <TLink className="alt" to="/home" style={{ flex: "1 1 200px", height: "92px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "28px", background: "#EFF5D5", border: "3px solid #1F6B3A", color: "#1F6B3A", fontSize: "32px", fontWeight: "700", textDecoration: "none" }}> {T("Home")} </TLink>
        </div>
      </main>
      <svg viewBox="0 0 1560 160" preserveAspectRatio="xMidYMax slice" style={{ display: "block", width: "100%", height: "170px" }} aria-hidden="true">
        <defs>
          <g id="tile">
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
            <rect x="206" y="118" width="3" height="26" fill="#38523F" />
            <circle cx="207.5" cy="116" r="5" fill="#E0A526" />
          </g>
        </defs>
        <g className="bird" stroke="#5C8A68" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M20 30q5-6 10 0q5-6 10 0" />
        </g>
        <g className="bird b2" stroke="#5C8A68" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M0 52q4-5 8 0q4-5 8 0" />
        </g>
        <use href="#tile" x="0" />
        <g transform="translate(780 0) scale(-1 1)">
          <use href="#tile" />
        </g>
        <use href="#tile" x="780" />
        <g transform="translate(1560 0) scale(-1 1)">
          <use href="#tile" />
        </g>
        <g transform="translate(560 40)">
          <circle className="ping" r="6" fill="none" stroke="#E0A526" strokeWidth="2.5" />
          <path d="M0 12c-5-6-8-9-8-13a8 8 0 0 1 16 0c0 4-3 7-8 13z" fill="#E0A526" />
          <circle cy="-1" r="2.8" fill="#FFFFFF" />
        </g>
        <rect x="0" y="144" width="1560" height="16" fill="#4F7A5C" />
        <path d="M0 152H1560" stroke="#F7F9F2" strokeWidth="2" strokeDasharray="16 14" />
        <g className="bus">
          <rect x="0" y="132" width="36" height="13" rx="4" fill="#1F6B3A" />
          <rect x="4" y="135" width="6" height="5" rx="1" fill="#E3F1E6" />
          <rect x="13" y="135" width="6" height="5" rx="1" fill="#E3F1E6" />
          <rect x="22" y="135" width="6" height="5" rx="1" fill="#E3F1E6" />
          <circle cx="9" cy="146" r="3" fill="#1E2B22" />
          <circle cx="27" cy="146" r="3" fill="#1E2B22" />
        </g>
      </svg>
    </div>
  );
}

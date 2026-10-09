import React, { useState, useEffect, useRef } from 'react';
import { TLink } from '../components/TLink.jsx';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import './Language.css';
import Brand from '../../shared/Brand.jsx';
import { store, auth } from '../../shared/store.js';

export default function Language() {
  // Every visit starts a fresh login: language -> AI voice -> WhatsApp login -> home.
  useEffect(() => { auth.clear(); store.setDevOtp(''); }, []);
  useScreenVoice('/audio/language.wav', 'Choose your language.'); // spoken in Hindi, before any language is chosen
  const L = [
    { code: 'hi', name: 'हिन्दी' },
    { code: 'bn', name: 'বাংলা' },
    { code: 'mr', name: 'मराठी' },
    { code: 'gu', name: 'ગુજરાતી' },
    { code: 'kn', name: 'ಕನ್ನಡ' },
    { code: 'ml', name: 'മലയാളം' },
    { code: 'ta', name: 'தமிழ்' },
    { code: 'te', name: 'తెలుగు' },
    { code: 'or', name: 'ଓଡ଼ିଆ' },
    { code: 'as', name: 'অসমীয়া' },
  ];
  const languages = L.map((l) => ({ ...l, pick: () => setLang(l.code) }));
  const pickEn = () => setLang('en');

  return (
    <div className="sc-language" style={{ position: "relative", isolation: "isolate", width: "100%", minHeight: "900px", boxSizing: "border-box", overflow: "hidden", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Sans Arabic',system-ui,sans-serif", fontSize: "20px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "absolute", top: "26px", left: "40px", zIndex: 6 }}><Brand label="न्यायसेतु" size="l" style={{ background: "rgba(247,249,242,0.92)", padding: "4px 12px 4px 4px", borderRadius: 999, boxShadow: "0 1px 4px rgba(31,107,58,0.18)" }} /></div>
      <h1 style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", margin: "0" }}>
        Choose your language
      </h1>
      <div style={{ position: "relative", flex: "none", height: "270px", background: "#E6F2E8", overflow: "hidden" }}>
        <svg viewBox="0 0 1440 300" preserveAspectRatio="xMidYMin slice" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: "270px", zIndex: "2", pointerEvents: "none" }} aria-hidden="true">
          <defs>
            <path id="lf" d="M0 0C5-7 15-7 22 0C15 7 5 7 0 0Z" />
            <g id="fl">
              <ellipse cy="-5.5" rx="3.4" ry="5.5" />
              <ellipse cy="-5.5" rx="3.4" ry="5.5" transform="rotate(72)" />
              <ellipse cy="-5.5" rx="3.4" ry="5.5" transform="rotate(144)" />
              <ellipse cy="-5.5" rx="3.4" ry="5.5" transform="rotate(216)" />
              <ellipse cy="-5.5" rx="3.4" ry="5.5" transform="rotate(288)" />
              <circle r="2.6" fill="#F5C842" />
            </g>
            <g id="canopy">
              <g fill="none" stroke="#6F5B45" strokeLinecap="round" strokeLinejoin="round">
                <path d="M-14 24C18 22 48 6 96 10S150 16 178 8" strokeWidth="4.5" />
                <path d="M40 12C44 24 50 32 58 42" strokeWidth="2.6" />
                <path d="M96 10C100 22 108 30 118 38" strokeWidth="2.6" />
                <path d="M150 14C152 22 160 28 166 32" strokeWidth="2.4" />
              </g>
              <g transform="translate(6 24) rotate(70)">
                <use className="flut" href="#lf" fill="#5FAE78" />
              </g>
              <g transform="translate(20 18) rotate(-50)">
                <use className="flut f2" href="#lf" fill="#8CC79A" />
              </g>
              <g transform="translate(30 16) rotate(80) scale(1.1)">
                <use className="flut f3" href="#lf" fill="#5FAE78" />
              </g>
              <g transform="translate(44 10) rotate(-70)">
                <use className="flut" href="#lf" fill="#8CC79A" />
              </g>
              <g transform="translate(52 10) rotate(60) scale(1.1)">
                <use className="flut f2" href="#lf" fill="#4E9A68" />
              </g>
              <g transform="translate(66 8) rotate(-40)">
                <use className="flut f3" href="#lf" fill="#8CC79A" />
              </g>
              <g transform="translate(74 10) rotate(85) scale(1.1)">
                <use className="flut" href="#lf" fill="#5FAE78" />
              </g>
              <g transform="translate(88 10) rotate(-60)">
                <use className="flut f2" href="#lf" fill="#4E9A68" />
              </g>
              <g transform="translate(100 10) rotate(70) scale(1.2)">
                <use className="flut f3" href="#lf" fill="#8CC79A" />
              </g>
              <g transform="translate(112 10) rotate(-30)">
                <use className="flut" href="#lf" fill="#5FAE78" />
              </g>
              <g transform="translate(124 12) rotate(80)">
                <use className="flut f2" href="#lf" fill="#4E9A68" />
              </g>
              <g transform="translate(138 14) rotate(-50)">
                <use className="flut f3" href="#lf" fill="#8CC79A" />
              </g>
              <g transform="translate(150 14) rotate(60) scale(1.1)">
                <use className="flut" href="#lf" fill="#5FAE78" />
              </g>
              <g transform="translate(164 10) rotate(-20)">
                <use className="flut f2" href="#lf" fill="#8CC79A" />
              </g>
              <g transform="translate(172 8) rotate(40) scale(1.1)">
                <use className="flut f3" href="#lf" fill="#4E9A68" />
              </g>
              <g transform="translate(44 24) rotate(80)">
                <use className="flut" href="#lf" fill="#5FAE78" />
              </g>
              <g transform="translate(50 32) rotate(70)">
                <use className="flut f2" href="#lf" fill="#8CC79A" />
              </g>
              <g transform="translate(56 40) rotate(100) scale(1.2)">
                <use className="flut f3" href="#lf" fill="#4E9A68" />
              </g>
              <g transform="translate(102 22) rotate(80)">
                <use className="flut" href="#lf" fill="#8CC79A" />
              </g>
              <g transform="translate(110 30) rotate(70)">
                <use className="flut f2" href="#lf" fill="#5FAE78" />
              </g>
              <g transform="translate(116 36) rotate(100) scale(1.2)">
                <use className="flut f3" href="#lf" fill="#4E9A68" />
              </g>
              <g transform="translate(158 24) rotate(80)">
                <use className="flut" href="#lf" fill="#5FAE78" />
              </g>
              <g transform="translate(165 31) rotate(95)">
                <use className="flut f2" href="#lf" fill="#8CC79A" />
              </g>
              <use href="#fl" fill="#F08A5D" transform="translate(62 46)" />
              <use href="#fl" fill="#F7B7C5" transform="translate(121 42)" />
              <use href="#fl" fill="#F7B7C5" transform="translate(32 28) scale(0.8)" />
              <use href="#fl" fill="#F08A5D" transform="translate(168 35) scale(0.8)" />
            </g>
          </defs>
          <circle cx="1180" cy="96" r="36" fill="#F5E3B5" />
          <circle cx="1168" cy="90" r="3.4" fill="#1E2B22" />
          <circle cx="1192" cy="90" r="3.4" fill="#1E2B22" />
          <path d="M1166 104q14 12 28 0" fill="none" stroke="#1E2B22" strokeWidth="3.4" strokeLinecap="round" />
          <g className="sway" style={{ transformOrigin: "0px 14px" }}>
            <g transform="scale(1.5)">
              <use href="#canopy" />
            </g>
          </g>
          <g transform="translate(1440 0) scale(-1.5 1.5)">
            <g className="sway s2" style={{ transformOrigin: "0px 14px" }}>
              <use href="#canopy" />
            </g>
          </g>
        </svg>
        <div style={{ position: "absolute", left: "0", right: "0", bottom: "0" }}>
          <svg viewBox="0 0 1560 160" preserveAspectRatio="xMidYMax slice" style={{ display: "block", width: "100%", height: "240px" }} aria-hidden="true">
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
      </div>
      <main style={{ flex: "1 1 auto", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "36px 40px 44px", display: "flex" }}>
        <div style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gridAutoRows: "minmax(110px, 1fr)", gap: "22px" }}>
          <TLink className="lang" to="/voice" lang="en" onClick={pickEn} style={{ minHeight: "120px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFFFF", border: "3px solid #C5D8C6", borderRadius: "30px", color: "#1E2B22", fontSize: "42px", fontWeight: "700", textDecoration: "none", fontStyle: "normal", boxShadow: "0 6px 18px rgba(31,107,58,0.06)" }}>
            English
          </TLink>
          {languages.map((l, __i) => (
            <React.Fragment key={__i}>
            <TLink className="lang" to="/voice" lang={l.code} onClick={l.pick} style={{ minHeight: "120px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFFFF", border: "3px solid #C5D8C6", borderRadius: "30px", color: "#1E2B22", fontSize: "42px", fontWeight: "700", textDecoration: "none", fontStyle: "normal", boxShadow: "0 6px 18px rgba(31,107,58,0.06)" }}>
              {l.name}
            </TLink>
            </React.Fragment>
          ))}
        </div>
      </main>
    </div>
  );
}

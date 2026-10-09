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
    <div className="sc-language" style={{ position: "relative", isolation: "isolate", width: "390px", height: "844px", overflow: "hidden", boxSizing: "border-box", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Sans Arabic',system-ui,sans-serif", fontSize: "18px", lineHeight: "1.4", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "absolute", top: "16px", left: "20px", zIndex: 6 }}><Brand label="न्यायसेतु" size="s" style={{ background: "rgba(247,249,242,0.92)", padding: "4px 12px 4px 4px", borderRadius: 999, boxShadow: "0 1px 4px rgba(31,107,58,0.18)" }} /></div>
      <svg viewBox="0 0 390 844" style={{ position: "absolute", left: "0", top: "0", width: "390px", height: "844px", zIndex: "1", pointerEvents: "none" }} aria-hidden="true">
        <g fill="#EAF3E8">
          <g className="cloud">
            <ellipse cx="0" cy="96" rx="30" ry="11" />
            <ellipse cx="20" cy="88" rx="22" ry="10" />
            <ellipse cx="-22" cy="90" rx="18" ry="8" />
          </g>
          <g className="cloud c2">
            <ellipse cx="0" cy="190" rx="26" ry="9" />
            <ellipse cx="18" cy="183" rx="18" ry="8" />
          </g>
        </g>
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
        <g className="sway" style={{ transformOrigin: "0px 14px" }}>
          <use href="#canopy" />
        </g>
        <g transform="translate(390 0) scale(-1 1)">
          <g className="sway s2" style={{ transformOrigin: "0px 14px" }}>
            <use href="#canopy" />
          </g>
        </g>
        <g fill="#8CC79A">
          <ellipse className="leaf l1" cx="330" cy="0" rx="7" ry="3.5" />
          <ellipse className="leaf l2" cx="240" cy="0" rx="6" ry="3" fill="#5FAE78" />
          <ellipse className="leaf l3" cx="150" cy="0" rx="7" ry="3.5" />
          <ellipse className="leaf l4" cx="70" cy="0" rx="6" ry="3" fill="#5FAE78" />
          <ellipse className="leaf l5" cx="370" cy="0" rx="6" ry="3" />
        </g>
      </svg>
      <h1 style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", margin: "0" }}>
        Choose your language
      </h1>
      <div style={{ background: "#E6F2E8" }}>
        <div style={{ height: "28px" }}>
        </div>
        <svg viewBox="0 0 390 120" preserveAspectRatio="xMidYMax slice" style={{ display: "block", width: "100%", height: "auto" }} aria-hidden="true">
          <circle cx="326" cy="52" r="24" fill="#F5E3B5" />
          <circle cx="318" cy="48" r="2.4" fill="#1E2B22" />
          <circle cx="334" cy="48" r="2.4" fill="#1E2B22" />
          <path d="M317 57q9 8 18 0" fill="none" stroke="#1E2B22" strokeWidth="2.4" strokeLinecap="round" />
          <g className="bird" stroke="#5C8A68" strokeWidth="2" fill="none" strokeLinecap="round">
            <path d="M20 30q5-6 10 0q5-6 10 0" />
          </g>
          <g className="bird b2" stroke="#5C8A68" strokeWidth="2" fill="none" strokeLinecap="round">
            <path d="M0 52q4-5 8 0q4-5 8 0" />
          </g>
          <g className="smoke" fill="#F6FAF4">
            <ellipse cx="74" cy="30" rx="16" ry="8" />
            <ellipse cx="90" cy="18" rx="13" ry="6" />
            <ellipse cx="112" cy="44" rx="12" ry="6" />
          </g>
          <g fill="#B7D9BE">
            <rect x="251" y="48" width="3" height="46" />
          </g>
          <g className="spin" stroke="#B7D9BE" strokeWidth="3" strokeLinecap="round">
            <path d="M252.500 48V28M252.500 48l-17 10M252.500 48l17 10" />
          </g>
          <g fill="#BADDC1">
            <polygon points="62,120 65,36 77,36 80,120" />
            <polygon points="94,120 96,56 106,56 108,120" />
            <path d="M130 120C135 98 135 84 132 70H168C165 84 165 98 170 120Z" />
          </g>
          <g fill="#CFE7D3">
            <rect x="0" y="80" width="40" height="40" />
            <rect x="190" y="70" width="34" height="50" />
            <rect x="232" y="88" width="64" height="32" />
            <rect x="340" y="76" width="50" height="44" />
          </g>
          <g fill="#F6FAF4">
            <rect className="tw" x="198" y="80" width="6" height="6" />
            <rect x="210" y="80" width="6" height="6" />
            <rect x="198" y="96" width="6" height="6" />
            <rect className="tw t2" x="210" y="96" width="6" height="6" />
            <rect x="348" y="86" width="6" height="6" />
            <rect className="tw t3" x="362" y="86" width="6" height="6" />
            <rect className="tw" x="376" y="86" width="6" height="6" />
          </g>
          <g fill="#92C79E">
            <circle cx="52" cy="106" r="16" />
            <circle cx="182" cy="108" r="14" />
            <circle cx="308" cy="106" r="16" />
            <circle cx="392" cy="108" r="14" />
          </g>
          <g fill="#5FAE78">
            <circle cx="14" cy="112" r="12" />
            <circle cx="116" cy="112" r="12" />
            <circle cx="252" cy="112" r="12" />
            <circle cx="346" cy="112" r="12" />
          </g>
          <rect x="0" y="108" width="390" height="12" fill="#4F7A5C" />
          <path d="M0 114H390" stroke="#E6F2E8" strokeWidth="2" strokeDasharray="16 14" />
          <g transform="translate(0 -23)">
            <g className="bus">
              <rect x="0" y="132" width="36" height="13" rx="4" fill="#1F6B3A" />
              <rect x="4" y="135" width="6" height="5" rx="1" fill="#E3F1E6" />
              <rect x="13" y="135" width="6" height="5" rx="1" fill="#E3F1E6" />
              <rect x="22" y="135" width="6" height="5" rx="1" fill="#E3F1E6" />
              <circle cx="9" cy="146" r="3" fill="#1E2B22" />
              <circle cx="27" cy="146" r="3" fill="#1E2B22" />
            </g>
          </g>
        </svg>
      </div>
      <div style={{ flexGrow: "1", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 20px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
          <TLink className="lang" to="/voice" lang="en" onClick={pickEn} style={{ gridColumn: "1 / -1", minHeight: "58px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFFFF", border: "2px solid #C5D8C6", borderRadius: "16px", color: "#1E2B22", fontSize: "22px", fontWeight: "700", textDecoration: "none" }}>
            English
          </TLink>
          {languages.map((l, __i) => (
            <React.Fragment key={__i}>
            <TLink className="lang" to="/voice" lang={l.code} onClick={l.pick} style={{ minHeight: "58px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFFFF", border: "2px solid #C5D8C6", borderRadius: "16px", color: "#1E2B22", fontSize: "22px", fontWeight: "700", textDecoration: "none", fontStyle: "normal" }}>
              {l.name}
            </TLink>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

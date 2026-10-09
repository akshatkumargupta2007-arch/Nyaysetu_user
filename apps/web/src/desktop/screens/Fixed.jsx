import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { css } from '../lib/css.js';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import './Fixed.css';
import { api } from '../../shared/api.js';
import { store, auth } from '../../shared/store.js';
import { useGo as _useGoX } from '../components/Transition.jsx';


export default function Fixed() {
  const go = useGo();
  const listen = useScreenVoice('fixed_ask', 'Is it fixed? Tap the happy face for yes, or the sad face for no.');
  const [choice, setChoice] = useState('');
  const pick = (c, text, clip, to) => {
    if (choice) return;
    setChoice(c);
    auto(text, clip);
    const id = store.selected();
    // YES closes the complaint now. NO sends nothing yet: it opens the re-report screen, where the person says what is
    // still wrong (voice, photo or text) and only then reopens the SAME complaint.
    if (id && c === 'yes') api.confirmClosure(id, true).catch(() => {});
    setTimeout(() => go(to), 1900);
  };
  const pickYes = () => pick('yes', T("Thank you!"), 'fixed_yes', '/home');
  const pickNo = () => pick('no', 'We will look again.', 'fixed_no', '/re-report');
  const ease = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const faceBase = 'display: flex; flex-direction: column; align-items: center; gap: 28px; padding: 0; border: 0; background: transparent; font: inherit; font-size: 52px; font-weight: 700; cursor: pointer; min-width: 0; overflow: visible; transition: flex-grow 0.8s ' + ease + ', flex-basis 0.8s ' + ease + ', opacity 0.5s ' + ease + ', transform 0.8s ' + ease + ';';
  const shown = (col, scale) => faceBase + ' flex: 1 1 0; color: ' + col + '; opacity: 1; transform: scale(' + scale + ');';
  const gone = (col) => faceBase + ' flex: 0 0 0%; color: ' + col + '; opacity: 0; transform: scale(0.3); pointer-events: none; overflow: hidden;';
  const title = choice === 'yes' ? T("Thank you!") : choice === 'no' ? T("We will look again") : T("Is it fixed?");
  const rowClass = choice ? 'settled' : '';
  const rowStyle = 'display: flex; width: 100%; max-width: 1000px; gap: ' + (choice ? 0 : 96) + 'px; transition: gap 0.8s ' + ease + ';';
  const yesStyle = choice === 'no' ? gone('#1F6B3A') : shown('#1F6B3A', choice === 'yes' ? 1.25 : 1);
  const noStyle = choice === 'yes' ? gone('#A63F17') : shown('#A63F17', choice === 'no' ? 1.25 : 1);

  return (
    <div className="sc-fixed" style={{ position: "relative", isolation: "isolate", width: "100%", minHeight: "900px", boxSizing: "border-box", overflow: "hidden", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Sans Arabic',system-ui,sans-serif", fontSize: "20px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "relative", zIndex: "2", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "28px 40px 0 28px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/problems" aria-label="Go back" style={{ justifySelf: "start", width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
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
      <main style={{ flex: "1 1 auto", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "16px 40px 48px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "64px", paddingBottom: "80px" }}>
        <h1 style={{ margin: "0", fontSize: "104px", lineHeight: "1.05", fontWeight: "700", textAlign: "center" }}>
          {title}
        </h1>
        <div className={rowClass} style={css(rowStyle)} data-w="1">
          <button className="face" type="button" aria-label="Yes, it is fixed" onClick={pickYes} style={css(yesStyle)}>
            <span className="bob">
              <svg width="320" height="320" viewBox="0 0 160 160" aria-hidden="true">
                <circle cx="80" cy="80" r="76" fill="#1F6B3A" />
                <circle cx="56" cy="64" r="8" fill="#FFFFFF" />
                <circle cx="104" cy="64" r="8" fill="#FFFFFF" />
                <path d="M44 94q36 40 72 0" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" />
              </svg>
            </span>
            <span> {T("Yes")} </span>
          </button>
          <button className="face" type="button" aria-label="No, it is not fixed" onClick={pickNo} style={css(noStyle)}>
            <span className="bob b2">
              <svg width="320" height="320" viewBox="0 0 160 160" aria-hidden="true">
                <circle cx="80" cy="80" r="76" fill="#B4491F" />
                <circle cx="56" cy="64" r="8" fill="#FFFFFF" />
                <circle cx="104" cy="64" r="8" fill="#FFFFFF" />
                <path d="M46 112q34-34 68 0" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" />
              </svg>
            </span>
            <span> {T("No")} </span>
          </button>
        </div>
      </main>
    </div>
  );
}

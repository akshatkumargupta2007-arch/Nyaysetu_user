import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import './Photo.css';
import { askCamera } from '../../shared/permissions.js';

export default function Photo() {
  const go = useGo();
  const listen = useScreenVoice('photo', 'Tap the green button to take a photo.');
  useEffect(() => { askCamera(); }, []); // shows the browser's \"allow camera?\" pop-up on arrival
  const [picked, setPicked] = useState(false);
  const notPicked = !picked;
  const tileLabel = picked ? T("Photo added") : T("Open camera");
  const onPick = (e) => {
    const input = e.target;
    const f = input.files && input.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 900 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', 0.82);
        try { sessionStorage.setItem('cipher.photo', url); } catch {}
        setPicked(true);
        setTimeout(() => go('/where'), 900);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(f);
    try { input.value = ''; } catch {}
  };

  return (
    <div className="sc-photo" style={{ position: "relative", isolation: "isolate", width: "100%", minHeight: "900px", boxSizing: "border-box", overflow: "hidden", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Sans Arabic',system-ui,sans-serif", fontSize: "20px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "relative", zIndex: "2", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "28px 40px 0 28px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/home" aria-label="Go back" style={{ justifySelf: "start", width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </TLink>
        <Brand size="l" />
      </div>
        <span role="img" aria-label="Step 1 of 3" style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
          <i style={{ display: "block", width: "46px", height: "14px", borderRadius: "7px", background: "#1F6B3A" }}>
          </i>
          <i style={{ display: "block", width: "14px", height: "14px", borderRadius: "7px", background: "#C5D8C6" }}>
          </i>
          <i style={{ display: "block", width: "14px", height: "14px", borderRadius: "7px", background: "#C5D8C6" }}>
          </i>
        </span>
        <button className="pill" type="button" aria-label="Listen to this page" onClick={listen} style={{ justifySelf: "end", height: "60px", padding: "0 28px", display: "inline-flex", alignItems: "center", gap: "10px", background: "transparent", border: "2px solid #1F6B3A", borderRadius: "30px", color: "#1F6B3A", font: "inherit", fontSize: "23px", fontWeight: "700", cursor: "pointer" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
          </svg> {T("Listen")} </button>
      </header>
      <main style={{ flex: "1 1 auto", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "0 40px 40px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: "22px" }}>
        <h1 className="r1" style={{ margin: "0", fontSize: "76px", lineHeight: "1.05", fontWeight: "700", textAlign: "center" }}> {T("Take a photo")} </h1>
        <div className="r2" style={{ width: "100%", maxWidth: "1040px", flex: "1 1 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="tap big" style={{ position: "relative", flex: "1 1 auto", minHeight: "380px", boxSizing: "border-box", border: "4px dashed #1F6B3A", borderRadius: "40px", background: "#E3F1E6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "32px", cursor: "pointer" }}>
            <span style={{ position: "relative", width: "170px", height: "170px" }}>
              <span className="ring" style={{ left: "85px", top: "85px" }}>
              </span>
              <span style={{ position: "absolute", inset: "0", borderRadius: "50%", background: "#1F6B3A", boxShadow: "0 14px 34px rgba(31,107,58,0.35)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              </span>
            </span>
            <span style={{ fontSize: "40px", fontWeight: "700", color: "#1F6B3A" }}>
              {tileLabel}
            </span>
            <input className="filein" type="file" accept="image/*" capture="environment" aria-label={T("Open camera")} onChange={onPick} />
          </div>
          {notPicked && (
            <>
            <div className="tap cream enter" style={{ position: "relative", flex: "none", height: "92px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", background: "#EFF5D5", border: "3px solid #1F6B3A", borderRadius: "28px", color: "#1F6B3A", fontSize: "32px", fontWeight: "700", cursor: "pointer" }}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <circle cx="9" cy="10" r="2" />
                <path d="M21 16l-5-5-9 9" />
              </svg> {T("Gallery")} <input className="filein" type="file" accept="image/*" aria-label="Choose from gallery" onChange={onPick} />
            </div>
            </>
          )}
          {picked && (
            <>
            <TLink className="solid enter" to="/where" style={{ flex: "none", height: "92px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "28px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "32px", fontWeight: "700", textDecoration: "none" }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              OK
            </TLink>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import './Photo.css';
import { askCamera } from '../../shared/permissions.js';
import { api } from '../../shared/api.js';
import { hasAiMarker } from '../../shared/photoHints.js';

export default function Photo() {
  const go = useGo();
  const listen = useScreenVoice('photo', 'Tap the green button to take a photo.');
  useEffect(() => { askCamera(); }, []); // shows the browser's \"allow camera?\" pop-up on arrival
  const [picked, setPicked] = useState(false);
  const [checking, setChecking] = useState(false);
  const notPicked = !picked;
  const tileLabel = picked ? (checking ? T("Checking the photo...") : T("Photo added")) : T("Open camera");
  const onPick = (e) => {
    const input = e.target;
    const f = input.files && input.files[0];
    if (!f) return;
    const markerP = hasAiMarker(f); // read the ORIGINAL file's labels before it is shrunk
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
        setPicked(true);
        setChecking(true);
        // Is it a real photo? A fake is turned away here, not after the whole form. A check that cannot run never blocks.
        markerP.then((marked) => api.checkPhoto(url, marked)).then(() => true).catch((err) => err.code !== 'PHOTO_REJECTED').then((fine) => {
          setChecking(false);
          if (!fine) { try { sessionStorage.removeItem('cipher.photo'); } catch {} setPicked(false); go('/photo-rejected'); return; }
          try { sessionStorage.setItem('cipher.photo', url); } catch {}
          setTimeout(() => go('/where'), 900);
        });
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(f);
    try { input.value = ''; } catch {}
  };

  return (
    <div className="sc-photo" style={{ position: "relative", isolation: "isolate", width: "390px", height: "844px", overflow: "hidden", boxSizing: "border-box", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "19px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "14px 20px 0 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/home" aria-label="Go back" style={{ justifySelf: "start", width: "52px", height: "52px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </TLink>
        <Brand size="s" />
      </div>
        <span role="img" aria-label="Step 1 of 3" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <i style={{ display: "block", width: "28px", height: "10px", borderRadius: "5px", background: "#1F6B3A" }}>
          </i>
          <i style={{ display: "block", width: "10px", height: "10px", borderRadius: "5px", background: "#C5D8C6" }}>
          </i>
          <i style={{ display: "block", width: "10px", height: "10px", borderRadius: "5px", background: "#C5D8C6" }}>
          </i>
        </span>
        <button className="pill" type="button" aria-label="Listen to this page" onClick={listen} style={{ justifySelf: "end", height: "48px", padding: "0 14px", display: "inline-flex", alignItems: "center", gap: "6px", background: "transparent", border: "2px solid #1F6B3A", borderRadius: "24px", color: "#1F6B3A", font: "inherit", fontSize: "17px", fontWeight: "700", cursor: "pointer" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M16.500 8.500a5 5 0 0 1 0 7M19 6a8.500 8.500 0 0 1 0 12" />
          </svg> {T("Listen")} </button>
      </header>
      <main style={{ padding: "20px 20px 0", display: "flex", flexDirection: "column", gap: "20px" }}>
        <h1 style={{ margin: "0", fontSize: "40px", lineHeight: "1.1", fontWeight: "700", textAlign: "center" }}> {T("Take a photo")} </h1>
        <div className="tap big" style={{ position: "relative", height: "400px", boxSizing: "border-box", border: "3px dashed #1F6B3A", borderRadius: "28px", background: "#E3F1E6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "28px", cursor: "pointer" }}>
          <span style={{ position: "relative", width: "120px", height: "120px" }}>
            <span className="ring" style={{ left: "60px", top: "60px" }}>
            </span>
            <span style={{ position: "absolute", inset: "0", borderRadius: "50%", background: "#1F6B3A", boxShadow: "0 12px 30px rgba(31,107,58,0.35)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.500" />
              </svg>
            </span>
          </span>
          <span style={{ fontSize: "28px", fontWeight: "700", color: "#1F6B3A" }}>
            {tileLabel}
          </span>
          <input className="filein" type="file" accept="image/*" capture="environment" aria-label={T("Open camera")} onChange={onPick} />
        </div>
      </main>
      <div style={{ flexGrow: "1" }}>
      </div>
      <div style={{ padding: "0 20px 24px" }}>
        {notPicked && (
          <>
          <div className="tap cream enter" style={{ position: "relative", height: "72px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "#EFF5D5", border: "3px solid #1F6B3A", borderRadius: "22px", color: "#1F6B3A", fontSize: "26px", fontWeight: "700", cursor: "pointer" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <circle cx="9" cy="10" r="2" />
              <path d="M21 16l-5-5-9 9" />
            </svg> {T("Gallery")} <input className="filein" type="file" accept="image/*" aria-label="Choose from gallery" onChange={onPick} />
          </div>
          </>
        )}
        {picked && (
          <>
          <TLink className="solid enter" to="/where" style={{ height: "72px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "#1F6B3A", border: "3px solid #1F6B3A", borderRadius: "22px", color: "#FFFFFF", fontSize: "26px", fontWeight: "700", textDecoration: "none" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.500l4.500 4.500L19 7.500" />
            </svg>
            OK
          </TLink>
          </>
        )}
      </div>
    </div>
  );
}

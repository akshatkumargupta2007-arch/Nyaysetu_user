import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { css } from '../lib/css.js';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import mapImg from '../assets/sector6.png';
import './Where.css';
import { api, fileComplaint } from '../../shared/api.js';
import { store, auth } from '../../shared/store.js';
import { FALLBACK_COORDS } from '../../shared/config.js';
import { getLang as _gl } from '../lib/voice.js';

export default function Where() {
  const listen = useScreenVoice('where', 'Where is the problem? Tap I am here.');
  const save = (a) => { try { sessionStorage.setItem('cipher.address', a); } catch {} };
  const [address, setAddress] = useState(() => { try { return sessionStorage.getItem('cipher.address') || ''; } catch { return ''; } });
  const [listening, setListening] = useState(false);
  const [located, setLocated] = useState(false);
  const [dropping, setDropping] = useState(false);
  const addressRef = useRef(address);
  addressRef.current = address;
  const SAMPLE = 'Near Shiv Mandir, Sector 6, Bhilai';
  const onAddress = (e) => { const v = e.target.value; setAddress(v); save(v); };
  const [locMsg, setLocMsg] = useState('');
  const locate = () => {
    setLocMsg('');
    if (!navigator.geolocation) { setLocMsg(T("Location is not available. Type or say the place.")); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        store.setCoords(c);
        let a = c.lat.toFixed(4) + ', ' + c.lng.toFixed(4);
        try { const j = await api.resolveLocation(c.lat, c.lng); a = (j.label && (j.label[_gl()] || j.label.en)) || a; } catch {}
        setAddress(a); save(a); setLocated(true); setDropping(true);
        setTimeout(() => setDropping(false), 1100);
      },
      () => setLocMsg(T("Location is off. Turn it on, or type the place.")),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };
  useEffect(() => { locate(); }, []); // shows the browser's "allow location?" pop-up on arrival
  const speak = () => {
    if (listening) return;
    setListening(true);
    let done = false;
    const finish = (text) => { if (done) return; done = true; setListening(false); setAddress(text); save(text); };
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const r = new SR();
        r.lang = 'en-IN';
        r.onresult = (ev) => finish(ev.results[0][0].transcript);
        r.onerror = () => finish(addressRef.current);
        r.onend = () => finish(addressRef.current);
        r.start();
        return;
      }
    } catch {}
    finish(addressRef.current);
  };
  const speakLabel = listening ? T("Listening") : 'Speak';
  const speakBase = 'flex: none; width: 168px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: #1F6B3A; color: #FFFFFF; border: 0; border-radius: 28px; font: inherit; font-size: 28px; font-weight: 700; cursor: pointer;';
  const speakStyle = speakBase + (listening ? ' animation: where-pulse 1.2s ease-out infinite;' : '');
  const locBase = 'position: absolute; left: 24px; right: 24px; bottom: 24px; height: 92px; display: flex; align-items: center; justify-content: center; gap: 14px; border: 3px solid #1F6B3A; border-radius: 28px; font: inherit; font-size: 32px; font-weight: 700; cursor: pointer;';
  const locateStyle = locBase + (located ? ' background: #1F6B3A; color: #FFFFFF;' : ' background: #FFFFFF; color: #1F6B3A;');
  const pinStyle = dropping ? 'animation: where-dropin 0.9s cubic-bezier(0.34, 1.2, 0.64, 1) both;' : '';

  return (
    <div className="sc-where" style={{ position: "relative", isolation: "isolate", width: "100%", minHeight: "900px", boxSizing: "border-box", overflow: "hidden", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Sans Arabic',system-ui,sans-serif", fontSize: "20px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "relative", zIndex: "2", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "28px 40px 0 28px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/home" aria-label="Go back" style={{ justifySelf: "start", width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </TLink>
        <Brand size="l" />
      </div>
        <span role="img" aria-label="Step 2 of 3" style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
          <i style={{ display: "block", width: "14px", height: "14px", borderRadius: "7px", background: "#1F6B3A" }}>
          </i>
          <i style={{ display: "block", width: "46px", height: "14px", borderRadius: "7px", background: "#1F6B3A" }}>
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
      <main style={{ flex: "1 1 auto", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "16px 40px 48px", display: "flex", justifyContent: "center", gap: "36px", flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: "40px" }}>
        <div className="r1" style={{ flex: "1 1 460px", maxWidth: "560px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "28px" }}>
          <h1 style={{ margin: "0", fontSize: "76px", lineHeight: "1.08", fontWeight: "700" }}> {T("Where is it?")} </h1>
          <div style={{ display: "flex", gap: "12px", alignItems: "stretch" }}>
            <label className="field" style={{ flex: "1 1 0", minWidth: "0", height: "156px", boxSizing: "border-box", padding: "0 22px", display: "flex", alignItems: "center", background: "#FFFFFF", border: "3px solid #1F6B3A", borderRadius: "24px", boxShadow: "0 8px 24px rgba(31,107,58,0.12)", cursor: "text" }}>
              <textarea id="address" rows="1" aria-label={T("Address")} placeholder={T("Write the address")} value={address} onChange={onAddress} style={{ display: "block", width: "100%", minHeight: "1.3em", maxHeight: "4.2em", boxSizing: "border-box", margin: "0", padding: "0", resize: "none", border: "0", outline: "0", background: "transparent", font: "inherit", fontSize: "30px", lineHeight: "1.3", color: "#1E2B22", fieldSizing: "content", overflowY: "auto" }}>
              </textarea>
            {locMsg && (<p role="alert" style={{ margin: 0, textAlign: 'center', fontSize: '20px', fontWeight: 700, color: '#B4491F' }}>{locMsg}</p>)}
            </label>
            <button className="speak" type="button" aria-pressed={listening} onClick={speak} style={css(speakStyle)}>
              <svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
              {speakLabel}
            </button>
          </div>
          <TLink className="solid" to="/send" onClick={() => { if (!store.coords() && address) store.setCoords(null); }} style={{ height: "92px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "28px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "32px", fontWeight: "700", textDecoration: "none" }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            OK
          </TLink>
        </div>
        <div className="r2" style={{ flex: "2 1 600px", position: "relative", minHeight: "640px", borderRadius: "40px", overflow: "hidden", border: "2px solid #DDE6D8", background: "#E6F2E8" }}>
          <img src={mapImg} alt="Map of Sector 6, Bhilai" style={{ position: "absolute", inset: "0", display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "38% 50%" }} />
          <span className="pinshadow">
          </span>
          <svg className="pin" style={css(pinStyle)} width="64" height="82" viewBox="-28 -72 56 72" aria-hidden="true">
            <path d="M0 0c-14-16-22-24-22-36a22 22 0 0 1 44 0c0 12-8 20-22 36z" fill="#E0A526" stroke="#FFFFFF" strokeWidth="4" />
            <circle cy="-36" r="8" fill="#FFFFFF" />
          </svg>
          <button type="button" aria-pressed={located} onClick={locate} style={css(locateStyle)}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <circle cx="12" cy="12" r="9" />
              <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
            </svg> {T("I am here")} </button>
          <span style={{ position: "absolute", right: "12px", top: "10px", padding: "1px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.85)", fontSize: "13px", color: "#4A5A4F" }}>
            © OpenStreetMap
          </span>
        </div>
      </main>
    </div>
  );
}

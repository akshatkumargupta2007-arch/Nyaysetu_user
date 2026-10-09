import React, { useState, useEffect, useRef } from 'react';
import { TLink } from '../components/TLink.jsx';
import { css } from '../lib/css.js';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import { T } from '../../shared/i18n.js';
import GoogleMap from '../../shared/GoogleMap.jsx';
import { useTalk } from '../../shared/useTalk.js';
import mapImg from '../assets/sector6.png';
import { ConversationProvider } from '@elevenlabs/react';
import './Talk.css';

function TalkInner() {
  // The screen only draws. All behaviour (the voice helper, the map, the photo, filing) lives in shared/useTalk.js.
  const goTo = useGo();
  const lang = getLang();
  const { cur, prevText, finished, ask, err, label, orbClass, photoSrc, address, located, listening, pin, dropKey, setMapOn, review, locMsg,
    onAddress, pick, here, speak, okPlace, onPick, skipPhoto, sendNow, restart, end } = useTalk({ lang, go: goTo });
  const rootClass = ask ? 'has-tray' : '';
  const hasTray = !!ask;
  const askPhoto = ask === 'photo', askPlace = ask === 'place', askReview = ask === 'review';
  const curText = cur.text, hasCur = !!cur.text, hasPrev = !!prevText;
  const curColor = cur.me ? '#1F6B3A' : '#1E2B22';
  const notFinished = !finished;
  const hasPhotoSrc = !!photoSrc, noPhotoSrc = !photoSrc;
  const speakLabel = listening ? T('Listening') : T('Speak');
  const pinStyle = located ? 'animation: talk-dropin 0.9s cubic-bezier(0.34, 1.2, 0.64, 1) both;' : '';
  const locateStyle = located ? 'background: #1F6B3A; color: #FFFFFF;' : 'background: #FFFFFF; color: #1F6B3A;';
  const aiText = review.summary || '', aiDir = 'auto', aiLang = lang;
  const addrText = address || '';

  return (
    <div className={'sc-talk ' + rootClass} style={{ position: "relative", width: "100%", height: "900px", boxSizing: "border-box", overflow: "hidden", background: "radial-gradient(70% 90% at 50% 36%, #E3F1E6 0%, #F7F9F2 72%)", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari',system-ui,sans-serif", fontSize: "20px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <header style={{ width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "28px 40px 0 28px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
        <TLink className="plain" to="/home" aria-label={T("Go back")} style={{ justifySelf: "start", width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </TLink>
        <span>
        </span>
        <span>
        </span>
      </header>
      <main style={{ flex: "1 1 auto", minHeight: "0", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "center", gap: "64px" }}>
        <section className="talkleft" style={{ flex: "0 1 900px", minWidth: "0", display: "flex", flexDirection: "column", alignItems: "center", gap: "22px" }}>
          <div className={`r1 orbbox ${orbClass}`} style={{ "--O": "400px" }}>
            <button className="orbwrap" type="button" aria-label={T("Talk to the AI. Tap to start again")} onClick={restart}>
              <span className="halo">
              </span>
              <span className="halo h2">
              </span>
              <span className="core">
                <i>
                </i>
                <i>
                </i>
                <i>
                </i>
                <i>
                </i>
                <i>
                </i>
              </span>
            </button>
          </div>
          <h1 className="r1" style={{ margin: "0", fontSize: "72px", lineHeight: "1.05", fontWeight: "700", textAlign: "center" }}>
            {label}
          </h1>
        {err && (<p role="alert" style={{ margin: 0, textAlign: 'center', fontSize: '24px', fontWeight: 700, color: '#B4491F' }}>{err}</p>)}
          <div className="r2" style={{ width: "100%", minHeight: "150px" }}>
            <div aria-live="polite" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", textAlign: "center" }}>
              {hasPrev && (
                <>
                <p className="prevline" style={{ margin: "0", maxWidth: "92%", fontSize: "30px", lineHeight: "1.3", color: "#7A8A7E" }}>
                  {prevText}
                </p>
                </>
              )}
              {hasCur && (
                <>
                <p className="cap" style={css(`margin: 0; max-width: 96%; font-size: 52px; font-weight: 700; line-height: 1.22; color: ${curColor};`)}>
                  {curText}
                </p>
                </>
              )}
            </div>
          </div>
        </section>
        <section className="talkright" style={{ flex: "0 0 0px", minWidth: "0", overflow: "hidden", opacity: "0", transform: "translateX(40px)" }}>
          <div style={{ width: "720px", maxWidth: "100%" }}>
            <div className="tray" style={{ width: "100%", boxSizing: "border-box", padding: "30px", background: "#FFFFFF", border: "2px solid #DDE6D8", borderRadius: "36px", boxShadow: "0 18px 44px rgba(31,107,58,0.16)" }}>
              {askPhoto && (
                <>
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div style={{ position: "relative", height: "250px", boxSizing: "border-box", border: "3px dashed #1F6B3A", borderRadius: "32px", background: "#E3F1E6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", cursor: "pointer", color: "#1F6B3A", fontSize: "34px", fontWeight: "700" }}>
                    <span style={{ width: "96px", height: "96px", borderRadius: "50%", background: "#1F6B3A", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                        <circle cx="12" cy="13" r="3.5" />
                      </svg>
                    </span>
                    {T("Photo")}
                    <input className="filein" type="file" accept="image/*" capture="environment" aria-label={T("Open camera")} onChange={onPick} />
                  </div>
                  <div style={{ position: "relative", height: "110px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "28px", background: "#EFF5D5", color: "#1F6B3A", border: "3px solid #1F6B3A", font: "inherit", fontSize: "34px", fontWeight: "700", textDecoration: "none", cursor: "pointer", width: "100%" }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="16" rx="3" />
                      <circle cx="9" cy="10" r="2" />
                      <path d="M21 16l-5-5-9 9" />
                    </svg>
                    {' '}{T("Gallery")}
                    <input className="filein" type="file" accept="image/*" aria-label={T("Choose from gallery")} onChange={onPick} />
                  </div>
                </div>
                </>
              )}
              {askPhoto && (<button type="button" onClick={skipPhoto} style={{ marginTop: "10px", width: "100%", height: "60px", borderRadius: "18px", border: "3px solid #DDE6D8", background: "#FFFFFF", color: "#1F6B3A", font: "inherit", fontSize: "22px", fontWeight: "700", cursor: "pointer" }}>{T("Skip")}</button>)}
              {askPlace && (
                <>
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div style={{ display: "flex", gap: "18px", alignItems: "stretch" }}>
                    <label style={{ flex: "1 1 0", minWidth: "0", height: "84px", boxSizing: "border-box", padding: "0 18px", display: "flex", alignItems: "center", background: "#FFFFFF", border: "3px solid #1F6B3A", borderRadius: "24px" }}>
                      <textarea rows="1" aria-label={T("Address")} placeholder={T("Write the address")} value={address} onChange={onAddress} style={{ display: "block", width: "100%", margin: "0", padding: "0", resize: "none", border: "0", outline: "0", background: "transparent", font: "inherit", fontSize: "30px", lineHeight: "1.3", color: "#1E2B22", fieldSizing: "content", maxHeight: "2.7em", overflowY: "auto" }}>
                      </textarea>
                    </label>
                    <button type="button" onClick={speak} style={{ flex: "none", width: "150px", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", background: "#1F6B3A", color: "#FFFFFF", border: "0", borderRadius: "24px", font: "inherit", fontSize: "24px", fontWeight: "700", cursor: "pointer" }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="9" y="3" width="6" height="11" rx="3" />
                        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                      </svg>
                      {speakLabel}
                    </button>
                  </div>
                  <div style={{ position: "relative", height: "300px", borderRadius: "32px", overflow: "hidden", border: "2px solid #DDE6D8", background: "#E6F2E8" }}>
                  <GoogleMap pin={pin} draggable onPick={pick} dropKey={dropKey} lang={lang} label={T("Map")} onStatus={(x) => setMapOn(x === 'ready')}
                    fallback={<>
                    <img src={mapImg} alt="Map of Sector 6, Bhilai" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover", objectPosition: "38% 50%" }} />
                    <svg style={css(`position: absolute; left: 50%; top: 46%; transform: translate(-50%, -100%); ${pinStyle}`)} width="54" height="70" viewBox="-28 -72 56 72" aria-hidden="true">
                      <path d="M0 0c-14-16-22-24-22-36a22 22 0 0 1 44 0c0 12-8 20-22 36z" fill="#E0A526" stroke="#FFFFFF" strokeWidth="4" />
                      <circle cy="-36" r="8" fill="#FFFFFF" />
                    </svg>
                  </>} />
                    <button type="button" onClick={here} style={css(`position: absolute; left: 12px; right: 12px; bottom: 12px; height: 72px; display: flex; align-items: center; justify-content: center; gap: 10px; border: 3px solid #1F6B3A; border-radius: 22px; font: inherit; font-size: 28px; font-weight: 700; cursor: pointer; ${locateStyle}`)}>
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="4" />
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
                      </svg>
                      {' '}{T("I am here")}
                    </button>
                  </div>
                  {locMsg && (<p role="alert" style={{ margin: 0, textAlign: "center", fontSize: "20px", fontWeight: 700, color: "#B4491F" }}>{locMsg}</p>)}
                  <button className="solid" type="button" onClick={okPlace} style={{ width: "100%", height: "110px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "28px", background: "#1F6B3A", color: "#FFFFFF", border: "0", font: "inherit", fontSize: "34px", fontWeight: "700", textDecoration: "none", cursor: "pointer" }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                    {' '}{T("OK")}
                  </button>
                </div>
                </>
              )}
              {askReview && (
                <>
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "18px" }}>
                  <div style={{ position: "relative", height: "190px", borderRadius: "32px", overflow: "hidden", border: "3px solid #DDE6D8", background: "#BFD9C5" }}>
                    {hasPhotoSrc && (
                      <>
                      <img src={photoSrc} alt={T("Your photo")} style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover" }} />
                      </>
                    )}
                    {noPhotoSrc && (
                      <>
                      <div style={{ position: "absolute", inset: "0" }}>
                        <svg viewBox="0 0 350 220" preserveAspectRatio="xMidYMid slice" style={{ display: "block", width: "100%", height: "100%" }} aria-hidden="true">
                          <rect width="350" height="220" fill="#BFD9C5" />
                          <circle cx="288" cy="40" r="22" fill="#F5E3B5" />
                          <g fill="#8DB596">
                            <rect x="0" y="90" width="70" height="100" />
                            <rect x="250" y="80" width="60" height="110" />
                          </g>
                          <g fill="#6C9A78">
                            <rect x="20" y="124" width="86" height="70" />
                            <polygon points="14,124 63,90 112,124" />
                            <rect x="236" y="130" width="84" height="64" />
                            <polygon points="230,130 278,96 326,130" />
                          </g>
                          <rect x="0" y="176" width="350" height="44" fill="#4B6B55" />
                          <rect x="165" y="30" width="12" height="150" fill="#38523F" />
                          <path d="M171 34q-2-26 38-26" fill="none" stroke="#38523F" strokeWidth="10" strokeLinecap="round" />
                          <path d="M194 4h30l-5 14h-20z" fill="#9AA6A4" />
                        </svg>
                      </div>
                      </>
                    )}
                  </div>
                  <div dir={aiDir} style={{ display: "flex", alignItems: "center", gap: "14px", boxSizing: "border-box", padding: "14px 18px", background: "#FFFFFF", border: "3px solid #DDE6D8", borderRadius: "24px", borderColor: "#1F6B3A" }}>
                    <span style={{ flex: "none", width: "56px", height: "56px", borderRadius: "16px", background: "#EFF5D5", display: "inline-flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-start" }}>
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
                        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
                      </svg>
                    </span>
                    <span lang={aiLang} style={{ flex: "1 1 0", minWidth: "0", fontSize: "30px", fontWeight: "700", lineHeight: "1.3" }}>
                      {aiText}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", boxSizing: "border-box", padding: "14px 18px", background: "#FFFFFF", border: "3px solid #DDE6D8", borderRadius: "24px" }}>
                    <span style={{ flex: "none", width: "56px", height: "56px", borderRadius: "16px", background: "#EFF5D5", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
                        <circle cx="12" cy="9.5" r="2.5" />
                      </svg>
                    </span>
                    <span style={{ fontSize: "28px", fontWeight: "700", minWidth: "0" }}>
                      {addrText}
                    </span>
                  </div>
                  <button type="button" onClick={sendNow} className="solid" style={{ height: "110px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "28px", background: "#1F6B3A", color: "#FFFFFF", border: "0", font: "inherit", fontSize: "34px", fontWeight: "700", textDecoration: "none", cursor: "pointer" }}>
                    {T("Send")}{' '}
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
                    </svg>
                  </button>
                </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
      <div style={{ width: "100%", maxWidth: "520px", margin: "0 auto", boxSizing: "border-box", padding: "0 0 40px" }}>
        {notFinished && (
          <>
          <TLink className="solid end" to="/home" onClick={end} style={{ width: "100%", height: "96px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "30px", color: "#FFFFFF", fontSize: "34px", fontWeight: "700", textDecoration: "none", background: "#B4491F" }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
              <path d="M3 21L21 3" />
            </svg>
            {' '}{T("End")}
          </TLink>
          </>
        )}
        {finished && (
          <>
          <TLink className="solid" to="/sent" style={{ width: "100%", height: "96px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", borderRadius: "30px", color: "#FFFFFF", fontSize: "34px", fontWeight: "700", textDecoration: "none", background: "#1F6B3A" }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            {' '}{T("Done")}
          </TLink>
          </>
        )}
      </div>
    </div>
  );
}

export default function Talk() {
  return (
    <ConversationProvider>
      <TalkInner />
    </ConversationProvider>
  );
}

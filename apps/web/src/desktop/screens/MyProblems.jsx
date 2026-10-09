import React, { useState, useEffect, useRef } from 'react';
import Brand from '../../shared/Brand.jsx';
import { T } from '../../shared/i18n.js';
import { TLink } from '../components/TLink.jsx';
import { css } from '../lib/css.js';
import { say, auto, stopVoice, useScreenVoice, setLang, setVoiceOn, isVoiceOn, getLang } from '../lib/voice.js';
import { useGo } from '../components/Transition.jsx';
import './MyProblems.css';
import { api } from '../../shared/api.js';
import { useMeStream } from '../../shared/meStream.js';
import { store, auth } from '../../shared/store.js';
import { useGo as _useGoX } from '../components/Transition.jsx';


export default function MyProblems() {
  const listen = useScreenVoice('my_problems', 'These are your problems. Tap Waiting, Fixed or Needs fix.');
  const [tab, setTab] = useState(0);
  const G = '#1F6B3A', B = '#4F7A5C', A = '#C28B0C', R = '#B4491F';
  const mk = (kind, title, place, when, status, href) => ({
    isLight: kind === 'light', isBin: kind === 'bin', isWater: kind === 'water', isRoad: kind === 'road',
    title, place, when, href,
    sTruck: status === 'truck', sFix: status === 'fix', sWait: status === 'wait', sFlag: status === 'flag', sFixed: status === 'done',
    bg: status === 'done' ? G : status === 'flag' ? R : status === 'wait' ? A : B,
    label: status === 'done' ? T("Fixed") : status === 'flag' ? T("Needs a fix") : status === 'wait' ? T("Waiting") : status === 'truck' ? T("Team on the way") : T("Being fixed"),
    cls: status === 'truck' || status === 'flag' ? 'live' : '',
  });
  const goX = _useGoX();
  const [reports, setReports] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!auth.isLoggedIn()) { goX('/phone'); return; }
    api.myReports().then((r) => { setReports(r); setLoaded(true); }).catch((e) => { if (e.status === 401) goX('/phone'); else setLoaded(true); });
  }, []);
  // Live: an official's "please verify" (or any status change) shows up here without refreshing the page.
  useMeStream(() => { api.myReports().then(setReports).catch(() => {}); });
  const L = getLang() === 'hi' ? 'hi' : 'en';
  const toItem = (r) => {
    const kind = r.l1 === 'STREETLIGHTS' ? 'light' : r.l1 === 'SOLID_WASTE' ? 'bin' : r.l1 === 'WATER_SUPPLY' ? 'water' : 'road';
    const st = r.state;
    const done_ = st === 'WORK_DONE_PENDING_CONFIRMATION' || st.startsWith('CLOSED');
    const status = st === 'DISPATCHED' ? 'truck' : st === 'REOPENED' ? 'flag' : done_ ? 'done' : (st === 'ASSIGNED' || st === 'TRANSFERRED') ? 'fix' : 'wait';
    const href = st === 'WORK_DONE_PENDING_CONFIRMATION' ? '/fixed' : st === 'REOPENED' ? '/needs-fix' : '/status';
    const title = (r.categoryNames && r.categoryNames[L]) || r.summary;
    const place = (r.place && r.place[L]) || '';
    const when = new Date(r.createdAt).toLocaleString(L === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    return { ...mk(kind, title, place, when, status, href), ticketId: r.ticketId, code: r.ticketCode, group: st === 'REOPENED' ? 'flag' : done_ ? 'done' : 'wait', pending: r.pending_close_request || null };
  };
  const all = reports.map(toItem);
  const pending = all.filter((i) => i.group === 'wait');
  const done = all.filter((i) => i.group === 'done');
  const flagged = all.filter((i) => i.group === 'flag');
  const ease = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const base = 'position: relative; z-index: 1; flex: 1 1 0; min-width: 0; height: 76px; border: 0; border-radius: 999px; background: transparent; font: inherit; font-size: 28px; font-weight: 700; cursor: pointer;';
  const col = (i) => ' color: ' + (tab === i ? '#FFFFFF' : '#1F6B3A') + ';';
  const pane = (on) =>
    'flex: 0 0 33.3333%; box-sizing: border-box; transform-origin: center top; ' +
    'opacity: ' + (on ? 1 : 0) + '; transform: scale(' + (on ? 1 : 0.94) + '); ' +
    'visibility: ' + (on ? 'visible' : 'hidden') + '; ' +
    'transition: opacity 0.5s ' + ease + ', transform 0.6s ' + ease + ', visibility 0s linear ' + (on ? '0s' : '0.6s') + ';';
  const panes = [
    { items: pending, style: pane(tab === 0) },
    { items: done, style: pane(tab === 1) },
    { items: flagged, style: pane(tab === 2) },
  ];
  const isPending = tab === 0, isDone = tab === 1, isFlagged = tab === 2;
  const pendingCount = pending.length, doneCount = done.length, flaggedCount = flagged.length;
  const indicatorStyle = 'position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc((100% - 8px) / 3); border-radius: 999px; background: #1F6B3A; box-shadow: 0 4px 14px rgba(31,107,58,0.3); transform: translateX(' + tab * 100 + '%); transition: transform 0.6s ' + ease + ';';
  const tabPendingStyle = base + col(0);
  const tabDoneStyle = base + col(1);
  const tabFlaggedStyle = base + col(2);
  const trackStyle = 'display: flex; width: 300%; transform: translateX(' + -tab * 33.3333 + '%); transition: transform 0.6s ' + ease + ';';
  const showPending = () => setTab(0);
  const showDone = () => setTab(1);
  const showFlagged = () => setTab(2);

  return (
    <div className="sc-problems" style={{ position: "relative", isolation: "isolate", width: "100%", minHeight: "900px", boxSizing: "border-box", overflow: "hidden", background: "#F7F9F2", color: "#1E2B22", fontFamily: "'Atkinson Hyperlegible','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Gujarati','Noto Sans Kannada','Noto Sans Malayalam','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Gurmukhi','Noto Sans Oriya','Noto Sans Arabic',system-ui,sans-serif", fontSize: "20px", lineHeight: "1.35", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "relative", zIndex: "2", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "28px 40px 0 28px", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "12px", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifySelf: "start", minWidth: 0 }}>
        <TLink className="plain" to="/home" aria-label="Go back" style={{ justifySelf: "start", width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </TLink>
        <Brand size="l" />
      </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <h1 style={{ margin: "0", fontSize: "46px", lineHeight: "1.1", fontWeight: "700", color: "#1F6B3A" }}> {T("My problems")} </h1>
        </div>
        <button className="pill" type="button" aria-label="Listen to this page" onClick={listen} style={{ justifySelf: "end", height: "60px", padding: "0 28px", display: "inline-flex", alignItems: "center", gap: "10px", background: "transparent", border: "2px solid #1F6B3A", borderRadius: "30px", color: "#1F6B3A", font: "inherit", fontSize: "23px", fontWeight: "700", cursor: "pointer" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
          </svg> {T("Listen")} </button>
      </header>
      <main style={{ flex: "1 1 auto", width: "100%", maxWidth: "1360px", margin: "0 auto", boxSizing: "border-box", padding: "24px 40px 32px", display: "flex", flexDirection: "column", gap: "28px" }}>
        {all.some((i) => i.pending) && (() => {
          const p = all.find((i) => i.pending);
          return (
            <TLink className="verify-top" to="/fixed" onClick={() => store.setSelected(p.ticketId, p.code)} style={{ display: "block", padding: "14px 16px", borderRadius: "22px", background: "#FFF3D6", border: "3px solid #C28B0C", color: "#5A3E00", textDecoration: "none" }}>
              <span style={{ display: "block", fontSize: "20px", fontWeight: "700", lineHeight: "1.3" }}>{T("An official says the work is done. Please verify.")}</span>
              <span style={{ display: "block", marginTop: "2px", fontSize: "16px" }}>{p.code}</span>
              {p.pending.note && <span style={{ display: "block", marginTop: "4px", fontSize: "16px", fontStyle: "italic" }}>“{p.pending.note}”</span>}
              <span style={{ display: "inline-block", marginTop: "10px", padding: "10px 24px", borderRadius: "999px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "20px", fontWeight: "700" }}>{T("Verify resolution")}</span>
            </TLink>
          );
        })()}
        <div role="group" aria-label="Filter" className="r1" style={{ position: "relative", alignSelf: "center", width: "100%", maxWidth: "860px", display: "flex", padding: "5px", background: "#E3F1E6", borderRadius: "999px" }}>
          <span aria-hidden="true" style={css(indicatorStyle)}>
          </span>
          <button type="button" aria-pressed={isPending} onClick={showPending} style={css(tabPendingStyle)}>
            {T("Waiting")} {pendingCount}
          </button>
          <button type="button" aria-pressed={isDone} onClick={showDone} style={css(tabDoneStyle)}>
            {T("Fixed")} {doneCount}
          </button>
          <button type="button" aria-pressed={isFlagged} onClick={showFlagged} style={css(tabFlaggedStyle)}>
            {T("Needs fix")} {flaggedCount}
          </button>
        </div>
        <div className="r2" style={{ overflow: "hidden", margin: "0 -40px", padding: "10px 40px 16px" }}>
          <div style={css(trackStyle)}>
            {panes.map((p, __i) => (
              <React.Fragment key={__i}>
              <div style={css(p.style)}>
                <ul style={{ listStyle: "none", margin: "0", padding: "0", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "22px" }}>
                  {p.items.map((c, __i) => (
                    <React.Fragment key={__i}>
                    <li>
                      <TLink className="card" to={c.href} onClick={() => store.setSelected(c.ticketId, c.code)} style={{ display: "flex", alignItems: "center", gap: "20px", boxSizing: "border-box", minHeight: "172px", padding: "22px 28px", background: "#FFFFFF", border: "2px solid #DDE6D8", borderRadius: "32px", color: "#1E2B22", textDecoration: "none" }}>
                        <span style={{ flex: "none", width: "72px", height: "72px", borderRadius: "22px", background: "#EFF5D5", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          {c.isLight && (
                            <>
                            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.7.6 1 1.3 1 2.1h5c0-.8.3-1.5 1-2.1A6 6 0 0 0 12 3z" />
                            </svg>
                            </>
                          )}
                          {c.isBin && (
                            <>
                            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                            </svg>
                            </>
                          )}
                          {c.isWater && (
                            <>
                            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
                            </svg>
                            </>
                          )}
                          {c.isRoad && (
                            <>
                            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1F6B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M8 3L4 21M16 3l4 18M12 5v3M12 11v3M12 17v3" />
                            </svg>
                            </>
                          )}
                        </span>
                        <span style={{ flexGrow: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "38px", fontWeight: "700" }}>
                            {c.title}
                          </span>
                          <span style={{ fontSize: "26px", color: "#4A5A4F" }}>
                            {c.place}
                          </span>
                          <span style={{ fontSize: "26px", color: "#4A5A4F" }}>
                            {c.when}
                          </span>
                        </span>
                        <span role="img" aria-label={c.label} className={c.cls} style={css(`flex: none; width: 84px; height: 84px; border-radius: 50%; background: ${c.bg}; display: inline-flex; align-items: center; justify-content: center;`)}>
                          {c.sFixed && (
                            <>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 12.5l4.5 4.5L19 7.5" />
                            </svg>
                            </>
                          )}
                          {c.sTruck && (
                            <>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M2 6h11v10H2zM13 9h4l4 4v3h-8" />
                              <circle cx="7" cy="17.5" r="1.5" />
                              <circle cx="17" cy="17.5" r="1.5" />
                            </svg>
                            </>
                          )}
                          {c.sFix && (
                            <>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M14.5 6.5a4 4 0 0 0-5 5L3 18l3 3 6.5-6.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z" />
                            </svg>
                            </>
                          )}
                          {c.sWait && (
                            <>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="9" />
                              <path d="M12 7v5l3 2" />
                            </svg>
                            </>
                          )}
                          {c.sFlag && (
                            <>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 21V4M5 4h12l-2.5 4L17 12H5" />
                            </svg>
                            </>
                          )}
                        </span>
                      </TLink>
                    {c.pending && (
                      <TLink className="verify" to="/fixed" onClick={() => store.setSelected(c.ticketId, c.code)} style={{ display: "block", marginTop: "8px", padding: "12px 14px", borderRadius: "18px", background: "#FFF3D6", border: "3px solid #C28B0C", color: "#5A3E00", textDecoration: "none" }}>
                        <span style={{ display: "block", fontSize: "18px", fontWeight: "700", lineHeight: "1.3" }}>{T("An official says the work is done. Please verify.")}</span>
                        {c.pending.note && <span style={{ display: "block", marginTop: "4px", fontSize: "16px", fontStyle: "italic" }}>“{c.pending.note}”</span>}
                        <span style={{ display: "inline-block", marginTop: "10px", padding: "10px 22px", borderRadius: "999px", background: "#1F6B3A", color: "#FFFFFF", fontSize: "19px", fontWeight: "700" }}>{T("Verify resolution")}</span>
                      </TLink>
                    )}
                    </li>
                    </React.Fragment>
                  ))}
                </ul>
              </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </main>
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
  );
}

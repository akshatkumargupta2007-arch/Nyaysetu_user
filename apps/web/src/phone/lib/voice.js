import { useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// AI voice
//  - The person chooses On/Off on the "AI voice" screen (stored for the visit).
//  - With voice On, every screen reads itself aloud when it opens (auto).
//  - The "Listen" button always replays the screen (say), even with voice Off.
//
// Today the voice is the browser's built-in speech. To use ElevenLabs, put the
// pre-generated clips in  public/audio/<lang>/<clipId>.mp3  (see docs/voice-scripts.csv).
// If a clip exists it is played, otherwise it falls back to browser speech.
// ---------------------------------------------------------------------------

const KEY_VOICE = 'cipher.voice';
const KEY_LANG = 'cipher.lang';

export function getLang() {
  try {
    return localStorage.getItem(KEY_LANG) || 'en';
  } catch {
    return 'en';
  }
}
export function setLang(code) {
  try {
    localStorage.setItem(KEY_LANG, code);
  } catch {}
}
export function setVoiceOn(on) {
  try {
    sessionStorage.setItem(KEY_VOICE, on ? 'on' : 'off');
  } catch {}
}
export function isVoiceOn() {
  try {
    return sessionStorage.getItem(KEY_VOICE) !== 'off';
  } catch {
    return true;
  }
}

// One shared <audio> element plays every clip. Phones only allow sound from an element that a tap has
// started, so the first tap anywhere "unlocks" this one and every later clip (even ones that start on
// their own when a screen opens) reuses it.
let player = null;
let currentSeq = null; // token of the clip / sequence that is allowed to carry on
let pendingReplay = null; // what to play on the next tap when the browser blocked automatic sound
let gesturesArmed = false;
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

function getPlayer() {
  if (!player) {
    player = new Audio();
    player.preload = 'auto';
  }
  return player;
}

// Any real tap / click / key press counts. (A touch only counts when the finger lifts, so listening for
// pointerdown alone is not enough on phones.) The listeners stay for the whole visit, so a blocked clip
// is retried on the next tap instead of being dropped.
function onGesture() {
  const f = pendingReplay;
  pendingReplay = null;
  if (f) { f(); return; }
  if (!currentSeq) {
    try {
      const p = getPlayer();
      p.onended = null;
      p.onerror = null;
      p.src = SILENT;
      const r = p.play();
      if (r && r.catch) r.catch(() => {});
    } catch {}
  }
}
function armGestures() {
  if (gesturesArmed || typeof window === 'undefined') return;
  gesturesArmed = true;
  for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, onGesture, true);
}
armGestures();

export function stopVoice() {
  currentSeq = null;
  pendingReplay = null;
  try {
    if (player) player.pause();
    window.speechSynthesis && window.speechSynthesis.cancel();
  } catch {}
}

function speakWithBrowser(text) {
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN'; // text is English until the translations are added
    u.rate = 0.9;
    s.speak(u);
  } catch {}
}

// Plays /audio/<lang>/<clipId>.mp3 when it exists. The built-in browser voice is English only, so it is
// used as a fallback ONLY when the language is English; in any other language a missing clip stays silent
// instead of speaking English over the person's language. If the browser blocks automatic sound, the clip
// plays on the next tap.
export function say(text, clipId) {
  stopVoice();
  const lang = getLang();
  const token = {};
  currentSeq = token;
  let fellBack = false;
  const fallback = () => {
    if (fellBack || currentSeq !== token) return;
    fellBack = true;
    if (lang === 'en') speakWithBrowser(text);
  };
  if (!clipId) { fallback(); return; }
  try {
    const p = getPlayer();
    p.onended = null;
    p.onerror = fallback;
    // A clip id starting with "/" is a fixed file that does not depend on the chosen language.
    p.src = clipId.startsWith('/') ? clipId : `/audio/${lang}/${clipId}.mp3`;
    const r = p.play();
    if (r && r.catch) {
      r.catch((e) => {
        if (currentSeq !== token) return; // a newer screen took over
        if (e && e.name === 'NotAllowedError') pendingReplay = () => say(text, clipId);
        else if (e && e.name !== 'AbortError') fallback();
      });
    }
  } catch {
    fallback();
  }
}

// Like say(), but only when AI voice is switched on.
export function auto(text, clipId) {
  if (isVoiceOn()) say(text, clipId);
}

// Reads the screen when it opens (if voice is on) and returns the "Listen" handler.
export function useScreenVoice(clipId, text) {
  useEffect(() => {
    auto(text, clipId);
    return () => stopVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return useCallback(() => say(text, clipId), [clipId, text]);
}

// Reads a ticket number aloud by chaining small clips: <introClip>, then digit_N / letter_X / dash for each
// character of the code. Missing clips are skipped; in English a missing intro falls back to browser speech.
export function sayCode(introClip, code, text) {
  stopVoice();
  const lang = getLang();
  const ids = [introClip];
  for (const ch of code || '') {
    if (/\d/.test(ch)) ids.push('digit_' + ch);
    else if (/[A-Za-z]/.test(ch)) ids.push('letter_' + ch.toUpperCase());
    else if (ch === '-') ids.push('dash');
  }
  const token = {};
  currentSeq = token;
  const p = getPlayer();
  let i = 0;
  const next = () => {
    if (currentSeq !== token || i >= ids.length) return;
    const idx = i++;
    let moved = false;
    const advance = () => { if (moved || currentSeq !== token) return; moved = true; next(); };
    p.onended = advance;
    p.onerror = () => {
      if (moved || currentSeq !== token) return;
      if (idx === 0) { moved = true; if (lang === 'en') { currentSeq = null; speakWithBrowser(text); } return; }
      advance();
    };
    p.src = `/audio/${lang}/${ids[idx]}.mp3`;
    const r = p.play();
    if (r && r.catch) {
      r.catch((e) => {
        if (currentSeq !== token) return;
        if (e && e.name === 'NotAllowedError') { moved = true; i = 0; pendingReplay = () => sayCode(introClip, code, text); }
      });
    }
  };
  next();
}

export function useCodeVoice(introClip, code, text) {
  useEffect(() => {
    if (isVoiceOn()) sayCode(introClip, code, text);
    return () => stopVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

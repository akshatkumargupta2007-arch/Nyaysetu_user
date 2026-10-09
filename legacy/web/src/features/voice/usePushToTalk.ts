// Build map #D4 — Push-to-talk voice capture.
//
// Design decisions:
//  • Audio context unlock MUST happen synchronously in the pointerdown
//    handler (same user gesture). Everything else can be async.
//  • We use a ref-based state machine alongside React state so the async
//    MediaRecorder callbacks always see the latest values without stale
//    closures — a common source of subtle bugs on iOS Safari.
//  • MIME type priority: webm/opus (Chrome/Firefox) → mp4 (Safari 17+) →
//    aac (older Safari) → webm fallback. We store the chosen type on the
//    MediaRecorder instance so the stop handler can build the right Blob.
//  • The shared AudioContext + silent-buffer unlock is a well-known trick
//    to satisfy iOS's "audio must be initiated by a user gesture" policy so
//    TTS can auto-play later without an extra tap (#G2).
//  • 500 ms watchdog: on iOS, MediaRecorder sometimes fires no ondataavailable
//    events at all. If nothing arrives in 500 ms we surface a soft error and
//    fall back to typing.
//  • 30 s hard cap: prevents runaway recordings from inflating STT costs.
//  • navigator.vibrate(15): haptic tick on start and stop. Wrapped in a
//    try/catch because Safari does not implement the Vibration API.

import { authHeaders } from "../auth/token.js";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── types ────────────────────────────────────────────────────────────────────

export type RecordingState = "idle" | "recording" | "transcribing" | "error";

export interface UsePushToTalkOptions {
  /** Full API base URL, e.g. http://localhost:8080 */
  apiUrl: string;
  /** Active language (sent to the STT endpoint so the model is biased correctly) */
  lang: string;
  /** Called with the transcript text on success */
  onTranscript: (text: string) => void;
  /** Called with a user-visible error string */
  onError: (message: string) => void;
}

export interface UsePushToTalkReturn {
  state: RecordingState;
  /** Attach to the mic button's onPointerDown */
  onPointerDown: () => void;
  /** Attach to the mic button's onPointerUp and onPointerLeave */
  onPointerUp: () => void;
}

// ─── shared audio context (singleton) ────────────────────────────────────────

let _audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!_audioCtx) _audioCtx = new AudioContext();
    return _audioCtx;
  } catch {
    return null;
  }
}

/**
 * Unlock the AudioContext so TTS can auto-play later without an extra tap.
 * Must be called synchronously inside a user-gesture handler.
 */
function unlockAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    // Resume suspended context (Chrome suspends on creation)
    void ctx.resume();
    // Play a one-frame silent buffer — iOS Safari requires actual audio
    // output inside the gesture before it will allow auto-play later.
    const buf = ctx.createBuffer(1, 1, 22_050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // Non-fatal — if this fails TTS will still work in most browsers;
    // only iOS Safari requires it.
  }
}

// ─── utilities ────────────────────────────────────────────────────────────────

/** Priority-ordered MIME types; returns the first one the browser supports. */
function chooseMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus", // Chrome, Firefox, Edge
    "audio/mp4",              // Safari 17+
    "audio/aac",              // older Safari
    "audio/webm",             // fallback
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

/** Extension matching the chosen MIME type (for the filename sent to the API). */
function mimeToExtension(mime: string): string {
  if (mime.startsWith("audio/mp4")) return "m4a";
  if (mime.startsWith("audio/aac")) return "aac";
  return "webm";
}

/** Fire-and-forget haptic tick. */
function vibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Safari throws; ignore.
  }
}

// ─── hook ─────────────────────────────────────────────────────────────────────

const MIN_DURATION_MS = 800;
const MAX_DURATION_MS = 30_000;
const WATCHDOG_MS     = 500;

export function usePushToTalk({
  apiUrl,
  lang,
  onTranscript,
  onError,
}: UsePushToTalkOptions): UsePushToTalkReturn {
  const [state, setState]     = useState<RecordingState>("idle");

  // Refs so async callbacks never see stale closures
  const stateRef              = useRef<RecordingState>("idle");
  const recorderRef           = useRef<MediaRecorder | null>(null);
  const streamRef             = useRef<MediaStream | null>(null);
  const chunksRef             = useRef<Blob[]>([]);
  const startTimeRef          = useRef<number>(0);
  const mimeTypeRef           = useRef<string>("");
  const maxTimerRef           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep stateRef in sync with state
  const setStateBoth = useCallback((s: RecordingState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  // ── cleanup ──────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => cleanup, [cleanup]); // cleanup on unmount

  // ── stop + transcribe ────────────────────────────────────────────────────

  /**
   * Called when MediaRecorder fires `onstop` (after all chunks are flushed).
   * At this point chunks are complete and we can build the final Blob.
   */
  const handleStop = useCallback(async () => {
    const duration = Date.now() - startTimeRef.current;
    const chunks   = chunksRef.current.slice(); // snapshot before cleanup
    const mime     = mimeTypeRef.current;

    cleanup();
    vibrate(15);

    if (duration < MIN_DURATION_MS || chunks.length === 0) {
      // Too short — not an error, just return to idle
      setStateBoth("idle");
      return;
    }

    setStateBoth("transcribing");

    const blob = new Blob(chunks, { type: mime });
    const form = new FormData();
    form.append("audio", blob, `recording.${mimeToExtension(mime)}`);
    form.append("lang", lang);

    try {
      const res = await fetch(`${apiUrl}/voice/transcribe`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });

      if (!res.ok) {
        // Surface a soft error — don't crash the form
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
      }

      const data = await res.json() as { text: string };
      if (typeof data.text !== "string" || !data.text.trim()) {
        throw new Error("Empty transcript received");
      }

      onTranscript(data.text.trim());
      setStateBoth("idle");
    } catch (err) {
      console.error("[usePushToTalk] transcribe error", err);
      onError("home.mic.error"); // caller maps this i18n key
      setStateBoth("error");
      // Recover to idle after a beat so the user can try again
      setTimeout(() => setStateBoth("idle"), 2000);
    }
  }, [apiUrl, lang, cleanup, onTranscript, onError, setStateBoth]);

  // ── start recording (async part — called from pointerdown) ───────────────

  const startRecordingAsync = useCallback(async () => {
    // Guard: only start from idle
    if (stateRef.current !== "idle") return;

    // Request mic
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      onError("home.mic.error");
      setStateBoth("error");
      setTimeout(() => setStateBoth("idle"), 2000);
      return;
    }

    // If user released the button before getUserMedia resolved, stop immediately
    if (stateRef.current !== "idle" && stateRef.current !== "recording") {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const mime = chooseMimeType();
    mimeTypeRef.current = mime;
    streamRef.current   = stream;
    chunksRef.current   = [];

    // MediaRecorder
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      // Fallback: let the browser pick its own codec
      recorder = new MediaRecorder(stream);
      mimeTypeRef.current = recorder.mimeType;
    }
    recorderRef.current = recorder;

    // 500 ms watchdog: if no data arrives, assume iOS mic freeze
    watchdogRef.current = setTimeout(() => {
      if (chunksRef.current.length === 0) {
        // Stop everything
        if (recorder.state !== "inactive") recorder.stop();
        cleanup();
        onError("home.mic.error");
        setStateBoth("error");
        setTimeout(() => setStateBoth("idle"), 2000);
      }
    }, WATCHDOG_MS);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        // First chunk arrived — clear watchdog
        if (watchdogRef.current) {
          clearTimeout(watchdogRef.current);
          watchdogRef.current = null;
        }
      }
    };

    recorder.onstop = () => {
      void handleStop();
    };

    startTimeRef.current = Date.now();
    recorder.start(250); // 250 ms timeslice — lower latency chunk delivery
    setStateBoth("recording");
    vibrate(15);

    // 30 s hard cap
    maxTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    }, MAX_DURATION_MS);
  }, [onError, cleanup, handleStop, setStateBoth]);

  // ── public handlers ──────────────────────────────────────────────────────

  const onPointerDown = useCallback((): void => {
    // ⚠️  Audio unlock MUST be synchronous, in the same user gesture.
    //     Everything else can be async.
    unlockAudio();
    void startRecordingAsync();
  }, [startRecordingAsync]);

  const onPointerUp = useCallback((): void => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    // Stopping fires onstop → handleStop (async)
    rec.stop();
  }, []);

  return { state, onPointerDown, onPointerUp };
}

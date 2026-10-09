// Build map #E5 — useTicketStream
//
// Wraps EventSource with:
//  - automatic exponential-backoff reconnect (capped at 30 s)
//  - snapshot refetch after reconnect so the UI is never stale
//  - typed message handlers for snapshot / state / team_position events
//
// Usage:
//   const { data, connected } = useTicketStream(ticketId, deviceToken);

import { useEffect, useRef, useState } from "react";

// Inline types to avoid circular import with Tracking.tsx
export type CitizenStage =
  | "RECEIVED"
  | "VERIFIED"
  | "ASSIGNED"
  | "DISPATCHED"
  | "RESOLVED_PROMPT"
  | "CLOSED";

export interface TimelineEntry {
  icon: string;
  label: { hi: string; en: string };
  actorLabel: { hi: string; en: string } | null;
  timestamp: string;
  durationMs: number | null;
  isRed?: boolean;
}

export interface TrackingView {
  id: string;
  publicCode: string;
  categoryCode: string;
  summary: string;
  internalState: string;
  stage: CitizenStage;
  timeline: TimelineEntry[];
  agencyId: string | null;
  department: { hi: string; en: string } | null;
  lat: number;
  lng: number;
  etaText: string | null;
  lastUpdated: string;
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
}

type StreamState = "connecting" | "open" | "closed";

export interface UseTicketStreamResult {
  data: TrackingView | null;
  connected: StreamState;
}

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

export function useTicketStream(
  ticketId: string | undefined,
  token: string | null | undefined,
): UseTicketStreamResult {
  const [data, setData] = useState<TrackingView | null>(null);
  const [connected, setConnected] = useState<StreamState>("connecting");

  const esRef = useRef<EventSource | null>(null);
  const backoffRef = useRef<number>(INITIAL_BACKOFF_MS);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!ticketId) return;

    const apiUrl = import.meta.env.VITE_API_URL as string;

    function connect() {
      if (!mountedRef.current) return;

      // Clean up any existing connection
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      setConnected("connecting");

      // Build URL; pass device token as query param because EventSource doesn't
      // support custom headers in the browser API.
      const url = new URL(`${apiUrl}/reports/${ticketId}/stream`);
      if (token && token.length > 0) {
        url.searchParams.set("token", token);
      }

      const es = new EventSource(url.toString());
      esRef.current = es;

      es.addEventListener("snapshot", (ev: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const payload = JSON.parse(ev.data) as TrackingView;
          setData(payload);
          setConnected("open");
          backoffRef.current = INITIAL_BACKOFF_MS; // Reset backoff on success
        } catch {
          // Ignore malformed payloads
        }
      });

      es.addEventListener("state", (ev: MessageEvent) => {
        if (!mountedRef.current) return;
        // The "state" message is a lightweight hint; "snapshot" always follows it.
        // We optimistically update internalState here for immediate UI feedback.
        try {
          const payload = JSON.parse(ev.data) as { toState: string };
          setData((prev: TrackingView | null) =>
            prev ? { ...prev, internalState: payload.toState } : prev,
          );
        } catch {
          // Ignore
        }
      });

      es.addEventListener("team_position", (ev: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const pos = JSON.parse(ev.data) as { lat: number; lng: number; eta?: string };
          setData((prev: TrackingView | null) =>
            prev
              ? {
                  ...prev,
                  lat: pos.lat,
                  lng: pos.lng,
                  etaText: pos.eta ?? prev.etaText,
                }
              : prev,
          );
        } catch {
          // Ignore
        }
      });

      es.onerror = () => {
        if (!mountedRef.current) return;
        es.close();
        esRef.current = null;
        setConnected("closed");

        // Exponential backoff reconnect
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);
        retryTimerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [ticketId, token]);

  return { data, connected };
}

import { authHeaders } from "../auth/token.js";
// Build map #D10 — Offline draft queue
//
// Saves drafts (text, photo preview, coordinates, language) into IndexedDB
// (with localStorage fallback) when the citizen is offline or network fails.
// Displays the offline banner: "नेटवर्क नहीं है — आते ही भेज देंगे".
// Automatically retries submission on the browser 'online' event.

import { useCallback, useEffect, useState } from "react";
import type { UnderstandPayload } from "../../components/UnderstoodCard.js";

export interface OfflineDraft {
  id: string;
  text: string;
  lang: "hi" | "en";
  lat: number;
  lng: number;
  photoPreviewUrl?: string | null;
  createdAt: number;
}

const DB_NAME = "nyaysetu_offline_db";
const STORE_NAME = "drafts";
const FALLBACK_KEY = "nyaysetu_offline_drafts";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB not supported"));
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function useOfflineDraft({
  apiUrl,
  onAutoSubmitSuccess,
}: {
  apiUrl: string;
  onAutoSubmitSuccess?: (payload: UnderstandPayload, draft: OfflineDraft) => void;
}) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [queuedDrafts, setQueuedDrafts] = useState<OfflineDraft[]>([]);
  const [showOfflineBanner, setShowOfflineBanner] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // Load queued drafts from IndexedDB / localStorage
  const loadDrafts = useCallback(async () => {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        setQueuedDrafts(req.result as OfflineDraft[]);
      };
    } catch {
      // Fallback to localStorage
      try {
        const raw = localStorage.getItem(FALLBACK_KEY);
        if (raw) {
          setQueuedDrafts(JSON.parse(raw) as OfflineDraft[]);
        }
      } catch {
        setQueuedDrafts([]);
      }
    }
  }, []);

  // Save a new draft
  const queueDraft = useCallback(
    async (draft: Omit<OfflineDraft, "id" | "createdAt">): Promise<OfflineDraft> => {
      const item: OfflineDraft = {
        ...draft,
        id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
      };

      try {
        const db = await openDb();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(item);
      } catch {
        // Fallback
        try {
          const raw = localStorage.getItem(FALLBACK_KEY);
          const current: OfflineDraft[] = raw ? JSON.parse(raw) : [];
          current.push(item);
          localStorage.setItem(FALLBACK_KEY, JSON.stringify(current));
        } catch {
          // ignore
        }
      }

      setQueuedDrafts((prev) => [...prev, item]);
      setShowOfflineBanner(true);
      return item;
    },
    [],
  );

  // Remove a draft
  const removeDraft = useCallback(async (id: string) => {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
    } catch {
      try {
        const raw = localStorage.getItem(FALLBACK_KEY);
        if (raw) {
          const filtered = (JSON.parse(raw) as OfflineDraft[]).filter((d) => d.id !== id);
          localStorage.setItem(FALLBACK_KEY, JSON.stringify(filtered));
        }
      } catch {
        // ignore
      }
    }
    setQueuedDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // Flush/retry submitting queued drafts when online
  const retryQueuedDrafts = useCallback(async () => {
    if (!navigator.onLine || queuedDrafts.length === 0 || isRetrying) return;
    setIsRetrying(true);

    const draftsToProcess = [...queuedDrafts];
    for (const draft of draftsToProcess) {
      try {
        const res = await fetch(`${apiUrl}/reports/understand`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            text: draft.text,
            lang: draft.lang,
            lat: draft.lat,
            lng: draft.lng,
          }),
        });

        if (res.ok) {
          const understood = (await res.json()) as UnderstandPayload;
          await removeDraft(draft.id);
          setShowOfflineBanner(false);
          if (onAutoSubmitSuccess) {
            onAutoSubmitSuccess(understood, draft);
          }
          break; // Process one at a time for citizen UI clarity
        }
      } catch {
        // Still unreachable, break and wait for next online event
        break;
      }
    }
    setIsRetrying(false);
  }, [apiUrl, queuedDrafts, isRetrying, onAutoSubmitSuccess, removeDraft]);

  // Online / offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void retryQueuedDrafts();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    void loadDrafts();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadDrafts, retryQueuedDrafts]);

  return {
    isOnline,
    queuedDrafts,
    showOfflineBanner,
    setShowOfflineBanner,
    queueDraft,
    removeDraft,
    retryQueuedDrafts,
  };
}

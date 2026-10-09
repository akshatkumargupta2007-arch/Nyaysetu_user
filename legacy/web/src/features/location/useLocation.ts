// Build map #D6 — Geolocation + jurisdiction reverse-labeling hook
//
// Follows Bible §5.1 & #D6:
// 1. On load, calls navigator.geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 })
// 2. Reverse-labels from NyaySetu boundary and POI endpoints (/jurisdiction/resolve)
// 3. Accuracy > 150m marks state as "poor" (amber chip: "Please confirm pin")
// 4. Denied permission marks state as "denied" (amber chip: "Tap map")
// 5. Exposes setManualLocation(lat, lng) for EXIF or map pin drag
// 6. Location never blocks a report

import { useCallback, useEffect, useRef, useState } from "react";

export type LocationState = "idle" | "detecting" | "ok" | "poor" | "denied";

export interface Coordinates {
  lat: number;
  lng: number;
  accuracyM?: number;
}

export interface LocationInfo {
  state: LocationState;
  coords: Coordinates | null;
  label: string;
  source: "gps" | "exif" | "pin" | "none";
  isReverseGeocoding: boolean;
}

interface UseLocationOptions {
  apiUrl: string;
  lang: "hi" | "en";
}

// Default Bhilai central coordinates if no GPS or map pin is set yet
export const DEFAULT_BHILAI_COORDS = { lat: 21.1938, lng: 81.3509 };

export function useLocation({ apiUrl, lang }: UseLocationOptions) {
  const [info, setInfo] = useState<LocationInfo>({
    state: "idle",
    coords: null,
    label: "",
    source: "none",
    isReverseGeocoding: false,
  });

  const requestedOnce = useRef(false);

  const fetchLabel = useCallback(
    async (lat: number, lng: number): Promise<string> => {
      try {
        const res = await fetch(`${apiUrl}/jurisdiction/resolve?lat=${lat}&lng=${lng}`);
        if (res.ok) {
          const data = (await res.json()) as {
            label?: { hi: string; en: string };
          };
          if (data.label) {
            return lang === "hi" ? data.label.hi : data.label.en;
          }
        }
      } catch {
        // Fallback to coordinates
      }
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    },
    [apiUrl, lang],
  );

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setInfo((prev) => ({ ...prev, state: "denied", source: "none" }));
      return;
    }

    setInfo((prev) => ({ ...prev, state: "detecting" }));

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const poor = accuracy > 150;
        const state: LocationState = poor ? "poor" : "ok";

        setInfo((prev) => ({
          ...prev,
          state,
          coords: { lat: latitude, lng: longitude, accuracyM: accuracy },
          source: "gps",
          isReverseGeocoding: true,
        }));

        const resolvedLabel = await fetchLabel(latitude, longitude);

        setInfo((prev) => ({
          ...prev,
          label: `${resolvedLabel}${poor ? " ⚠" : ""}`,
          isReverseGeocoding: false,
        }));
      },
      () => {
        setInfo((prev) => ({
          ...prev,
          state: "denied",
          isReverseGeocoding: false,
        }));
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [fetchLabel]);

  // Set manual coordinates (from draggable map pin or EXIF)
  const setManualLocation = useCallback(
    async (lat: number, lng: number, source: "exif" | "pin" = "pin") => {
      setInfo((prev) => ({
        ...prev,
        state: "ok",
        coords: { lat, lng },
        source,
        isReverseGeocoding: true,
      }));

      const resolvedLabel = await fetchLabel(lat, lng);

      setInfo((prev) => ({
        ...prev,
        label: resolvedLabel,
        isReverseGeocoding: false,
      }));
    },
    [fetchLabel],
  );

  useEffect(() => {
    if (!requestedOnce.current) {
      requestedOnce.current = true;
      const timer = setTimeout(() => request(), 400);
      return () => clearTimeout(timer);
    }
  }, [request]);

  return {
    ...info,
    request,
    setManualLocation,
  };
}

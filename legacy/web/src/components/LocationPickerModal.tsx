// Build map #D6 — Interactive map modal with draggable pin
//
// Uses Leaflet with OpenStreetMap tiles to let citizens drag a pin or tap
// the map to pinpoint their issue location.
// Includes a helpful prompt when GPS permission is denied or accuracy is poor.

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_BHILAI_COORDS } from "../features/location/useLocation.js";

// Custom pin marker icon to avoid leaflet asset bundling issues
const pinSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="#c2410c">
  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
</svg>
`;

const customPinIcon = L.divIcon({
  html: pinSvg,
  className: "custom-map-pin",
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCoords: { lat: number; lng: number } | null;
  onConfirm: (lat: number, lng: number) => void;
  lang: "hi" | "en";
  hintDenied?: boolean;
}

export function LocationPickerModal({
  isOpen,
  onClose,
  initialCoords,
  onConfirm,
  lang,
  hintDenied,
}: LocationPickerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>(
    initialCoords ?? DEFAULT_BHILAI_COORDS,
  );

  useEffect(() => {
    if (initialCoords) {
      setSelectedCoords(initialCoords);
    }
  }, [initialCoords]);

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    // Small delay to ensure modal DOM is mounted and sized
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      const centerLat = selectedCoords.lat;
      const centerLng = selectedCoords.lng;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [centerLat, centerLng],
          zoom: 15,
          zoomControl: false,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        const marker = L.marker([centerLat, centerLng], {
          icon: customPinIcon,
          draggable: true,
        }).addTo(map);

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          setSelectedCoords({ lat: pos.lat, lng: pos.lng });
        });

        map.on("click", (e: L.LeafletMouseEvent) => {
          marker.setLatLng(e.latlng);
          setSelectedCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
      } else {
        mapInstanceRef.current.invalidateSize();
        mapInstanceRef.current.setView([centerLat, centerLng], 15);
        if (markerRef.current) {
          markerRef.current.setLatLng([centerLat, centerLng]);
        }
      }
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen]);

  // Clean up map when unmounting
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div
      id="location-picker-modal"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "var(--color-bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          padding: "var(--space-3)",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
        }}
      >
        <div>
          <h2 style={{ fontSize: "var(--text-body-lg)", fontWeight: 700, margin: 0 }}>
            {lang === "hi" ? "समस्या की जगह चुनें" : "Select problem location"}
          </h2>
          <span style={{ fontSize: "var(--text-small)", color: "var(--color-text-muted)" }}>
            {lang === "hi" ? "पिन को सही जगह पर खिसकाएं" : "Drag the pin or tap the map"}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: 20,
            cursor: "pointer",
            padding: "var(--space-1)",
            color: "var(--color-text-muted)",
          }}
        >
          ✕
        </button>
      </div>

      {/* Denied / Poor accuracy hint banner */}
      {hintDenied && (
        <div
          style={{
            background: "var(--color-status-amber-bg)",
            color: "var(--color-status-amber)",
            padding: "var(--space-2) var(--space-3)",
            fontSize: "var(--text-small)",
            fontWeight: 600,
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            zIndex: 10,
          }}
        >
          <span>📍</span>
          <span>
            {lang === "hi"
              ? "सटीक लोकेशन के लिए पिन को सही जगह पर रखें"
              : "Drag the pin to the exact location of the issue"}
          </span>
        </div>
      )}

      {/* Map Container */}
      <div
        ref={mapContainerRef}
        id="leaflet-map-canvas"
        style={{
          flex: 1,
          width: "100%",
          position: "relative",
          zIndex: 1,
        }}
      />

      {/* Bottom Confirm Bar */}
      <div
        style={{
          padding: "var(--space-3)",
          background: "var(--color-surface)",
          borderTop: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: "var(--text-small)", color: "var(--color-text-muted)" }}>
          {lang === "hi" ? "चुनी गई जगह:" : "Selected coordinates:"}{" "}
          <strong>
            {selectedCoords.lat.toFixed(4)}, {selectedCoords.lng.toFixed(4)}
          </strong>
        </div>

        <button
          type="button"
          id="location-confirm-btn"
          onClick={() => {
            onConfirm(selectedCoords.lat, selectedCoords.lng);
            onClose();
          }}
          style={{
            width: "100%",
            minHeight: "var(--tap-target-min)",
            borderRadius: "var(--radius-md)",
            border: "none",
            background: "var(--color-brand)",
            color: "#fff",
            fontFamily: "inherit",
            fontSize: "var(--text-body-lg)",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {lang === "hi" ? "इस जगह की पुष्टि करें" : "Confirm this location"}
        </button>
      </div>
    </div>
  );
}

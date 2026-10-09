// Backend address. In dev/Docker the API is on port 8080 of the same host.
export const API_URL =
  import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8080`;

// Used only when the person denies location and has not dropped a pin: Bhilai (Ward 14).
export const FALLBACK_COORDS = { lat: 21.185, lng: 81.33 };

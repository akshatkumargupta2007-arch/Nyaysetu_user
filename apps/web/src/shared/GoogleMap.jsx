import React, { useEffect, useRef, useState } from 'react';
import { GOOGLE_MAPS_KEY } from './config.js';
import './GoogleMap.css';

// One Google Map for the Where and Status screens (phone and desktop).
//  - pin:       { lat, lng } the complaint place. With `draggable`, the person can drag it or tap the map to move it
//               and onPick(lat, lng) is called.
//  - team:      { lat, lng } start point of the team's marker; it glides to the pin on a loop (an illustration, the
//               same idea as the old animation, not a live GPS position).
//  - fallback:  what to draw when there is no key, the script cannot load, or Google rejects the key.
//  - onStatus:  'ready' | 'failed'
// The key is a browser key restricted by website address in Google Cloud; it is visible in the page by design.

let loading = null;
function loadMaps(lang) {
  if (window.google && window.google.maps && window.google.maps.importLibrary) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    window.__nyayMapsReady = () => resolve();
    window.gm_authFailure = () => { loading = null; reject(new Error('Google rejected the Maps key')); };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&v=weekly&loading=async&language=${lang === 'hi' ? 'hi' : 'en'}&region=IN&callback=__nyayMapsReady`;
    s.async = true;
    s.onerror = () => { loading = null; reject(new Error('Could not load Google Maps')); };
    document.head.appendChild(s);
  });
  return loading;
}

const PIN_SVG = '<svg width="44" height="56" viewBox="-28 -72 56 72" aria-hidden="true"><path d="M0 0c-14-16-22-24-22-36a22 22 0 0 1 44 0c0 12-8 20-22 36z" fill="#E0A526" stroke="#FFFFFF" stroke-width="4"/><circle cy="-36" r="8" fill="#FFFFFF"/></svg>';
const TRUCK_SVG = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h11v10H2zM13 9h4l4 4v3h-8"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/></svg>';

function el(html, cls) {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  d.innerHTML = html;
  return d;
}

export const mapsConfigured = () => Boolean(GOOGLE_MAPS_KEY);

export default function GoogleMap({ pin, team, draggable = false, onPick, zoom = 16, fallback, onStatus, lang = 'en', label = 'Map', dropKey = 0 }) {
  const box = useRef(null);
  const g = useRef({});
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;
  const [failed, setFailed] = useState(!GOOGLE_MAPS_KEY);

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) { statusRef.current && statusRef.current('failed'); return undefined; }
    let dead = false;
    let raf = 0;
    (async () => {
      try {
        await loadMaps(lang);
        const { Map } = await window.google.maps.importLibrary('maps');
        const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker');
        if (dead || !box.current) return;
        const map = new Map(box.current, {
          center: pin, zoom, mapId: 'DEMO_MAP_ID', disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', clickableIcons: false,
        });
        const pinEl = el(PIN_SVG, 'gmap-pin');
        const marker = new AdvancedMarkerElement({ map, position: pin, content: pinEl, gmpDraggable: draggable, title: label });
        g.current = { map, marker, pinEl };
        if (draggable) {
          marker.addListener('dragend', () => {
            const p = marker.position;
            const lat = typeof p.lat === 'function' ? p.lat() : p.lat;
            const lng = typeof p.lng === 'function' ? p.lng() : p.lng;
            onPickRef.current && onPickRef.current(lat, lng);
          });
          map.addListener('click', (e) => {
            const lat = e.latLng.lat(), lng = e.latLng.lng();
            marker.position = { lat, lng };
            onPickRef.current && onPickRef.current(lat, lng);
          });
        }
        if (team) {
          const ring = new AdvancedMarkerElement({ map, position: pin, content: el('', 'gmap-pulse') });
          const truck = new AdvancedMarkerElement({ map, position: team, content: el(TRUCK_SVG, 'gmap-team') });
          g.current.ring = ring;
          g.current.truck = truck;
          const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          const t0 = performance.now();
          const step = (now) => {
            const f = reduce ? 0.6 : ((now - t0) % 20000) / 20000;
            truck.position = { lat: team.lat + (pin.lat - team.lat) * f, lng: team.lng + (pin.lng - team.lng) * f };
            raf = requestAnimationFrame(step);
          };
          raf = requestAnimationFrame(step);
          const b = new window.google.maps.LatLngBounds();
          b.extend(pin); b.extend(team);
          map.fitBounds(b, 40);
        }
        statusRef.current && statusRef.current('ready');
      } catch {
        if (!dead) { setFailed(true); statusRef.current && statusRef.current('failed'); }
      }
    })();
    return () => { dead = true; cancelAnimationFrame(raf); g.current = {}; };
    // The map is created once; position changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const { map, marker, pinEl } = g.current;
    if (!map || !marker || !pin) return;
    marker.position = pin;
    if (!team) map.panTo(pin);
    if (dropKey && pinEl) { pinEl.classList.remove('drop'); void pinEl.offsetWidth; pinEl.classList.add('drop'); }
  }, [pin && pin.lat, pin && pin.lng, dropKey]);

  if (failed) return <>{fallback}</>;
  return <div ref={box} role="application" aria-label={label} style={{ position: 'absolute', inset: 0 }} />;
}

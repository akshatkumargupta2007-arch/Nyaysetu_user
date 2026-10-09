import React from 'react';
import { T } from './i18n.js';

// The app name, written in the language the person chose (English: NyaySetu, Hindi: न्यायसेतु, ...).
// Add the translation to the "NyaySetu" key of each language in i18n.js.
export default function Brand({ size = 's', style, label }) {
  const big = size === 'l';
  const name = label || T('NyaySetu'); // `label` pins the name (the language screen is always Hindi)
  return (
    <span
      aria-label={name}
      style={{ display: 'inline-flex', alignItems: 'center', gap: big ? 12 : 8, color: '#1F6B3A', fontWeight: 700, fontSize: big ? 26 : 18, lineHeight: 1.1, whiteSpace: 'nowrap', pointerEvents: 'none', ...style }}
    >
      <span style={{ width: big ? 38 : 28, height: big ? 38 : 28, borderRadius: big ? 11 : 8, background: '#1F6B3A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <svg width={big ? 22 : 16} height={big ? 22 : 16} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 10h18M5 10v8M19 10v8M12 10v8M3 20h18M12 4l9 4H3z" />
        </svg>
      </span>
      {name}
    </span>
  );
}

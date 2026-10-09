import React from 'react';
import { T } from './i18n.js';

// Demo-only visual: the app pretends the code travels over WhatsApp. No message is sent.
const WA = '#25D366';
const css = `
@keyframes waPulse{0%{transform:scale(.8);opacity:.7}100%{transform:scale(1.9);opacity:0}}
@keyframes waDots{0%,80%,100%{opacity:.2}40%{opacity:1}}
@keyframes waPop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
@keyframes waDraw{to{stroke-dashoffset:0}}
`;

function Logo({ size = 76 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill={WA} />
      <path d="M16 6.5a9.4 9.4 0 0 0-8.1 14.2L6.6 25.4l4.8-1.3A9.4 9.4 0 1 0 16 6.5z" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12.6 12.2c.3-.6.6-.6 1-.6l.5.1.9 2-.5.7c.6 1.1 1.5 2 2.7 2.6l.7-.6 2 .9c0 .5-.1 1-.6 1.4-.8.7-2 .6-3.6-.1a9 9 0 0 1-3.9-3.7c-.5-1-.5-1.9.8-2.7z" fill="#fff" />
    </svg>
  );
}

export default function WhatsAppOverlay({ mode }) {
  if (!mode) return null;
  const done = mode === 'verified';
  return (
    <div role="status" aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(247,249,242,.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, textAlign: 'center', padding: 24, fontFamily: "'Atkinson Hyperlegible',system-ui,sans-serif", color: '#1E2B22' }}>
      <style>{css}</style>
      <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!done && <span style={{ position: 'absolute', inset: 10, borderRadius: '50%', background: WA, animation: 'waPulse 1.4s ease-out infinite' }} />}
        {!done && <span style={{ position: 'absolute', inset: 10, borderRadius: '50%', background: WA, animation: 'waPulse 1.4s ease-out .7s infinite' }} />}
        {done ? (
          <svg width="112" height="112" viewBox="0 0 112 112" style={{ animation: 'waPop .5s ease-out both' }} aria-hidden="true">
            <circle cx="56" cy="56" r="52" fill={WA} />
            <path d="M32 58l16 16 32-34" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="90" strokeDashoffset="90" style={{ animation: 'waDraw .5s .35s ease-out forwards' }} />
          </svg>
        ) : <Logo />}
      </div>
      <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>
        {done ? T('Verified with WhatsApp') : T('Connecting to WhatsApp')}
        {!done && [0, 1, 2].map((i) => <span key={i} style={{ animation: `waDots 1.2s ${i * 0.2}s infinite` }}>.</span>)}
      </h2>
      <p style={{ margin: 0, fontSize: 20, color: '#4F6B58' }}>
        {done ? T('Welcome! Taking you in.') : T('Sending your code on WhatsApp')}
      </p>
    </div>
  );
}

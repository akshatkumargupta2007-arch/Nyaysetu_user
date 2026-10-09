import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { isPhoneLayout, isForcedLayout, PHONE_MAX_WIDTH } from './shared/device.js';

// Only the chosen design is downloaded: the two designs use the same CSS class names, so their
// stylesheets must never be loaded together.
const phone = isPhoneLayout();
const App = lazy(() => (phone ? import('./phone/App.jsx') : import('./desktop/App.jsx')));

// Switching between phone and desktop size swaps design: reload so the other stylesheet loads cleanly.
window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`).addEventListener('change', () => { if (!isForcedLayout()) window.location.reload(); });

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={null}>
        <App />
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>
);

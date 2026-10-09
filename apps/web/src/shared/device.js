// Phone layout or desktop layout. Decided once when the app loads; crossing the breakpoint reloads.
// Testing override: open any page with ?ui=phone or ?ui=desktop (remembered for this tab);
// ?ui=auto goes back to automatic detection.
export const PHONE_MAX_WIDTH = 820;

function forced() {
  try {
    const q = new URLSearchParams(window.location.search).get('ui');
    if (q === 'phone' || q === 'desktop') sessionStorage.setItem('cipher.ui', q);
    else if (q === 'auto') sessionStorage.removeItem('cipher.ui');
    return sessionStorage.getItem('cipher.ui');
  } catch {
    return null;
  }
}
export const isForcedLayout = () => forced() !== null;
export const isPhoneLayout = () => {
  const f = forced();
  if (f) return f === 'phone';
  return (
    window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`).matches ||
    (window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 1024)
  );
};

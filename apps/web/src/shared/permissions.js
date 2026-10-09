// Ask the browser for a permission as soon as a screen that needs it opens, so the
// "allow location / microphone / camera?" pop-up appears up front (like Google Meet).
// Resolves true if allowed, false if blocked/unavailable. Never throws.
async function askMedia(constraints) {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}
export const askMic = () => askMedia({ audio: true });
export const askCamera = () => askMedia({ video: { facingMode: 'environment' } });

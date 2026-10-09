// Microphone -> one audio Blob. Tap to start, tap to stop. Chrome gives webm/opus, Safari mp4/aac.
export async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('NO_MIC');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/aac', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  const started = Date.now();
  rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  rec.start(250);
  const stop = () => new Promise((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve({ blob: new Blob(chunks, { type: rec.mimeType || mime }), ms: Date.now() - started });
    };
    if (rec.state !== 'inactive') rec.stop();
  });
  return { stop };
}

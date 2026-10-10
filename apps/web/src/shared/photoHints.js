// Picture makers write their name into the file (hidden "metadata"), and that label is lost the moment the app
// shrinks the picture. So the app reads the ORIGINAL file for these labels before it shrinks it. A label means the
// picture is certainly made by an AI tool. No label proves nothing: labels are easy to strip (a screenshot, a re-save),
// and no AI model we tried could reliably tell an AI picture from a real one by looking at it.

// Words that only appear in files made by an AI tool. ("trainedAlgorithmicMedia" is the standard IPTC label for
// "made by a trained AI model"; phones' real photos use a different label, so they are not caught by mistake.)
const MARKERS = [
  'trainedAlgorithmicMedia', // also matches "compositeWithTrainedAlgorithmicMedia"
  'SynthID', 'Midjourney', 'DALL-E', 'DALL·E', 'Stable Diffusion', 'Adobe Firefly', 'Made with Google AI', 'ImageFX', 'Leonardo.Ai', 'Ideogram', 'NightCafe',
];
// The names these tools give the files they produce.
const NAMES = /^(Gemini_Generated_Image|ChatGPT[ _-]?Image|DALL[-_·. ]?E|Midjourney|ideogram|leonardo|firefly|Image[ _-]?Creator)/i;

/** Does the original file say it was made by an AI tool? Looks at its name and at the start of the file, where labels are kept. */
export async function hasAiMarker(file) {
  try {
    if (file && NAMES.test(String(file.name || ''))) return true;
    const bytes = new Uint8Array(await file.slice(0, 262144).arrayBuffer());
    const text = new TextDecoder('latin1').decode(bytes);
    return MARKERS.some((m) => text.includes(m));
  } catch {
    return false;
  }
}

// Languages the product accepts (the 11 the product ships). Accepting a code does NOT mean
// it has been verified end to end — only claim languages that were actually tested.
export const SUPPORTED_LANGS = [
  "en", "hi", "bn", "mr", "gu", "kn", "ml", "ta", "te", "or", "as",
] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const LANG_NAMES: Record<Lang, string> = {
  en: "English", hi: "Hindi", bn: "Bengali", mr: "Marathi", gu: "Gujarati", kn: "Kannada",
  ml: "Malayalam", ta: "Tamil", te: "Telugu", or: "Odia", as: "Assamese",
};

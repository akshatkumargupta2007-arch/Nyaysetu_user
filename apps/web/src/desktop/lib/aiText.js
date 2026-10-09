// What the AI understood, written in the language the person chose.
// SAMPLE TEXT for the prototype (the same sentence in every language).
// Replace aiUnderstood() with the real text that comes back from your AI / translation service.
// Each entry is [text, direction]. Urdu and Sindhi are written right-to-left.
export const AI_TEXT = {
  en: ["Streetlight not working near the temple", 'ltr'],
  hi: ["मंदिर के पास स्ट्रीट लाइट काम नहीं कर रही है", 'ltr'],
  bn: ["মন্দিরের কাছে রাস্তার বাতি কাজ করছে না", 'ltr'],
  mr: ["मंदिराजवळ पथदिवा चालत नाही", 'ltr'],
  gu: ["મંદિર પાસે સ્ટ્રીટલાઇટ કામ કરતી નથી", 'ltr'],
  kn: ["ದೇವಸ್ಥಾನದ ಹತ್ತಿರ ಬೀದಿ ದೀಪ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ", 'ltr'],
  ml: ["ക്ഷേത്രത്തിനടുത്തുള്ള തെരുവുവിളക്ക് പ്രവർത്തിക്കുന്നില്ല", 'ltr'],
  ta: ["கோவில் அருகில் தெருவிளக்கு எரியவில்லை", 'ltr'],
  te: ["గుడి దగ్గర వీధి దీపం వెలగడం లేదు", 'ltr'],
  or: ["ମନ୍ଦିର ପାଖରେ ରାସ୍ତା ଆଲୁଅ କାମ କରୁନାହିଁ", 'ltr'],
  as: ["মন্দিৰৰ ওচৰত ৰাস্তাৰ বতী জ্বলা নাই", 'ltr'],
};

export function aiUnderstood(lang) {
  return AI_TEXT[lang] || AI_TEXT.en;
}

# Voice clips go here

Put the pre-generated ElevenLabs clips in language folders, named by clip id:

    public/audio/hi/home.mp3
    public/audio/hi/speak.mp3
    public/audio/ta/home.mp3 ...

The clip ids and English scripts are in `docs/voice-scripts.csv`.
`src/lib/voice.js` plays `/audio/<lang>/<clipId>.mp3` when it exists and falls back to the
browser's built-in voice (English only) when it does not; other languages stay silent. The language code is saved when the person taps a
language on the first screen (`en`, `hi`, `bn`, `mr`, `gu`, `kn`, `ml`, `ta`, `te`, `or`, `as`).

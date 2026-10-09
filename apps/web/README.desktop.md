# CIPHER – citizen app (React front end, DESKTOP version, 1440 x 900)

A simple, voice-friendly complaint app for the people of Bhilai (desktop layout; the phone layout is a separate project). This is the full front end of the
design: 17 screens, all the motion and animation, the Bhilai skyline scenes, the real OpenStreetMap
picture, and the page-to-page flow. It is a **front-end demo**: nothing is sent to a server yet.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173  (also on your network, see below)
npm run build      # production build in dist/
npm run preview    # serve the build
```

Needs Node 18+.

### Open it on a phone (demo)

1. Phone and laptop on the same Wi-Fi. Run `npm run dev`; Vite prints a `Network:` address — open it on the phone.
2. **Microphone/speech and some camera features only work on `https://`** (or `localhost`). For the
   full demo on a phone, use a tunnel (`npx cloudflared tunnel --url http://localhost:5173` or ngrok)
   or deploy (below). Over plain `http://` the camera picker still works; speech recognition on the
   "Where is it?" screen falls back to a sample address.
3. Chrome on Android gives the best result (speech recognition + voice).

## Deploy

Any static host. The app uses browser routing, so every URL must serve `index.html`:
- **Vercel** – works as is (`vercel.json` included).
- **Netlify / Cloudflare Pages** – works as is (`public/_redirects` included).

## What is in the box

```
src/
  main.jsx, App.jsx, routes.js     app shell + every route
  components/
    Stage.jsx        scales the 1440x900 design to any screen, fades pages in/out
    Transition.jsx   page-to-page transition (fade + slide, 300 ms)
    TLink.jsx        link with the "tap burst" + page transition
  lib/
    voice.js         AI voice: on/off, auto-read, Listen, ElevenLabs clips with browser fallback
    css.js           turns a CSS string into a React style object (for computed styles)
  screens/           one .jsx + .css per screen (17)
  assets/sector6.png the OpenStreetMap picture of Sector 6, Bhilai
public/audio/        put the ElevenLabs mp3 clips here (see README inside)
docs/
  FLOW.md            every screen, every tap, where it goes
  voice-scripts.csv  every voice clip: id, screen, English script
```

### Design notes
- Everything is drawn at **1440 x 900** and scaled to fit, so it matches the design pixel for pixel.
- Each screen's CSS is scoped to its own root class (`.sc-home`, `.sc-where`, ...) and its keyframes are
  prefixed with the screen name, so screens never clash.
- Colours: forest green `#1F6B3A` (main), dark green `#14502B` (hover), lime cream `#EFF5D5`
  (second-choice buttons), page `#F7F9F2`, text `#1E2B22`, soft sun/lamp amber `#E0A526`,
  warning orange `#B4491F` (flagged/rejected only).
- Font: Atkinson Hyperlegible, plus Noto Sans for each Indian script (loaded in `index.html`).
- Motion: entrance rise on every screen, tap burst, sliding tab indicator and swiping lists,
  typing text, pin drop, sequential progress circles, Yes/No morph, skyline (smoke, turbines, bus,
  birds, twinkling windows, pulsing pin), clouds and falling leaves, canopy on the language screen.
  It all respects "reduce motion".

## Still a prototype (replace with real data / backend)

| Place | Today | Real app |
|---|---|---|
| Phone + code | accepts anything | send and check a real code |
| Send | goes to `/phone`, nothing is posted | `POST` the complaint (text, photo, address, phone) |
| My problems / Status / Fixed | fixed sample problems | fetch the user's complaints and live status |
| Complaint number `BH-24082`, ETA `4:30 PM`, "2 workers" | fixed text | from the API |
| "I am here" | fills `Sector 6, Bhilai` | `navigator.geolocation` + reverse geocoding |
| Map | still picture + animated truck | a real map (MapLibre / Leaflet / Google) with live positions |
| Speak (Speak screen) | types a sample sentence | record audio ► speech-to-text (ElevenLabs Scribe) |
| Photo checks | screens exist (`/photo-rejected`, `/needs-fix`) but nothing triggers them | trigger from the API response |
| Call / Call us / Call Team | placeholders (`#call`) | `tel:` your helpline number |
| Language | saves the language code; the **Send?** screen shows the AI text in that language (sample sentence from `src/lib/aiText.js`) | translate the screen text (i18n), play that language's clips, and fill `aiUnderstood()` with the real AI text |
| Privacy text | draft wording | your real policy |

## AI voice (ElevenLabs)

- `/voice` lets the person turn AI voice **On** (default) or **Off**.
- On: each screen reads itself when it opens. The **Listen** pill always replays the screen.
- `docs/voice-scripts.csv` lists every clip. Generate them once per language with ElevenLabs
  (Eleven v3 supports the Indian languages used here) and save as
  `public/audio/<lang>/<clipId>.mp3`. Until a clip exists, the browser's own voice is used (English only).
- Keep your ElevenLabs API key on a server / one-off script — never in this front end.
- Phones only allow sound after a tap; the taps on the language and voice screens count, and because
  this is one single-page app the permission carries through the whole visit.

## Placeholders to fill

- Helpline number (the `Call us` / `Call` / `Call Team` buttons).
- Privacy page wording (`src/screens/Privacy.jsx`).
- Real complaint data, department names and times.

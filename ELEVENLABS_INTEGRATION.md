# NyaySetu — ElevenLabs Integration Plan

ElevenLabs is a sponsor of this hackathon. The plan is to use **all three pillars** and describe each one accurately in the pitch.
Status: **planned, not built** except where marked. Written 2026-10-06 from a planning conversation. Items marked ⚠️ are unverified; check the ElevenLabs dashboard before relying on them.

---

## 1. The three pillars and what each does here

| Pillar | Used for | Status |
|---|---|---|
| **ElevenLabs API** (Scribe speech-to-text, Eleven v4 text-to-speech) | Turning a spoken complaint into text, in the user's language; reading summaries and status back aloud | `/voice/transcribe` (Scribe) and `voice/tts.ts` exist in the backend; not yet connected to the new frontend |
| **ElevenLabs Agents** | The voice bot: press a button and talk, no screens | Planned, build **after** the citizen app works end to end |
| **ElevenLabs Creative** | Pre-generating the fixed MP3 clips (screen instructions, error lines) once per language | Planned. A script using the API could do the same, so Creative is a convenience, not a dependency |

## 2. Pipeline for a spoken complaint (any language)

1. **Speech → text:** ElevenLabs **Scribe** (`POST /voice/transcribe`). It detects the language, so the user need not pick one.
2. **Understanding:** **Gemini** (the existing `understand` call), not ElevenLabs. It picks the category from the tenant's fixed list and writes the short summary **in the user's language**.
3. **Routing, priority, duplicates:** database and formulas only. The AI never decides the department.
4. **Read-back:** ElevenLabs **v4 TTS** speaks the summary.

Rules:
- **Text is mandatory.** A photo alone cannot be understood (describing photos with Gemini costs money and can be wrong). Voice counts as text because it is transcribed first. The backend must enforce a minimum text length, not only the form.
- **No translate-to-English step.** Gemini reads Indian languages directly. A translation step costs an extra call, adds delay, and can lose meaning (e.g. Hindi "नाली जाम"). Screen text (buttons, titles) is translated in the frontend via translation files.
- The backend currently only accepts `hi` / `en` because only Hindi and English example data and tests exist. Plan: accept all language codes from the design, then **test each language before claiming it works**.

## 3. Languages

- Claim only languages that were **tested**: record sample complaints and check transcript, category and summary.
- Test order: Hindi, Gujarati, Bengali, Marathi, then Tamil, Telugu. Niche languages stay hidden until verified.
- ⚠️ To check in the dashboard: which languages Scribe supports, which TTS (v4/v3) supports, which Agents supports. A language missing from any of them gets screens but no voice.
- ⚠️ Exact current model names (Scribe, v4 TTS, fallback TTS) — put them in `.env`, never hard-code.

## 4. Pre-generated vs live audio

- **Fixed lines** (screen instructions, errors, "Is it fixed?") are generated once per language and saved as `public/audio/<lang>/<clipId>.mp3`. The new frontend already plays these, falling back to browser speech (English only).
- **Dynamic lines** (a complaint summary, a status answer) are generated live with TTS and cached by text so the same sentence is never paid for twice.
- Deadline: pre-generate fixed clips while the Eleven v4 free window is open (about 13 Oct 2026 — ⚠️ confirm in the dashboard).
- Keep the API key on the server or in a one-off script. Never in the frontend.

## 5. Voice bot (Eleven Agents) — later phase

Goal: for people who cannot use a multi-screen app, press one button and talk.

How it works:
- The agent only does the **talking**. Every fact and action goes through **tools** that call our backend: `understand` → read back what was understood → wait for "yes" → `confirm`; and status questions use our status endpoint.
- **Login first, by hand:** the user enters phone number and OTP in the app before starting the bot. The bot inherits that login. No OTP over voice.
- **Location:** the app asks for location permission (pop-up) and passes the coordinates to the agent when the session starts. If denied, the agent asks for a landmark.
- **Photo button:** the agent calls a **client tool** (e.g. `show_photo_button`) that our web app implements. The button appears only at that moment, opens the camera, uploads the photo, and tells the agent it is done.
- **Name:** may be asked during the voice chat; the backend does not store a name today.

Hallucination handling (demo scope):
- The agent may only state facts returned by our tools.
- It must read back what was understood and wait for a yes before filing.
- Rehearse the exact demo conversations; write a fixed fallback line for anything unknown.
- A cheapest-model agent may mishear Indian languages or skip tool calls. Test with real conversations; step up one model tier only for the bot if needed.
- Add a **per-session time limit** (about 3 minutes).

## 6. Costs and credits

| What | How it is paid |
|---|---|
| Scribe, v4 TTS | **Credits.** You have about **2 lakh** left for v4 TTS and about **1 lakh** for the rest (speech-to-text etc.) |
| **Agents** | **Not from credits.** Billed per conversation minute |

- ⚠️ Creator plan includes **275 agent minutes** (per ElevenLabs' public page); extra minutes about **$0.08/min**; burst (over 10 concurrent calls) about **$0.16/min**. The model behind the agent is billed separately; the cheapest model (e.g. Gemini 2.5 Flash, listed about $0.003/min) is the plan. Check your Agents usage page.
- A complaint call is roughly 1.5–3 minutes, so 275 minutes is on the order of 90–180 demo calls. Test calls spend the same minutes, so keep them short.
- **Local development** uses `STT_PROVIDER=gemini` to save Scribe credits; the deployed demo uses `STT_PROVIDER=eleven`. Switching is one environment variable, with automatic fallback to the other provider if one fails.

## 7. Open items

- [ ] Dashboard check: languages for Scribe, TTS and Agents (§3).
- [ ] Exact model names for Scribe and v4 TTS (§3).
- [ ] Confirm the 275 agent minutes on this account (§6).
- [ ] Backend: enforce minimum text length; accept all language codes; summary written in the user's language.
- [ ] Wire the new frontend's speak, photo, location, send and phone/OTP screens to the backend.
- [ ] Generate the fixed clips per language.
- [ ] Test Hindi, Gujarati, Bengali, Marathi end to end.
- [ ] Voice bot: build after the above works (new build map ticket).

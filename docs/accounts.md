# Accounts and Keys

**No keys in this file, ever.** This is a checklist of what exists and where the key lives, not the key itself.

| Service | Used for | Plan | Key lives in | Status |
|---|---|---|---|---|
| Google AI Studio (Gemini) | understanding, vision, voice router, embeddings | Pay-as-you-go / free tier | `.env` (local) · Railway env vars (prod) | [[set up?]] |
| ElevenLabs | Scribe STT + Eleven v4 TTS | Creator | `.env` (local, optional) · Railway env vars (prod) | [[set up?]] |
| Railway | API + Postgres hosting | Hobby ($5/mo) | railway.app dashboard | [[set up?]] |
| Cloudflare | DNS, Pages, WAF, Turnstile | Free | cloudflare.com dashboard | [[set up?]] |
| Cloudinary | photo + TTS-audio upload/delivery | Free | `.env` (local) · Railway env vars (prod) | [[set up?]] |
| GitHub | repo + Actions CI | Free | — | [[set up?]] |
| Sentry | error tracking | Free (Developer) | `.env` (local) · Railway env vars (prod) | [[set up?]] |
| UptimeRobot | uptime ping on `/healthz` | Free | uptimerobot.com dashboard | [[set up?]] |
| Domain registrar | `nyaysetu.[[tld]]` | ~₹800/yr, or skip and use free `*.pages.dev` / `*.up.railway.app` | — | [[set up?]] |

## Billing safety

- [ ] Google Cloud budget alert set (e.g. ₹500 threshold) so a bug can't run up a Gemini bill.
- [ ] ElevenLabs usage page bookmarked; check before and after each development session during the Eleven v4 free window.
- [ ] Railway spend cap checked in project settings.

## Free-window calendar (ElevenLabs Eleven v4)

- **Window end:** ~13 Oct 2026 — **confirm the exact date/time in the ElevenLabs dashboard**, do not trust this note.
- **Deadline:** all fixed-sentence TTS and the showcase-flow audio backup must be pre-generated **before** this date (see `NYAYSETU_BUILD_MAP.md` #G5).
- [ ] Reminder set 48h before the window closes.

## Model IDs (fill in once confirmed — see `NYAYSETU_BUILD_MAP.md` #0.3)

| Purpose | Model ID | Confirmed on |
|---|---|---|
| Gemini — fast/extraction (understanding) | `[[ ]]` | `[[date]]` |
| Gemini — vision (photo understanding, before/after) | `[[ ]]` | `[[date]]` |
| Gemini — embeddings (768-dim) | `[[ ]]` | `[[date]]` |
| ElevenLabs — Scribe (STT) | `[[ ]]` | `[[date]]` |
| ElevenLabs — Eleven v4 (TTS) | `[[ ]]` | `[[date]]` |
| ElevenLabs — fallback TTS (Flash-class) | `[[ ]]` | `[[date]]` |
| ElevenLabs — Hindi voice ID | `[[ ]]` | `[[date]]` |
| ElevenLabs — English voice ID | `[[ ]]` | `[[date]]` |

Once filled in, copy these into `.env` / Railway env vars. Never hardcode a model ID in source.

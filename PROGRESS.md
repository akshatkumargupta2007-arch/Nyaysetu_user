# NyaySetu: Progress Log

**Last fully updated: 2026-10-09** (hackathon day 1, SSTC Bhilai, 9 to 10 Oct 2026).
Read this first, then `NYAYSETU_BUILD_MAP.md`, then `NYAYSETU_BIBLE.md`. For going live: `DEPLOYMENT_CHECKLIST.md`. For the hackathon sprint: `~/Downloads/NYAYSETU_HACKATHON_MASTER_BUILD_MAP.md`.

This file says exactly what is built, what is tested, what is only designed, and what is missing, so anyone (or any agent) can pick the project up without the chat history. Ticket IDs (`#A1`, `#C4`, `CA3`, `GB4`) are the shared vocabulary.

---

## 1. The project in one paragraph

NyaySetu is a voice-first civic-grievance platform for India. A citizen logs in with a phone number and OTP, speaks or types a problem in any of 11 languages (optionally adds a photo), sees an AI summary, and sends it. The engine works out the category, the owning office, the urgency and any duplicates; the citizen tracks it like an online order; field work needs proof; and **only the citizen can close a complaint** ("Closed is not fixed"). A **separate government portal** gets the tickets over a signed, one-way channel, shows officials a filterable table, KPIs and a heat map, lets them reveal a phone number (logged against their name) and ask the citizen to verify the fix. Demo tenant: Bhilai, Chhattisgarh. The architecture is pan-India (one national taxonomy plus per-city data).

## 2. The system at a glance

| Part | Where | What it is | Tests |
|---|---|---|---|
| **Citizen app** | `NyaySetu_Full_v2` (this repo) | Fastify 5 + TypeScript API, Postgres 17 (PostGIS + pgvector + pg_trgm), React 18 + Vite frontend with two complete designs (phone and desktop) | **188 API tests pass** (26 files) |
| **Government portal** | `NyaySetu_Gov` (separate repo, own API, own database, own keys) | Officials-only portal: login, filters, KPIs, map, phone reveal, close request, audit log, CSV export | **163 API tests pass** (13 files) |
| **The bridge between them** | both repos | Ed25519-signed channels in both directions, replay protection, phone numbers sealed so only gov can open them | covered by both suites |
| **Whole loop, real servers** | `NyaySetu_Gov/scripts/e2e.mjs` | citizen files, field team finishes, gov sees it, reveals the phone, requests verification, citizen answers live, complaint reopens | **13 of 13 checks pass** on the full six-container Docker stack, from a cold start with rotated keys |

Run the whole stack: in `NyaySetu_Gov`, `npm run up:all`, then `npm run init:all` (first time), then `npm run e2e`. The citizen folder is found automatically (`CITIZEN_DIR`, a sibling folder, or `~/Documents/NyaySetu_Full_v2`).

## 3. What is built

### 3.1 Backend: Phases 0, A, B, C (committed, original work)
- **Phase 0/A:** monorepo, `docker-compose`, production Dockerfiles, CI (secret scan, build the real DB image, migrate, seed, typecheck, test, eval), Fastify with Zod, CORS, per-route rate limits, `/healthz`. The database image is built on `postgres:17-bookworm` plus the PGDG repo (not `postgis/postgis`, which has no arm64 build and a dead apt mirror). The **event ledger is append-only at the database level** (a restricted `app_rw` role cannot update or delete events).
- **Phase B data:** 61-category national taxonomy; Bhilai tenant with 7 agencies, 6 hand-drawn **approximate** boundaries, 176 routing rules, 61 SLA policies, 5 landmarks; 61 knowledge-base chunks; 150 synthetic closed tickets for precedent and ETA. Bengaluru is an empty placeholder (#B6 not built).
- **Phase C engine:** jurisdiction by PostGIS point-in-polygon; hybrid retrieval (full text plus vector, Reciprocal Rank Fusion); one constrained Gemini "understand" call whose category must be one of the tenant's own (an invented category is impossible); deterministic SQL routing (**the AI never picks a department**); three-way confidence gate; H3 plus PostGIS plus cosine duplicate detection; transparent priority formula with a safety override; dHash photo-reuse detection; an eval harness over 188 golden rows. Runs in automatic **mock mode** when `GEMINI_API_KEY` is empty.
- **Phase G voice backend:** `POST /voice/transcribe` (Gemini or ElevenLabs Scribe with automatic fallback and a daily cap), `voice/tts.ts` (ElevenLabs with a cache, mock fallback), read-only voice tools scoped to the citizen, `POST /voice/ask`, a grounding validator for free-form answers.

### 3.2 Lifecycle, officers, proof (Phases E and F, by Antigravity, backend verified)
State machine with `transition()` and row locks; hash-linked event ledger with a verify endpoint; citizen-facing stage mapping; tracking; live updates (SSE over Postgres LISTEN/NOTIFY); simulated team movement and a demo clock; SLA timers, escalation and priority recompute (pg-boss cron, inside the API process, so **run one API instance**); officer login and feeds; field jobs; five proof gates before "work done". The old React/TypeScript officer console and field app are in `legacy/web/` and are **not** part of the new frontend (see section 5).

### 3.3 Authentication: Phone plus OTP only
No passwords, no device tokens. `POST /auth/request-otp` then `POST /auth/verify-otp` returns a citizen JWT (30 days). OTP: HMAC-hashed, 5-minute life, 30-second resend cooldown, 5 per hour, 5 attempts. Phones are stored as a keyed hash plus an AES-256-GCM encrypted copy. Officers use a separate JWT kind. The AI preview (`/voice/transcribe`, `/reports/understand`) is anonymous but rate-limited and saves a server-side **draft**; `POST /reports/confirm` (login required) takes only `{draftId, photo}`, so the client can never choose its own category, priority or location. Tracking, uploads, closure, the live stream and the voice assistant check ownership. **No SMS/WhatsApp provider is connected yet:** in development the code is returned in the response and prefilled; the code is no longer printed in production logs.

### 3.4 Citizen frontend (new, wired to the API)
- `apps/web/src/phone/` and `apps/web/src/desktop/`: the two "cipher" designs. `src/main.jsx` picks one at load (width up to 820 px = phone) and loads only that tree. Force one for testing with `?ui=phone`, `?ui=desktop`, `?ui=auto`.
- **Flow:** language, phone, OTP, AI-voice setting, home, speak/photo/write, where, send (AI summary shown first), sent, My problems, status, "Is it fixed?". A route guard blocks every complaint screen until login; a logged-in person skips phone and OTP.
- **Browser permissions** are asked on arrival: location (Where), microphone (Speak), camera (Photo).
- **11 languages:** English, Hindi, Bengali, Marathi, Gujarati, Kannada, Malayalam, Tamil, Telugu, Odia, Assamese. Screen text goes through `T("English text")` (`shared/i18n.js`, 88 strings x 10 languages, falls back to English). **Machine-drafted: needs native review (Odia and Assamese least certain).**
- **Voice:** 33 pre-generated clips per language = **363 MP3s (about 17 MB)** in `public/audio/<lang>/`, made with ElevenLabs v4 and the voices the owner chose (`scripts/voice/generate.mjs`, lines in `scripts/voice/lines/`). Ticket numbers are spoken by chaining digit/letter/"dash" clips. Browser speech is the fallback for English only; other languages stay silent rather than speak English. A clip blocked by autoplay rules plays on the first tap.
- New screens for the verification loop: a **"Verify resolution" banner** at the top of My Problems (live, about 50 ms), and a **re-report screen** (voice, photo, text) that reopens the same complaint.

### 3.5 The government bridge (citizen side: CA1 to CA9, CB1 to CB4)
GOV actor and `CLOSE_REQUESTED_BY_GOV` event; signed internal listener (port 8090, never published); push sync with a per-ticket cursor and sealed phones; a per-citizen live stream (`/me/stream`); `pending_close_request` on `/me/reports`; hourly 7-day `CLOSED_UNCONFIRMED` timeout counted from "work done" (a gov request never extends it); daily 180-day phone erasure with a ledger note so gov erases too; officer passcodes use bcrypt. **Still half done (CA9):** citizens and officers share one JWT secret in this app (the gov portal is unaffected: it rejects any such token).

### 3.6 The government portal (`NyaySetu_Gov`, summary)
Own API, own PostgreSQL + PostGIS database, own keys, own web app. Login (argon2id, 15-minute EdDSA token, rotating refresh cookie with reuse detection), role scope on every query (national, state, district, city, department; fails closed), filters shared by list, counts, KPIs, map and export; phone reveal logged before it is shown; close request; heat map with five zoom levels; hash-linked audit log and CSV export (safe in Excel); Hindi and English. Details: `NyaySetu_Gov/PROGRESS.md` and `HANDOFF.md`.

### 3.7 Gemini and ElevenLabs configuration (fixed 2026-10-06 and 07)
Models: `gemini-3.5-flash-lite` (fast), `gemini-3.5-flash` (vision), `gemini-embedding-001` (768 dimensions via `outputDimensionality`); structured output uses `responseJsonSchema`; `GEMINI_TIMEOUT_MS` is a setting (default 6000). Google retires models often: re-check before every demo. ElevenLabs: voice clips use model `eleven_v4`; speech-to-text can use Gemini (`STT_PROVIDER=gemini`) so ElevenLabs is not needed at run time.

## 4. Code review and fixes (2026-10-09)
A review of the gov portal and the bridge found 21 issues; **all were fixed and verified**: forged `X-Forwarded-For` no longer escapes rate limits (`TRUST_PROXY`); login answers are uniform and lockout is per device; phone-digit search is limited and audited; phone reveal needs a reason; production insists on the restricted `gov_app` database role; map tooltips are escaped; no third-party fonts; bad cursors give 400; several tabs no longer sign each other out; rejected tickets back off; one bad boundary no longer fails a batch; the citizen API no longer **crashes** when its background sync runs before the database is migrated; `.dockerignore` and `.gitattributes` added; keys and passwords rotated. Full list: `NyaySetu_Gov/HANDOFF.md` section 10.

## 5. Known gaps (honest list)

- **No real OTP delivery** (WhatsApp or SMS provider not connected).
- **Photos are simulated:** no Cloudinary keys.
- **Not tried on a real device:** microphone recording, camera, real GPS, sound on iPhone/Android.
- **Officer/field UI:** the gov portal covers officials (read, reveal, request verification). Nothing in the new frontend lets a **field team mark work done**; the backend endpoints and the old `legacy/web` field app exist, and `scripts/demo-workdone.mjs` does it for demos. The Status screen's step times are still design placeholders.
- **Only Bhilai has data.** Elsewhere the web app silently retries at the Bhilai demo coordinates (`VITE_DEMO_FALLBACK`).
- **Translations and voice clips are not native-reviewed.**
- **Seed data was embedded in mock mode;** re-seed with the real Gemini key for real vector matching. The eval figure (88.3 percent category accuracy against an 8.3 percent keyword baseline) was measured earlier; **re-measure with the real model before quoting it.**
- **Gemini sometimes exceeds 6 seconds;** a timeout currently returns a 500 to the citizen instead of a gentle fallback.
- **Not deployed;** nothing is pushed anywhere (see 6).

## 6. Git and deployment state

- **Citizen repo (`NyaySetu_Full_v2`):** 13 local commits. Uncommitted: the 2026-10-09 fixes (`syncTrigger`, backoff migration `0008`, `GEMINI_TIMEOUT_MS`, `.dockerignore`, `.gitattributes`) and this file. **No remote.**
- **Gov repo (`NyaySetu_Gov`):** 38 local commits, plus the review fixes uncommitted. **No remote.**
- **Deployment:** not started. Everything needed (blockers, steps, environment variables, after-deploy checks) is in `DEPLOYMENT_CHECKLIST.md`. Scope decided: Railway (Postgres and API), Cloudinary (photos), Cloudflare (website, domain, protection); ElevenLabs is not needed at run time.

## 7. Numbers (all measured)

| Thing | Value |
|---|---|
| Citizen API tests | 188 passing (185 before the review fixes) |
| Gov API tests | 163 passing (132 before) |
| Full-stack end to end | 13 of 13 checks, cold start |
| Languages in the app | 11 (10 translated + English) |
| Voice clips | 363 MP3, about 17 MB |
| Categories in the taxonomy | 61 |
| Bhilai routing rules / SLA policies | 176 / 61 |
| Golden eval rows | 188 |

## 8. Real bugs found by tests or review, and fixed (not special-cased)

Earlier: (1) `boundaries.centroid` missing from the Drizzle schema; (2) a tokenizer regex that split Devanagari conjuncts; (3) category-specific words diluted by L1-shared words in the knowledge base; (4) CI database image lacking pgvector; (5) wrong native bindings after moving between operating systems; (6) a blocking observability insert; (7) Vitest not reading the root `.env`.
Frontend and auth (Oct 6 to 8): `DEMO_MODE` parsed with `z.coerce.boolean` made "false" mean true; `/reports/confirm` trusted client fields and faked success on error (rewritten around server-side drafts); retired Gemini model names and a JSON-schema field Gemini rejects; a missing Gemini embedding dimension setting; the old OTP code printed to production logs; the production image could not run migrations (no `tsx`).
Review (Oct 9): see section 4. Two were found only by running the real stack: the sync sweep crashing the API, and the missing `.dockerignore` overwriting the container's `node_modules`.

## 9. What comes next

1. **Hackathon sprint (today and tomorrow):** `~/Downloads/NYAYSETU_HACKATHON_MASTER_BUILD_MAP.md` (Tiger Data, ElevenLabs, Gemini, Tin Computer, with a time-boxed plan and a demo script).
2. **Deploy** (after the hackathon, or a cut-down version for the demo): `DEPLOYMENT_CHECKLIST.md`.
3. **Commit and push** (create the GitHub repository first).
4. Real OTP provider, Cloudinary, real-phone testing, native-speaker review.
5. Field-team screen in the new frontend; more cities (#B6); the WhatsApp and voice bots.

## Appendix: ticket notes from the earlier frontend (superseded, kept for history)

The first React/TypeScript frontend (tickets #D1 to #D10) and the first officer console and field app (#F1 to #F4) live in `legacy/web/` and are replaced by the cipher designs and the gov portal. Their backend halves remain: photo signing and EXIF handling (#D5), `GET /jurisdiction/resolve` (#D6), officer login/feeds/field jobs/proof gates (#F1 to #F4). #E1 to #E8 (state machine, ledger, stage mapping, tracking, SSE, simulated movement, closure loop, SLA and priority crons) are backend and remain in use. #G7 (free-form answers with a grounding validator) is built.

## Google Map on Where / Status (2026-10-09)
- `apps/web/src/shared/GoogleMap.jsx` (+ `.css`): one component for phone and desktop. Where: a real Google Map with a draggable pin; tap the map or drag the pin to set the exact place (saves coordinates, reverse-resolves the ward/address through the existing `/jurisdiction/resolve`); "I am here" still uses the browser location and drops the pin. Status: map centred on the complaint's coordinates (from `/tickets/:id` tracking), with a pulsing pin and a team marker that glides to it (an illustration, not live GPS, as before).
- Key: `VITE_GOOGLE_MAPS_API_KEY` (browser key; `.env.example`, both compose files, `apps/web/Dockerfile` build arg). In Google Cloud restrict it to the Maps JavaScript API and to your site addresses (HTTP referrers). Empty key, load error, or a rejected key (`gm_authFailure`) all fall back to the old static picture, so nothing breaks without it.
- Tested with a fake Google API in a throwaway page: map created with the pin, drag and tap both call `onPick`, panning, team mode, and the fallback with no key. NOT tested against real Google (no key yet): needs the key to confirm tiles, the Hindi language setting and the pin look.

## Bolo, the ElevenLabs voice agent (2026-10-09): backend + logic done, UI is a placeholder
- API: `GET /agent/status`, `POST /agent/session` (citizen login required; ElevenLabs signed link, per-language voice and greeting, daily cap `AGENT_DAILY_CAP`=6, `AGENT_SESSION_SECONDS`=180, `AGENT_LANGS`=hi,en); migration `sql/0009_agent_sessions.sql`; 6 tests (194 API tests pass). The ElevenLabs key never leaves the server.
- Decision: all six tools are CLIENT tools run in the citizen's own browser with their own login (`apps/web/src/shared/boloTools.js`): understand_complaint, confirm_complaint, track_complaint, confirm_closure, show_photo_button, go_to. No webhook, so it works on localhost, and no new way to touch other people's data.
- `npm run agent:create` (apps/api) creates/updates the agent in ElevenLabs and writes ELEVEN_AGENT_ID to .env. Its request body was checked against ElevenLabs' OpenAPI schema offline.
- Tests: `node scripts/agent/test-agent.mjs --tools-only` (13/13 against the live stack: refusals, no double filing, other citizens' tickets refused, allow-listed screens). `node scripts/agent/test-agent.mjs` runs the six scripted conversations in TEXT mode with the real agent (happy path, "no" at read-back, tool failure, off-topic, other person's ticket, prompt injection).
- UNBLOCKED (new ElevenLabs key with ElevenAgents Write + Speech to Text + Text to Speech). Agent created (`agent_9601m4g4207dfz5sgdd7v49q4te9`, id saved in .env as ELEVEN_AGENT_ID); `/agent/status` says enabled. Conversation tests in TEXT mode with the real agent: 9/9 pass (English and Hindi happy paths, saying no files nothing, tool failure is spoken about, off-topic, other person's ticket refused, prompt injection ignored). NOT verified: actual voice quality / microphone round trip (needs a person talking in the browser), and the other 9 languages (only hi, en enabled).
- The ElevenLabs key was pasted into chat once: rotate it when convenient.
- Placeholder UI (button on Home + `shared/BoloOverlay.jsx`): works functionally but its layout is clipped inside the desktop frame; the user will supply the real UI.
- Not built: City Radio, Scribe Realtime.

## Talk screen integrated (2026-10-09): the designer's voice-bot frontend + Bolo backend
- New design files (`cipher-phone-frontend.zip`, `cipher-desktop-frontend.zip`): only `Talk.jsx/.css`, a Talk tile on Home, `/talk` route. Integrated into `apps/web/src/{phone,desktop}`: `screens/Talk.jsx` now draws only; all behaviour is in `shared/useTalk.js` (voice session via `@elevenlabs/react` and our signed link, trays for map, photo and review) and `shared/boloTools.js` (the agent's tools, real API calls).
- Flow the agent follows: listen, `request_location` (map tray, real Google Map when the key is set, else the picture), `understand_complaint`, read back + yes, optional `request_photo`, `show_review` (the PERSON taps Send; the agent can never file alone), `finish_complaint`. Also `track_complaint`, `confirm_closure`, `go_to`. The old overlay and the phone/code trays were removed (login happens before Home).
- All 11 languages: UI strings translated (T()), agent enabled for hi,en,bn,mr,gu,kn,ml,ta,te,or,as (`AGENT_LANGS`), per-language voice + greeting. `node scripts/agent/test-agent.mjs --langs` checks each language greets in its own script.
- Tests passed today: tools-only 15/15, scripted conversations 9/9 (text mode, real agent), 11 languages accepted (greeting in own script), full-stack e2e 13/13, citizen API 194. Browser checks: Home tile in Hindi, Talk screen, trays (place/photo/review) fit in phone (375x812) and desktop; photo upload (resized JPEG stored); mic-denied message shown; Done goes to /sent.
- Fixed: phone trays overlapped the End button on 812px-tall screens (the middle now scrolls, orb shrinks).
- NOT verified: real microphone round trip and voice quality (the Browser pane blocks the mic), Google Map pieces (no key), non-Hindi/English conversation quality beyond the greeting (agent answered in script in all 10 non-English tests), mobile Safari/Chrome autoplay behaviour.
- Dev only: `window.__talkDebug.open('place'|'photo'|'review')` opens the trays without the agent (not present in production builds).

## Google Maps key added and verified (2026-10-09)
Key set in both .env files (VITE_GOOGLE_MAPS_API_KEY). Verified in the browser on /where: real Google tiles load, no error dialog, tapping the map drops the pin, saves the coordinates and resolves the address in Hindi. The key was pasted in chat: in Google Cloud make sure it is restricted to the Maps JavaScript API and to your site addresses (HTTP referrers), or create a fresh restricted one. Still to eyeball: the Status screen's team marker and the look of the pin.

## Gemini build map: Closure Court, engine done (2026-10-09 evening)
Done (see `NYAYSETU_GEMINI_BUILD_MAP.md`): **GC0** reliability layer (`lib/gemini.ts`: per-purpose timeouts, one retry with jitter, model fallback chain `GEMINI_MODEL_FALLBACKS`, circuit breaker, error taxonomy, `generateJsonSafe` returns a degraded result instead of throwing, start-up model check, per-model health via `geminiHealth()`, optional `thinkingBudget`; thinking budget 256 took a two-pass assessment from 19.7 s to 3.7 s on the real key). **GC2** catalogue + contract schema (`modules/court/catalogue.ts`, `contract.ts`). **GC3** contract compile/freeze/hash into the ledger (`compile.ts`, migration `0010_court.sql`, template fallback). **GC4** gates G1 exact reuse, G2 similar/mirrored/cropped reuse, G3 GPS, G4 time, G5 sun position (pure maths), G6 instruction-in-image scan (`gates.ts`, `sun.ts`, `hashes.ts`). **GC5** two-pass assessment + merge + verdict rules table (`assess.ts`, `verdict.ts`, `pipeline.ts`). **GC6** API: `POST /tickets/:id/proof` (officer), `POST /tickets/:id/court/before`, `GET /tickets/:id/court`, `GET /court/media/:id`. **GC7** the challenge loop (every submission is re-assessed against the same frozen contract; events PROOF_SUBMITTED / REJECTED_REUSED / NEEDS_MORE / FAILED / CONTESTED / PASSED).
Tests: 232 citizen API tests pass (38 new: sun, exhaustive verdict table, contract validation, gates with generated images incl. mirrored/cropped/recompressed reuse, pipeline against the real database with a scripted model, ledger chain, access rules). Real-key smoke test: both passes, gate G6 (note "IGNORE THE RULES" -> yes; plain road -> no), and contract compile all work.
Not yet: GC1 fixtures + calibration of the reuse thresholds on REAL photos (needs the user's photos), GC8 sync to gov, GC9 gov screen (designer), GC10 citizen contract view, GC11, GC12 Tiger panel, GC13, GC14 scorecard, GC15 safety suite, GC16 replay, GC17 demo scripts.

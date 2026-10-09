# NyaySetu — Progress Log

**Read this first, then `NYAYSETU_BUILD_MAP.md`, then `NYAYSETU_BIBLE.md`.**

This file exists so anyone (or any agent) picking up this project can see exactly what's built, what's stubbed, what's untested, and what to do next — without re-reading the whole chat history. Keep it updated as tickets close.

---

## The three documents in this repo, and what each one is for

| File | What it is | When to read it |
|---|---|---|
| `NYAYSETU_BIBLE.md` | The *why*: product thesis, prior-art research, every design decision explained, the full architecture, the demo script, judge Q&A. | Before making any product/architecture decision. |
| `NYAYSETU_BUILD_MAP.md` | The *how*: every piece of work broken into numbered tickets (`#A1`, `#B3`, `#D4`, …), grouped into phases, each with Priority/Window/Blocked-by/Build/Watch-out/Test/Done-when. | Before starting any new work. Pick the next unblocked ticket; don't freelance outside it. |
| `PROGRESS.md` (this file) | The *where we are*: what's actually done, actually tested, actually committed — vs. what's stubbed or still TODO. | First, every session. |

**The ticket IDs (`#A1`, `#B2`, `#D4`, etc.) are the shared vocabulary.** Always refer to work by its ticket number so it's unambiguous which build-map item is being discussed.

---

## Current state in one sentence

**The backend (Phases 0–G) is built and tested (133/133 API tests, run in mock mode), login is Phone + OTP, and the new cipher frontend (phone and desktop designs, auto-selected by screen width) is wired to it. A full complaint (write → AI summary → phone → OTP → filed → My problems → Status) was exercised in a browser at both widths with the real Gemini key. Not yet: a real OTP delivery provider, the officer/government UI, the voice bot, photo/mic/GPS verified on a real device, and nothing has been committed since `1aa239c`.**

---

## ✅ Done, tested, and committed to git

Git log (`git log --oneline` from the repo root):
```
1aa239c Phase B/C EVIDENCE tickets: photo fraud detection + the eval harness
f5d394b Phase C (CORE): the Complaint Intelligence Engine, end to end
29c88f2 Phase B (CORE): national taxonomy, Bhilai tenant data, KB, history
51589ce Phase 0 + Phase A: foundation scaffold, verified end to end
```
No remote is configured — this is **local-only** git history on this machine. Nothing has been pushed anywhere.

### Phase 0 — Accounts & config
- `README.md` with the product one-liner and the "what is real / simulated / approximate / cached" claim block.
- `docs/accounts.md` — checklist of every external service needed (Gemini, ElevenLabs, Railway, Cloudflare, Cloudinary, Sentry, UptimeRobot), with the ElevenLabs Eleven v4 free-window deadline noted.
- `.env.example` with every env var the project needs.
- `scripts/check-keys.mjs` — pings Gemini/ElevenLabs/Cloudinary, never crashes on a missing key (`npm run check-keys`).

### Phase A — Repo, Docker, database, API skeleton, CI
- npm workspaces monorepo: `apps/api` (Fastify + TypeScript), `apps/web` (React 19 + Vite + TypeScript).
- `infra/db/Dockerfile`: Postgres 17 + PostGIS 3.6 + pgvector 0.8 + pg_trgm, **built on `postgres:17-bookworm` + the PGDG apt repo, not `FROM postgis/postgis`** — that image's current tag is pinned to an archived Debian bullseye and `apt-get update` 404s. This was a real bug found and fixed during the build; don't revert it.
- Full Drizzle schema for all 18 tables (`apps/api/src/db/schema.ts`), including PostGIS geometry and pgvector columns, HNSW indexes, and a generated `tsvector` column for hybrid search.
- **The event ledger is append-only at the database level**, not just by app convention: a restricted `app_rw` Postgres role can `INSERT` into `events` but is refused on `UPDATE`/`DELETE` — verified live.
- `docker-compose.yml` for local dev (hot-reload) + separate production multi-stage Dockerfiles for both apps, verified standalone (compiled `dist/server.js` boots and answers real requests).
- Fastify app: Zod validation, CORS scoped to the web origin, per-route rate limiting, structured logs, `/healthz`.
- GitHub Actions CI (`.github/workflows/ci.yml`): secret scan (gitleaks) + build-the-real-db-image + migrate + seed + typecheck + test + eval, run against a from-scratch container — verified to match exactly what CI will do.

### Phase B — Data (CORE tickets #B1–#B4)
- `data/taxonomy.json`: **61 categories** (60 real + `OTHER_CIVIC` fallback) across 12 L1 groups — Hindi/English names, icons, default severity, safety hazards, dedup radius/window, seasonal factors.
- `data/tenants/cg.bhilai/`: 7 agencies (BMC, BSP Town Services, CSPDCL, PHED, PWD, NHAI, triage desk), 6 hand-drawn **approximate** boundaries (2 BMC wards, 2 BSP sectors, the NH-53 corridor, the city extent — all marked `approximate: true`), 176 routing rules, 61 SLA policies with escalation ladders, 5 POIs.
- `data/tenants/cg.bhilai/kb/*.md`: 61 knowledge-base chunks, one per category, with local Hindi/Hinglish word variants (category-specific words kept separate from L1-shared words — a real bug was found and fixed here, see below).
- `data/tenants/cg.bhilai/history.jsonl`: 150 synthetic `CLOSED_CONFIRMED` tickets with realistic resolution-time spreads, used for precedent retrieval and ETA estimation.
- `data/tenants/ka.bengaluru/` exists as an **empty directory** — ticket `#B6` (Bengaluru tenant) is tagged STRETCH and was *not* built. The seed script skips it gracefully.
- `apps/api/src/db/seed.ts` loads all of the above into Postgres. **Idempotent** — safe to re-run.

### Phase C — The Complaint Intelligence Engine (CORE tickets #C1–#C8, #C10; EVIDENCE tickets #C9, #C11)
- `lib/gemini.ts`: the single wrapper for every Gemini call. **Runs in automatic MOCK MODE whenever `GEMINI_API_KEY` is empty** — a deterministic hash-based pseudo-embedding for vector math, and each caller owns its own mock derivation for structured calls (no central fixture registry).
- `modules/jurisdiction/resolve.ts` (#C3): point-in-polygon → nearest-centroid fallback → "no match", pure PostGIS, no AI.
- `modules/intelligence/retrieve.ts` (#C2): hybrid full-text + vector search over the KB and historical precedent, merged with Reciprocal Rank Fusion. In mock mode, ranks on full-text alone (blending in meaningless random vectors would actively hurt correctness — this was discovered by the tests, not decided in advance).
- `modules/intelligence/understand.ts` (#C4): the single multimodal structured call. `category_code` is constrained to a runtime enum built from the tenant's own category list — **an invented category is impossible by construction**, in both live and mock mode.
- `modules/routing/route.ts` (#C5): deterministic SQL lookup, boundary-specific rule beats city-wide, no match → human triage. **The LLM never picks a department.**
- `modules/intelligence/confidence.ts` (#C6): the three-outcome gate (card / amber card / clarify).
- `modules/dedup/find.ts` (#C7): H3 ring pre-filter → PostGIS `ST_DWithin` → time window → cosine similarity, category-aware thresholds.
- `modules/priority/score.ts` (#C8): pure function. **Reproduces the Bible's worked example exactly** (63.5 → 71.9 → 76.1 as time passes), plus a hazard-based safety override that forces Critical regardless of score.
- `modules/intelligence/orchestrate.ts` + `modules/reports/routes.ts` (#C10): `POST /reports/understand` wires everything above into one pipeline with per-stage timings and its own stricter rate limit.
- `modules/proof/dhash.ts` + `modules/proof/intake.ts` (#C9): perceptual difference-hashing for photo-reuse fraud detection. Verified: a resize/crop/recompress of the same photo lands at Hamming distance 5–8 (comfortably under the 10-bit threshold); an unrelated photo lands at 19.
- `eval/golden.jsonl` + `eval/baselines/keyword.ts` + `eval/run.ts` (#C11): 188 real-data-derived test rows, run through the real engine and compared against a faithful port of the *original* prototype's keyword logic. **Measured result: 88.3% category accuracy (our engine) vs. 8.3% (the old keyword baseline)** — the baseline only reads English; this golden set is mostly Hindi/Hinglish.

### Phase G — Voice (CORE tickets #G1–#G5)
- `modules/capture/transcribe.ts` + `modules/capture/routes.ts` + `app.ts` (#G1): STT provider interface that unifies Gemini audio transcription (`STT_PROVIDER=gemini`) and ElevenLabs Scribe (`STT_PROVIDER=eleven`) behind a single `transcribe(audio, mime, deviceKey)` function returning `{ text, lang, ms, provider }`.
- **Automatic fallback:** If the primary provider fails, it logs `STT_FALLBACK` and automatically delegates to the fallback provider.
- **Daily cap enforcement:** Tracks daily volume per device and globally against `STT_DAILY_CAP`.
- `modules/voice/tts.ts` (#G2): TTS service using ElevenLabs with SHA-256 caching logic (`model|voice|text`), mock fallback, and Cloudinary signed uploads.
- `modules/voice/tools.ts` (#G3): Read-only voice tools scoped to `citizen_id` (status, cluster, team, ETA using empirical p85 times).
- `modules/voice/routes.ts` (#G4): `POST /voice/ask` endpoint integrating transcription, Gemini intent routing, tool execution, template response generation, and TTS caching. Includes `voice_turns` auditing.
- `apps/web/src/components/VoiceAssistant.tsx` (#G4): Frontend bottom-sheet UI for "Ask about my complaint" floating button.
- `scripts/tts-prewarm.ts` (#G5): Pre-generates and caches audio for static UI strings and the demo showcase flow (`docs/demo-script.md`) by setting `demoFallback = true`.
- `apps/api/src/modules/intelligence/orchestrate.ts` + `UnderstoodCard.tsx` (#G6): Generates and plays a spoken confirmation template ("मैंने समझा: {ward} में {category}। {agency} को भेज रहे हैं। सही है?") when the UnderstoodCard mounts.

### Real bugs found by tests and fixed (not special-cased)
1. `boundaries.centroid` was never added to the Drizzle schema (Postgres generated columns aren't modeled well by Drizzle) — the nearest-centroid jurisdiction fallback crashed until this was caught and fixed with a raw-SQL migration.
2. The full-text search tokenizer used a `[\p{L}\p{N}]+` regex, which silently fragments Devanagari conjuncts (a virama/vowel-sign are Unicode combining marks, not letters) — "गड्ढा" was being split into meaningless pieces and never matching its own content.
3. KB chunk generation originally put hazard-specific words (e.g. "गड्ढा", "जाम") in a word list *shared* across an entire L1 category group, diluting every subcategory's ranking equally. Fixed by separating category-specific vocabulary from L1-generic vocabulary.
4. CI's Postgres service container (bare `postgis/postgis:17-3.5`) has no pgvector extension at all — would have failed the instant any integration test ran. Replaced with building and running the project's own `infra/db` image.
5. Missing Windows native binding for rolldown (`@rolldown/binding-win32-x64-msvc`) because `node_modules` was originally installed on a macOS darwin-arm64 machine. Resolved by installing the Windows x64 native binary.
6. Synchronously awaiting `aiCalls` database insertion during `transcribe()` blocked HTTP responses when testing in environments without an active database container, causing timeouts. Fixed by making observability logging non-blocking fire-and-forget.
7. Vitest in `apps/api` wasn't inheriting the repo root `.env` file, causing `env.DATABASE_URL` check to fail before tests could execute. Fixed by configuring `envDir: "../../"` and test default `DATABASE_URL` in `vitest.config.ts`.

### Verification standard used throughout Phases 0–C and Phase G
Every ticket above was: typechecked → tested against a **live** Postgres database (not mocked, except where explicitly documented as mock-mode) → re-run 3–5× to rule out flakiness → confirmed against a **from-scratch** Docker container matching CI exactly, before being committed. `eval/results.md` (gitignored, regenerated by `npm run eval`) is the only source of truth for any accuracy number — never hand-type one.

---

## 🟡 Built but NOT YET committed to git

Everything after commit `1aa239c` is uncommitted (no remote exists; the owner chose to stay local): Antigravity's Phases D–G backend, the auth rework, and the new frontend. Check `git status` before committing; `.claude/` and scratch files (`apps/api/check_db.ts`, `apps/api/drop_cols.*`, `find_file.js`) probably should not be committed.

### Frontend (current): cipher designs wired to the API
- `apps/web/src/phone/` and `apps/web/src/desktop/`: two full designs (React 18, plain JS). `src/main.jsx` picks one with `isPhoneLayout()` (width ≤ 820) and lazy-loads only that tree, so their CSS never mixes. It reloads if the window crosses the breakpoint.
- `apps/web/src/shared/`: `api.js` (all backend calls), `store.js` (draft in sessionStorage, token in localStorage), `recorder.js` (MediaRecorder), `device.js`, `config.js` (`VITE_API_URL`; fallback coordinates for Bhilai Ward 14).
- Wired screens (both designs): Home (write), Speak (record → `/voice/transcribe`), Where (geolocation → jurisdiction), Send (AI summary from `/reports/understand`), Phone, Code (OTP; dev code prefilled), Sent (real ticket code), My problems (`/me/reports`), Status (`/tickets/:id/tracking`), Fixed (`confirm-closure`).
- Verified in a browser: full flow at 375 px and 1440 px; production build passes.
- **Not verified:** microphone recording, camera/photo upload (Cloudinary keys not set; uploads are simulated), real GPS (denied in the test browser, so it falls back to Bhilai coordinates), the Fixed / Needs-fix path in a browser, and the status step times (still static).
- **Languages (11):** English, Hindi, Bengali, Marathi, Gujarati, Kannada, Malayalam, Tamil, Telugu, Odia, Assamese. Screen text goes through `T("English text")` in `apps/web/src/shared/i18n.js` (88 strings x 10 languages; falls back to English; `{n}` placeholders). The translations were machine-drafted and need native-speaker review. Not translated: language names (shown in their own script), the status timeline step times, `aria-label` texts for screen readers, and the AI summary (Gemini writes it in the chosen language). Voice clips are in `public/audio/<lang>/` (33 each), generated with `scripts/voice/generate.mjs` from `scripts/voice/lines/<lang>.txt`.
- The older React/TS frontend (#D1–#D10 below) is in `legacy/web/` and is superseded. Its anonymous device-token identity (#D8) and optional phone prompt (#D9) no longer exist.

### Auth model (current)
Phone + OTP only. `POST /auth/request-otp` → `POST /auth/verify-otp` → citizen JWT (30 days). Officers use a separate JWT; the two kinds are not interchangeable. `/voice/transcribe` and `/reports/understand` are anonymous but rate-limited, and their result is saved server-side as a draft; `POST /reports/confirm` (login required) takes only `{draftId, photo}`, so the client cannot choose its own category, priority or location. Tracking, uploads, closure, the SSE stream and the voice assistant need the owner's token.

### Gemini config (fixed Oct 2026)
The model names in `.env` were retired. Now `GEMINI_MODEL_FAST=gemini-3.5-flash-lite`, `GEMINI_MODEL_VISION=gemini-3.5-flash`, `GEMINI_EMBED_MODEL=gemini-embedding-001` (pinned to 768 dimensions with `outputDimensionality`). Structured output uses `responseJsonSchema`. Seed data embedded in mock mode will not match real embeddings until re-seeded.

### OTP delivery (open decision)
No provider is connected; `deliverOtp` only logs. Options and the recommendation are in the conversation notes below and should be turned into a ticket:
1. **Demo / hackathon:** keep `DEMO_MODE` (code shown on screen), or a fixed `OTP_FIXED_CODE`.
2. **WhatsApp OTP** (Meta Cloud API, authentication template; about $0.0014 per message in India, quick to start with Meta's free test number, which only reaches a few pre-added numbers). Fits the planned WhatsApp bot.
3. **SMS:** needs TRAI DLT (company entity, sender ID, template) via MSG91 / 2Factor / Fast2SMS; about ₹0.18–0.25 per SMS. Twilio's *international* route to India needs no DLT but costs more and is not for production.
4. **Firebase Phone Auth:** simplest to integrate, pays per SMS, but moves login to Firebase tokens.

### (legacy) #D1 — Design tokens + typography ✅ built
`src/styles/tokens.css`: CSS custom properties for a warm consumer-app palette (not government blue), the exact 4 status colours from Bible §9 (amber/blue/green + red-outline for reopened), a type scale starting at 18px body / 32px heading, 56px minimum tap targets. `src/styles/fonts.ts`: self-hosted Mukta (Devanagari) + Inter (Latin) via `@fontsource`. `src/components/CategoryIcon.tsx`: one `lucide-react` icon per taxonomy icon name. `src/pages/StyleGuide.tsx`: the dev-only `/styleguide` route rendering every token/icon/script.

### #D2 — i18n with Hindi/English toggle ✅ built
`src/i18n/hi.json` + `en.json` + `LanguageContext.tsx`: a custom (not react-i18next) `useLanguage()` hook, default Hindi-unless-browser-says-otherwise, persisted to `localStorage`, the हिं | EN toggle always visible in `TopBar.tsx`.

### #D3 — Home / Report screen ✅ built
`src/pages/Home.tsx` (605 lines): the full screen shell — heading, mic button, text area, photo button, location chip, submit, "your complaints" section below the fold. Built with three sub-components still deliberately stubbed per their own later tickets (see below).

### #D4 — Push-to-talk voice capture ✅ built and integrated
`src/features/voice/usePushToTalk.ts`: a genuinely thorough implementation — synchronous audio-context unlock in the `pointerdown` handler (so TTS can autoplay later without a second tap), a ref-based state machine to avoid stale closures in async `MediaRecorder` callbacks, MIME-type priority fallback (webm/opus → mp4 → aac), a 500ms watchdog for the iOS "no data ever arrives" bug, a 30s hard cap, haptic ticks wrapped in try/catch.

**Integration:** Fully integrated with the backend `POST /voice/transcribe` endpoint (Phase G, `#G1`). Tested end-to-end with real STT processing (Gemini/ElevenLabs fallback logic).

### #D5 — Photo Input (Camera, Gallery, EXIF & Signed Upload) ✅ built
`apps/api/src/modules/uploads/routes.ts`: `POST /uploads/sign` generates direct Cloudinary upload signatures (with fallback). `apps/web/src/features/photo/usePhotoUpload.ts`: reads EXIF (GPS, timestamp) via `exifr` before canvas resize, resizes to max 1600px (0.8 JPEG), requests signature, and uploads directly. Two-option camera/gallery sheet wired into `Home.tsx`.

### #D6 — Location Chip & Draggable Pin Map ✅ built
`apps/api/src/modules/jurisdiction/routes.ts`: `GET /jurisdiction/resolve?lat=...&lng=...` reverse-labels coordinates to boundary names and landmarks. `apps/web/src/features/location/useLocation.ts`: requests geolocation, flags accuracy > 150m as `"poor"`, accepts manual pin overrides. `LocationPickerModal.tsx` provides interactive Leaflet map with draggable pin.

### #D7 — "What We Understood" Card & Clarify Sheet ✅ built
`apps/web/src/components/UnderstoodCard.tsx`: Screen 2 implementation with category icon, urgent badge for High/Critical, department label, citizen verbatim words, duplicate clustering banner, "Looks right" (हाँ, सही है) and "Change" (बदलें) buttons, and clarifying question variant. Home submit wired to `POST /reports/understand`.

### (legacy) #D8/#D9 — replaced by Phone + OTP login
The device-token session (`POST /session`, `POST /session/phone`, `X-Device-Token`) was removed. See "Auth model" above.

### #D10 — Offline Draft Queue ✅ built
`apps/web/src/features/offline/useOfflineDraft.ts`: if submit fails offline or network drops, saves draft (text, coordinates, photo preview) to IndexedDB with localStorage fallback. Displays amber banner: "नेटवर्क नहीं है — आते ही भेज देंगे". Automatically retries submission upon the browser's `online` event.

### #E1 — State Machine + transition() ✅ built
`apps/api/src/modules/lifecycle/transition.ts`: implements the strict `ALLOWED` state transition table from Bible §9. Enforces atomic `SELECT ... FOR UPDATE` row locks, actor authorization checks, sequential sequence numbering, and updates `tickets.state`, `escalation_level`, and closure timestamps. `POST /tickets/:id/transition` and `POST /reports/confirm` expose the engine.

### #E2 — Hash-Linked Event Ledger + Verify Endpoint ✅ built
`apps/api/src/modules/lifecycle/canonical.ts` & `verify.ts`: deterministic canonical JSON formatting and sequential SHA-256 hash chains (`hash = sha256(prev_hash || ":" || canonical_json(event_without_hash))`). `GET /tickets/:id/verify-chain` verifies the entire ledger chain and detects any tampered payload or sequence break (`broken_at`). Tested with 11/11 passing tests.

### #E3 — Citizen Stage Mapping & Timeline ✅ built
`apps/api/src/modules/lifecycle/citizenView.ts` & `citizenView.test.ts`: implements the mapping from internal database states to the 5 citizen-facing stages (RECEIVED, VERIFIED, ASSIGNED, DISPATCHED, RESOLVED_PROMPT, CLOSED). Builds timeline entries from the event ledger with durations, icons, and bilingual labels. `TRANSFERRED` events are formatted into hand-off rows. Tested with vitest and integrated.

### #E4 — Tracking Screen (Amazon-style view) ✅ built
`apps/api/src/modules/lifecycle/routes.ts`: `GET /tickets/:id/tracking` returns aggregated tracking state. `apps/web/src/pages/Tracking.tsx`: implements the Amazon-style status stepper based on `CitizenStage`, an expandable "View full journey" timeline showing duration offsets, and a Leaflet map that only appears when `DISPATCHED`.

### #E5 — Server-Sent Events (SSE) updates ✅ built
`apps/api/src/modules/lifecycle/routes.ts`: `GET /reports/:id/stream` provides real-time SSE stream of `snapshot`, `state`, and `team_position` updates driven by Postgres `LISTEN/NOTIFY`. `apps/web/src/features/tracking/useTicketStream.ts`: custom EventSource React hook with automatic exponential backoff reconnects and typed event handling. `Tracking.tsx` updated to show a pulsing "Live" indicator.

### #E6 — Simulated team movement ✅ built
`apps/api/src/modules/lifecycle/routes.ts`: `POST /demo/trip/:ticketId` spawns an async background worker that simulates field team movement towards the ticket destination at ~25 km/h. It writes intermediate points to `team_positions` and emits `team_position` SSE ticks every 3s with an ETA. `Tracking.tsx` Leaflet map decoupled map re-renders from coordinate updates to allow smooth `.panTo()` animations when receiving SSE ticks.

### #E7 — Closure loop ✅ built
`apps/api/src/modules/lifecycle/routes.ts`: `POST /reports/:id/confirm-closure` handles citizen feedback (transitioning to `CLOSED_CONFIRMED` or `REOPENED` with escalation). 
`apps/web/src/pages/Tracking.tsx`: displays the "Is it actually fixed?" prompt when the state is `WORK_DONE_PENDING_CONFIRMATION`, showing the before/after photos and the two-button feedback flow.

### #E8 — SLA timers, escalation, priority recompute ✅ built
`apps/api/src/db/boss.ts` and `apps/api/src/modules/lifecycle/worker.ts`: initialized pg-boss and registered cron jobs. 
`processEscalations()` runs every 5m, advancing `escalation_level` if elapsed time breaches SLA ladder, and updating `assignee_officer_id`.
`processPriority()` runs every 15m, evaluating Bible §7 priority formula dynamically and enforcing safety overrides. Both trigger `NOTIFY` events to refresh SSE listeners on state change.
`POST /demo/clock` allows fast-forwarding ticket lifecycle to simulate SLAs in presentations.

### #F1 — Officer login (demo passcodes) ✅ built
`apps/api/src/modules/officers/routes.ts`: `POST /officer/login` validating passcode hash and returning a scoped 24h JWT. `GET /officer/tickets` enforcing agency-level row visibility.
`apps/web/src/pages/OfficerLogin.tsx` and `useOfficerAuth.ts`: login form and localStorage token state.
`apps/api/src/db/seed.ts`: creates demo officers per agency (FIELD_SUPERVISOR to COMMISSIONER) with passcode `1234`.

### #F2 — Officer feeds ✅ built
`apps/api/src/modules/officers/routes.ts`: `GET /officer/stats` (open/breached/fix rate metrics), expanded `GET /officer/tickets` with `categoryIcon` and `boundaryName`, `GET /officer/tickets/:id` (full details + ledger timeline).
`apps/web/src/pages/OfficerConsole.tsx`: 3-pane UI with SLA-sorted queue, Leaflet priority-colored markers, detail drawer with breakdown and mock action buttons.

### #F3 — Field app ✅ built
`apps/api/src/modules/officers/routes.ts`: added `GET /field/jobs` and `POST /field/tickets/:id/location`.
`apps/web/src/pages/FieldApp.tsx`: mobile UI with big job cards, Wake Lock API integration, and mock GPS heartbeat interval every 15s. Calls transition to `DISPATCHED` on start.

### #F4 — Proof gates ✅ built
`apps/api/src/modules/proof/gates.ts`: logic implementing the 5 gates checking dHash reusing (same ticket and last 180 days cross-ticket), PostGIS distance bounds, EXIF time vs ledger dispatch time, and AI confidence.
`apps/api/src/modules/officers/routes.ts`: `POST /field/tickets/:id/work-done` calls gates. On pass, writes to `media` and transitions to `WORK_DONE_PENDING_CONFIRMATION`.
`apps/web/src/pages/FieldApp.tsx`: updated to trigger a file input `<input type="file" capture="environment">` on "Work done" and POST the result.

---

### #G7 — Free-form LLM & Grounding Validator ✅ built
`apps/api/src/modules/voice/routes.ts` & `tools.ts`: added `ESCALATE` intent, `CONFIRM_ESCALATE` flow, and an inline LLM call with a Grounding Validator prompt to ensure LLM facts are backed by real database data.

---

## 🚦 Before deployment

**Not ready to deploy yet.** The full list (blockers, gaps, env variables, order of work, after-deploy checks, who does what) **and the step-by-step deployment plan** (Railway database + API, Cloudinary, Cloudflare Pages, domain and protection) are in [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md). Scope decided 2026-10-06: full deployment on Railway + Cloudinary + Cloudflare; **ElevenLabs is not needed for now** (voice clips are static files, `STT_PROVIDER=gemini`). The big ones: no real OTP provider (and the dev OTP must be off in production), default secrets (`JWT_SECRET`, `PHONE_ENC_KEY`, the `app_rw` password), nothing committed and no git remote, Phase H infrastructure not started, fake seed data and officer passcode `1234`, no Cloudinary keys, no officer/field UI, nothing tried on a real phone, translations and voices not reviewed by native speakers.

Fixed while writing the checklist: the OTP code is no longer printed to the server log in production, and `npm run db:migrate:prod` (runs the compiled `dist/db/migrate.js`) was added because the production image has no `tsx`.

## ❌ Not started

- **Phase H — Deployment:** Railway, Cloudflare, Cloudinary live provisioning.
- **Phase I — Demo hardening & integrity checklist**.

---

## Immediate next steps, in order

0. **OTP delivery provider** (see above) and **commit the work** (decide what to ignore first).
1. **Phase H — Deployment:** `#H2` (Railway: database service).
2. **Phase H — Deployment:** `#H3` (Railway: API service).
3. **Phase H — Deployment:** `#H4` (Cloudinary configuration).

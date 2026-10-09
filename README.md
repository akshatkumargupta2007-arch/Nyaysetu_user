# NyaySetu — न्यायसेतु

### *Bolo. Baaki hum dekh lenge.* — Speak. We'll handle the rest.

A voice-first civic grievance platform for India. A citizen speaks or types a problem in Hindi, English or Hinglish, optionally adds a photo, and submits. The system works out what the problem is, which office owns it, how urgent it is, and whether anyone else nearby has already reported it — without the citizen ever picking a category, a department, or a priority.

Tracking is built to feel like e-commerce order tracking, not a government ticket: **Received → Verified → Assigned → Team dispatched → Resolved?** Every hand-off between departments is shown in plain language. Field officers must upload proof of resolution, and a reused or stock photo is rejected automatically. The ticket is only closed when the **citizen** confirms it's actually fixed.

> **Closed is not fixed.**

Full product rationale, research, architecture and judge-style Q&A: [`NYAYSETU_BIBLE.md`](./NYAYSETU_BIBLE.md).
Dependency-ordered build plan: [`NYAYSETU_BUILD_MAP.md`](./NYAYSETU_BUILD_MAP.md).

---

## What is real, simulated, approximate, or cached (read this before claiming anything)

| Status | What |
|---|---|
| **Real** | Speech-to-text, AI understanding (single multimodal Gemini call, no translation), deterministic routing, duplicate detection, priority scoring, the hash-linked event ledger, photo reuse detection (dHash), the citizen-gated closure loop |
| **Simulated** | Field-team movement in demo mode (`DEMO_MODE=true`) — a stored polyline is animated; real GPS works identically when a field officer has the app open |
| **Approximate** | The seed ward/sector boundary polygons for the demo tenant (hand-drawn, not official GIS data) — labelled `approximate: true` in the data files |
| **Cached** | Fixed-sentence TTS (UI prompts, error lines) and a pre-generated backup of the showcase-flow audio, used only if ElevenLabs is unreachable — every dynamic spoken answer is generated live |

## Architecture, in one line

```
Citizen (voice/text/photo) → AI understands → jurisdiction table + routing rules decide who owns it
→ duplicate check → priority formula → tracked lifecycle with a hash-linked event ledger
→ field proof (fraud-resistant) → citizen confirms or reopens
```

See `NYAYSETU_BIBLE.md` Part 3 for the full pipeline diagram.

## Stack

- **Frontend:** React 18 + Vite + react-router, plain JS (`apps/web`). Two complete designs, `src/phone/` and `src/desktop/`, chosen automatically at load by screen width (≤ 820 px = phone). Citizen app only; the officer/government UI is not built yet. The earlier TypeScript frontend is kept in `legacy/web/`.
- **Login:** phone number + OTP (no passwords). See Limitations.
- **Backend:** Node 22 + Fastify + TypeScript, one service (`apps/api`)
- **Database:** PostgreSQL + PostGIS + pgvector, one database (`infra/db`)
- **AI:** Gemini (understanding, vision, embeddings), ElevenLabs (Scribe STT, v4 TTS)
- **Media:** Cloudinary (direct signed uploads)
- **Jobs:** pg-boss (Postgres-backed queue/cron, no Redis)

## Running it locally

```bash
cp .env.example .env            # fill in GEMINI_API_KEY at minimum (model names in .env.example are current as of Oct 2026)
npm install
docker compose up -d db
npm run db:migrate
npm run seed
npm run dev
```

Web: http://localhost:5173 (phone design on a narrow window, desktop design on a wide one) · API: http://localhost:8080

In development the OTP is returned in the API response and prefilled on the code screen (`devOtp`, only when `NODE_ENV!=production` or `DEMO_MODE`). No SMS/WhatsApp provider is connected yet.

Full stack in Docker: `docker compose up`.

## Verify API keys

```bash
npm run check-keys
```

Prints ✅/❌ for Gemini, ElevenLabs and Cloudinary without crashing on a missing key.

## Tests and evaluation

```bash
npm test                        # unit + integration tests
npm run eval                    # runs eval/golden.jsonl, writes eval/results.md
```

`eval/results.md` is the source of truth for every accuracy/latency number mentioned anywhere in this repo. No number is hand-typed.

## Deploying

Not deployment-ready yet. Read [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) first: blockers, environment variables, order of work and the after-deploy checks.

## Limitations (current)

- Hindi and English are the tested languages. The UI and API accept 11 languages (English, Hindi, Bengali, Marathi, Gujarati, Kannada, Malayalam, Tamil, Telugu, Odia, Assamese) (Gemini reads them directly, no translation step), but each must be tested before it is claimed.
- Background GPS tracking needs the field app's tab to stay open (PWA limitation); a native wrapper would remove this.
- No OTP delivery provider is connected yet (SMS needs TRAI DLT registration; WhatsApp needs a Meta business account). The OTP is shown in dev only.
- The AI preview before login (`/reports/understand`, `/voice/transcribe`) is anonymous but rate-limited; filing, tracking and uploads require login.
- The status screen's step times are still static design placeholders; code, category, place, department and estimate are real.
- Officer/field authentication is a passcode seed, not government SSO, and has no frontend in this repo yet (the backend endpoints exist).

## Credit

Routing's multi-tenant model is inspired by eGov DIGIT's `tenant_id` pattern. The taxonomy maps to Open311 `service_code` and CPGRAMS/Swachhata categories where sensible. Duplicate-merging by community voice is inspired by Janaagraha's "I Change My City."

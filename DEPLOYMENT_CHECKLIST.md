# NyaySetu: pre-deployment checklist and deployment plan

Written 2026-10-06. Read top to bottom. Tick boxes as you go.

- **Part 1 (sections 1 to 7):** the checklist of everything that must be fixed or decided before deploying.
- **Part 2 (section 8):** the step-by-step deployment plan (Railway database and API, Cloudinary, Cloudflare Pages, domain and protection).

**Scope decided:** a full deployment on **Railway (PostgreSQL + API), Cloudinary (photos), Cloudflare (website, domain, protection)**.
**ElevenLabs is NOT needed for now.** See "0. ElevenLabs is out of scope" below.
Related docs: `PROGRESS.md` (what is built), `NYAYSETU_BUILD_MAP.md` Phase H (#H1 to #H10, the original deploy tickets), `NYAYSETU_BIBLE.md` Part 17 (hosting) and Part 19 (security).

## 0. ElevenLabs is out of scope for this deployment

Nothing in the deployed app needs an ElevenLabs account:
- **Voice clips** (the spoken screen instructions in 11 languages) are already generated. They are plain MP3 files in `apps/web/public/audio/<lang>/` and ship with the website. No key is used at run time.
- **Speech-to-text** (when someone records a complaint): set `STT_PROVIDER=gemini`. Gemini handles it with the Gemini key you already need.
- **Live text-to-speech** is not used by the current screens. Leave `ELEVEN_API_KEY` empty. The backend then uses a built-in mock for the unused text-to-speech endpoint, which is harmless.
- **The key pasted in chat earlier** is still exposed. Delete it in the ElevenLabs dashboard even though you are not using ElevenLabs now.
- Needed again only to (a) regenerate a corrected voice clip (`scripts/voice/generate.mjs`, with a key supplied on the command line, never committed) or (b) the future voice bot.

**Legend**
- 🔴 **Blocker.** Do not put the app on the public internet until this is done.
- 🟠 **Should.** Works without it, but it will hurt you (cost, abuse, bad experience).
- 🟢 **Nice.** Do it if there is time.
- 👤 Only the account owner can do it (needs a login, a payment, or a decision).
- 🤖 Claude can do it in the repo once you say go.
- ✅ Already done.

**Two ways to ship. Pick one first, because it changes what you must do.**

| | A. Demo / hackathon | B. Real public launch |
|---|---|---|
| Who uses it | Judges, friends, you | Real citizens |
| OTP | Fixed code or code shown on screen (`DEMO_MODE=true`) | Real WhatsApp or SMS provider |
| Data | Seeded fake tickets are fine | Real data only, no fake tickets |
| Must do | Sections 1, 3, 4, 6 | Everything |

Anything marked 🔴 is a blocker for **B**. For **A** the OTP and seed items are acceptable *on purpose*, but still do the secrets, HTTPS and git items.

---

## 1. Blockers

### 1.1 🔴 👤 Real OTP delivery
**Problem.** No SMS or WhatsApp provider is connected. `deliverOtp()` in `apps/api/src/modules/auth/otp.ts` only logs. Outside production (or with `DEMO_MODE=true`) the API also returns the code in the response so the app is usable on a laptop. On a public server with that on, anyone can log in as any phone number.

**Options** (prices are third-party figures, check the dashboards):
| Route | Effort | Cost | Notes |
|---|---|---|---|
| Demo mode (fixed or on-screen code) | none | free | Not real login. Fine only for option A. |
| **WhatsApp (Meta Cloud API, "authentication" template)** | medium: Meta developer account, WhatsApp Business account, a phone number, template approval | about $0.0014 per message in India | No DLT. Meta's free test number reaches only a few pre-added numbers. Fits the planned WhatsApp bot. **Recommended.** |
| SMS via MSG91 / 2Factor / Fast2SMS | heavy: TRAI **DLT** registration (company entity, sender ID, template) | about ₹0.18 to 0.25 per SMS plus 18% GST | Needs a registered business. |
| Twilio Verify, "international" route to India | easy, no DLT | about $0.05 per verification plus SMS fee | Pricey, demo only. Trial accounts reach only verified numbers. |
| Firebase Phone Auth | easy | per SMS | Moves login to Firebase tokens and replaces our OTP code. |

**Steps (WhatsApp route)**
- [ ] Create a Meta developer account and a WhatsApp Business app.
- [ ] Create an "Authentication" message template and wait for approval.
- [ ] Put the access token and phone-number ID in the server env (new variables, see section 5).
- [ ] 🤖 Implement the provider call inside `deliverOtp()` and keep the demo fallback behind `DEMO_MODE`.
- [ ] Tighten the limits on `POST /auth/request-otp` (see 2.7), because every OTP costs money and can be abused to spam a stranger.

### 1.2 🔴 ✅ OTP code printed in server logs
`deliverOtp()` used to print the full code. **Fixed today:** it now logs only when `NODE_ENV` is not `production` or `DEMO_MODE=true`. Still check the production logs once to confirm no codes appear.

### 1.3 🔴 👤 Secrets and defaults
- [ ] **`JWT_SECRET`** defaults to `dev-secret-change-me`. Set a long random value (at least 32 random bytes). Anyone who knows the default can forge a login token.
- [ ] **`PHONE_ENC_KEY`** can be blank. Set a long random value. It protects stored phone numbers. **Never change it later**, or existing users cannot log in again.
- [ ] **ElevenLabs key you pasted in chat.** Delete it in the ElevenLabs dashboard. You do not need a new one for this deployment (see section 0).
- [ ] Check which keys are in your local `.env`. None of them should ever be committed (`.env` is already in `.gitignore`).
- [ ] Generate random values with: `openssl rand -hex 32`
- [ ] **Postgres role `app_rw`.** `apps/api/sql/0002_ledger_append_only.sql` creates it with the password `change-me-in-production`. Change that password on the production database (`ALTER ROLE app_rw PASSWORD '...'`) and make the API connect as `app_rw`, so the append-only ledger really cannot be edited.
- [ ] Turn on the GitHub secret scan (CI already runs gitleaks) and keep it passing.

### 1.4 🔴 👤 Git: nothing is committed
The last commit is `1aa239c`. About 81 files are uncommitted, and there is **no remote**, so there is nothing to deploy from.
- [ ] Decide what to leave out. Already ignored: `.env`, `node_modules`, `.claude/`. Delete or ignore the scratch files: `apps/api/check_db.ts`, `apps/api/drop_cols.js`, `apps/api/drop_cols.ts`, `find_file.js`.
- [ ] Run `git status`, review, then `git add` and commit in logical chunks.
- [ ] Create a GitHub repository, add it as `origin`, push `main`.
- [ ] Confirm CI (`.github/workflows/ci.yml`) goes green on GitHub.
- [ ] The voice MP3s are about 17 MB (363 files). That is fine for git; no need for Git LFS.

### 1.5 🔴 👤 HTTPS
Microphone, camera and location are blocked by browsers on plain `http://` (except `localhost`). Cloudflare and Railway give HTTPS for free. Check: open the deployed site on a real phone and confirm all three permission pop-ups appear.

### 1.6 🔴 Fake data and demo passcodes must not reach production
`npm run seed` (`apps/api/src/db/seed.ts`) creates **150 fake historical tickets** and **officer accounts for every agency with passcode `1234`**.
- [ ] 🤖 Split the seed into (a) reference data only (taxonomy, tenant, boundaries, agencies, routing rules, SLA policies, knowledge base) and (b) demo data. Production runs only (a).
- [ ] 👤 Real officers need real passcodes (or proper login) before the officer app is used.
- [ ] Run `DEMO_MODE=false` in production. With it on, the demo clock and simulated-team endpoints are available.

### 1.7 🔴 Phase H infrastructure (not started)
Original tickets are in `NYAYSETU_BUILD_MAP.md` (#H1 to #H10).
- [ ] **#H2 Railway database.** Build the custom image from `infra/db` (it has PostGIS, pgvector and pg_trgm). Attach a volume at `/var/lib/postgresql/data`. Set `PGDATA=/var/lib/postgresql/data/pgdata`. No public TCP proxy; the API reaches it over Railway's private network.
- [ ] **#H3 Railway API service** from `apps/api/Dockerfile`. Health check: `/healthz`.
- [ ] **Run migrations.** The production image has no `tsx`, so use the compiled script: `npm run db:migrate:prod` (added today, runs `node dist/db/migrate.js`). Run it as a one-off command on Railway, or as a release step. It must succeed before the API starts serving.
- [ ] **Run the production seed** (reference data only, see 1.6).
- [ ] **#H5 Cloudflare Pages (frontend).** Root `apps/web`, build `npm run build`, output `dist`. **Set `VITE_API_URL=https://<your-api-domain>` as a build variable.** If it is missing, the app calls `<site>:8080` and nothing works.
- [ ] **SPA fallback.** `apps/web/public/_redirects` already exists (`/* /index.html 200`). Confirm it is in `dist/` after the build.
- [ ] **CORS.** The API allows exactly one origin: `PUBLIC_WEB_ORIGIN`. Set it to the real frontend URL (with `https://`, no trailing slash). A wrong value makes every request fail in the browser.
- [ ] **#H4 Cloudinary** (see 2.1).
- [ ] **#H6 Cloudflare:** DNS, SSL "Full (strict)", Always-HTTPS, rate-limit rules, Turnstile (see 3.1).
- [ ] **#H7 Domain** (or free `*.pages.dev` and `*.up.railway.app` URLs).
- [ ] **Run only ONE API instance.** Background jobs (priority recompute, SLA escalation) run inside the API process, so two instances would run them twice.

---

## 2. Should do before real users

### 2.1 🟠 👤 Photo upload (Cloudinary)
Right now no Cloudinary keys are set, so uploads are **simulated** (no real photo is stored, and the fraud checks that need a photo URL cannot run).
- [ ] Create a Cloudinary account and an **unsigned or signed upload preset** (images only, size limit).
- [ ] Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` on the API.
- [ ] Test: take a photo, send, and confirm it appears in Cloudinary and on the ticket.
- [ ] Known gap: the app does not send the photo's perceptual hash (dHash), so "this photo was reused" detection is only partly connected from the citizen side.

### 2.2 🟠 Test on a real phone (nothing below has been tried on a device)
- [ ] **Microphone recording.** Tap the mic, speak, stop. Check the transcript appears (uses Gemini, `STT_PROVIDER=gemini`).
- [ ] **Location pop-up and GPS.** In the test browser the location was denied, so the real-GPS path was never exercised.
- [ ] **Camera** and "choose from gallery".
- [ ] **Sound** on iPhone (ringer switch on, media volume up) and Android. A clip that the browser blocks plays on the first tap.
- [ ] The full flow in each language you will claim.
- [ ] Both designs: phone (narrow) and desktop (wide). To force a layout: add `?ui=phone` or `?ui=desktop` to the URL.
- [ ] The "Is it fixed?" and "needs fix" screens end to end (needs an officer to mark a ticket done first).

### 2.3 🟠 Location outside Bhilai
Today only the Bhilai tenant has data. Anywhere else, the API refuses ("No tenant covers this location"). The web app silently retries at the Bhilai demo coordinates (`VITE_DEMO_FALLBACK`, default on).
- [ ] For a real launch: set `VITE_DEMO_FALLBACK=false` at build time and decide what happens outside covered areas (message, or a "needs triage" catch-all tenant).
- [ ] To add a city: boundaries (ward polygons), agencies and departments, routing rules, SLA hours, officers. See build map #B6 (`data/tenants/ka.bengaluru` is an empty placeholder).
- [ ] The Bhilai boundaries are hand-drawn and marked `approximate: true`. Do not call them official.

### 2.4 🟠 Officer and field screens do not exist
The backend has officer login, queues, field jobs, proof gates and closure, but **no frontend**. Until the government/officer UI is built, nobody can move a ticket past "received", so the citizen's tracking and the "Is it fixed?" loop will never complete in a real deployment.
- [ ] Build the officer console and field app from the government design (separate artifact), or deliver a demo path with the simulated team (`DEMO_MODE`).

### 2.5 🟠 Translations and voices need native review
- [ ] All screen text in 10 languages (`apps/web/src/shared/i18n.js`) was machine-drafted. Odia and Assamese are the least certain.
- [ ] All 363 voice clips were generated from lines I wrote (`scripts/voice/lines/<lang>.txt`). Have a native speaker of each language listen and mark corrections. Regenerate only the bad lines (`node scripts/voice/generate.mjs <lang> --go --only <id>` with `XI_KEY` set).
- [ ] Voices that sound wrong, tags like `[warm]` read aloud, and digit/letter pronunciation (for ticket numbers) are the usual problems.
- [ ] Only claim the languages that were tested end to end.

### 2.6 🟠 Seed data was embedded in mock mode
The knowledge base and the 150 seeded tickets were embedded with the mock (fake) embedder. Real Gemini embeddings will match them poorly.
- [ ] Re-embed after setting the real Gemini key (re-run the reference seed in production with the real key, so the vectors are real from the start).
- [ ] Run `npm run eval` against the real model and read `eval/results.md`. Do not quote accuracy numbers that were not measured.

### 2.7 🟠 Abuse protection and cost control
- [ ] **Turnstile** (Cloudflare bot check) is not set up. Set `TURNSTILE_SECRET` and add the site key to the web build. The Bible says to verify it on the Submit action before any AI call.
- [ ] The AI preview before login (`/reports/understand`, `/voice/transcribe`) is anonymous by design (so people see the summary before logging in). It is rate-limited but **never load-tested**. Each call costs Gemini (and maybe Scribe) money. Decide the per-IP limits and test them.
- [ ] `POST /auth/request-otp` limits: 30 s resend cooldown and 5 per hour **per phone**, plus 10 requests per minute **per IP** (verify-otp: 20 per minute per IP). 10 per minute per IP still allows about 600 OTPs an hour from one address, and each one costs money. Tighten it (for example 5 per hour per IP) and add Turnstile on this route before launch.
- [ ] `STT_DAILY_CAP` (default 300 transcriptions per day). Set it deliberately.
- [ ] Set a **budget alert** on Google AI Studio (Gemini does the understanding, embeddings and speech-to-text now). Watch usage during the event.
- [ ] `STT_PROVIDER=gemini` for this deployment (ElevenLabs is out of scope). Test a spoken complaint in at least Hindi and one other language.

### 2.8 🟠 Model names and API keys
- [ ] Model names in `.env` were retired and fixed today: `gemini-3.5-flash-lite`, `gemini-3.5-flash`, `gemini-embedding-001` (768 dimensions). Google retires models often. Check them again on the day.
- [ ] Voice clips were generated with ElevenLabs model `eleven_v4` and are static files, so no ElevenLabs variables are needed on the server.
- [ ] If a clip needs regenerating later: the ElevenLabs free v4 window is about 13 Oct 2026 (unverified), and the script needs a key passed as `XI_KEY` on the command line.

### 2.9 🟠 Backups and recovery
- [ ] Turn on Railway database backups (or schedule `pg_dump`). The ticket ledger is the product's evidence trail.
- [ ] Write down how to restore, and test it once.
- [ ] Write a rollback plan (#H9): previous image tag, previous Cloudflare deployment.

### 2.10 🟠 Privacy and legal (DPDP Act)
- [ ] The privacy screen says what is collected. Make sure it matches reality: phone number (stored encrypted and hashed), location, photo, transcript. Voice recordings are **not** stored.
- [ ] Decide data retention (the Bible suggests erasing personal identifiers 180 days after closure) and implement or document it.
- [ ] Do not quote specific DPDP rule numbers without checking the official notification.
- [ ] Add contact details and a way to delete an account/data if you will have real users.

---

## 3. Smaller gaps (🟢 unless stated)

- [ ] 🟠 **Status screen step times** ("10:12 AM", "10:20 AM", "2:05 PM") are still placeholders from the design. The real events are in the tracking response. Wire them in.
- [ ] **Login token in the URL for live updates.** The live status stream accepts `?token=` (browsers cannot set headers on `EventSource`). URLs can appear in logs. Keep logs private or switch to a cookie.
- [ ] **No log-out button.** Add one (a link next to Privacy). For now clear local storage.
- [ ] **Screen-reader labels** (`aria-label`) are English only.
- [ ] **A few strings still English** on the code screen ("Please type all 6 digits", "No internet. Please try again.").
- [ ] **Sentry** (`SENTRY_DSN`) and logging (#H8). Optional but worth it for the event.
- [ ] **Language names** are shown in their own script on purpose.
- [ ] **PWA/offline.** The old frontend had an offline draft queue; the new cipher frontend does not.
- [ ] **WhatsApp bot and the Eleven Agents voice bot** are later phases; nothing is built.
- [ ] **Voice:** if a clip is missing, English falls back to the robotic browser voice and other languages stay silent. Ticket numbers are spelled from single-character clips (digits 0 to 9, letters B, H, I, and "dash"). A tenant with other letters needs more clips.
- [ ] **Single tenant.** Everything assumes the Bhilai ticket-code format `BHI-yy-nnnnnn`.
- [ ] **Post-event key rotation** (#H10): rotate every key after the event.

---

## 4. Environment variables

### API (Railway)
| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | 🔴 |
| `PORT` | `8080` | |
| `DATABASE_URL` | Railway private URL, user `app_rw` | 🔴 |
| `PUBLIC_WEB_ORIGIN` | `https://your-web-domain` | 🔴 CORS |
| `JWT_SECRET` | random 32 bytes | 🔴 |
| `PHONE_ENC_KEY` | random 32 bytes, never change | 🔴 |
| `DEMO_MODE` | `false` | 🔴 for launch; `true` only for a demo |
| `DEMO_KEY` | random, if demo mode is on | |
| `OTP_FIXED_CODE` | leave empty in production | 🔴 |
| `OTP_TTL_SECONDS` / `CITIZEN_JWT_TTL` | `300` / `30d` | |
| WhatsApp or SMS provider keys | from the provider | 🔴 new, not yet in code |
| `GEMINI_API_KEY` | key | |
| `GEMINI_MODEL_FAST` / `GEMINI_MODEL_VISION` / `GEMINI_EMBED_MODEL` | see 2.8 | |
| `EMBED_DIM` | `768` | |
| `ELEVEN_*` (key, models, voice IDs) | **leave empty for now** | not needed, see section 0 |
| `STT_PROVIDER` | `gemini` | speech-to-text via Gemini |
| `STT_DAILY_CAP` | e.g. `300` | |
| `CLOUDINARY_CLOUD_NAME`, `_API_KEY`, `_API_SECRET` | from Cloudinary | |
| `TURNSTILE_SECRET` | from Cloudflare | |
| `SENTRY_DSN` | optional | |

### Web (Cloudflare Pages, **build-time** variables)
| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://your-api-domain` 🔴 |
| `VITE_DEMO_FALLBACK` | `false` for a real launch |

Rule: never put a secret in a `VITE_` variable. Everything `VITE_` ends up in the public page.

---

## 5. Order of work (suggested)

1. Decide: demo (A) or launch (B).
2. Clean the repo, commit, push to GitHub (1.4). Make CI green.
3. Create all accounts: GitHub, Railway, Cloudflare, Cloudinary, Meta (WhatsApp). No ElevenLabs account needed.
4. Generate secrets (1.3) and set up the Railway database (1.7).
5. Deploy the API, run `db:migrate:prod`, run the production seed (1.6).
6. Deploy the frontend with `VITE_API_URL`. Fix CORS (`PUBLIC_WEB_ORIGIN`).
7. OTP provider or demo mode (1.1).
8. Cloudinary (2.1), Turnstile and rate limits (2.7).
9. Real-phone test, in every language you will claim (2.2).
10. Native-speaker review (2.5). Fix and regenerate only the wrong clips.
11. Backups and a rollback plan (2.9). Budget alerts (2.7).
12. Walk through the verification list below.

---

## 6. After-deploy verification (all must pass)

- [ ] `https://<api>/healthz` returns ok.
- [ ] The site opens over HTTPS on a real phone and a laptop.
- [ ] A **new** phone number goes: language → phone → OTP → voice → home.
- [ ] A **real** OTP arrives by WhatsApp or SMS (not on screen), and **no code appears in the server logs**.
- [ ] `devOtp` is **not** present in the `request-otp` API response.
- [ ] Opening `/home` while logged out redirects to the phone screen.
- [ ] Write a complaint in two languages: AI summary appears, Send gives a real ticket number, and it appears under "My problems" and "Status".
- [ ] Record a spoken complaint: transcript is correct.
- [ ] Take a photo: it appears in Cloudinary.
- [ ] Allow and deny location, microphone and camera: both paths behave.
- [ ] Sound plays on iPhone and Android.
- [ ] The demo endpoints (`/demo/*`) refuse with `DEMO_MODE=false`.
- [ ] No fake tickets and no officer with passcode `1234`.
- [ ] Two quick OTP requests from one number hit the cooldown. Repeated requests from one IP get limited (429).
- [ ] Database restore from a backup works.
- [ ] Browser dev tools show no secret keys in the page source or network calls.

---

## 7. Who does what

| 👤 Only you (accounts, keys, money, decisions) | 🤖 Claude can do in the repo |
|---|---|
| Choose demo or launch; choose WhatsApp or SMS | Implement the WhatsApp or SMS call in `deliverOtp()` |
| Create Railway, Cloudflare, Cloudinary, Meta accounts and pay | Split the seed (reference vs demo data) |
| Create API keys (Gemini, Cloudinary, Meta), set env vars on the hosts | Add the per-IP OTP limit and Turnstile verification |
| Native-speaker review of translations and voices | Regenerate corrected voice clips (needs an ElevenLabs key then) and translations |
| Provide ward boundaries for new cities | Wire real timeline times into the Status screen, add log-out |
| DLT registration (if SMS) and legal sign-off | Write the migrate/deploy scripts and the rollback notes |
| Real-phone testing and feedback | Build the officer UI once the design is provided |
| Decide the git history and what to publish | Commit and push once you say so |

---

# Part 2: Deployment plan

Target: **Railway** (PostgreSQL database + API), **Cloudinary** (photos), **Cloudflare** (website on Pages, domain, DNS, protection). No ElevenLabs.

Cost and timing figures are approximate and **unverified**. Check each provider's pricing page before you pay.

## 8. Plan, phase by phase

### Phase 1: Prepare the code (Claude, in the repo, no accounts needed)
Goal: nothing in the repo can make a production deployment unsafe.
- [ ] 🤖 **Startup safety check.** In production the API refuses to start if `JWT_SECRET` is the default, `PHONE_ENC_KEY` is empty, `DEMO_MODE` is on, or `OTP_FIXED_CODE` is set.
- [ ] 🤖 **Split the seed.** `npm run seed:prod` = reference data only (taxonomy, Bhilai tenant, boundaries, agencies, routing rules, SLA policies, knowledge base). No fake tickets, no officers with passcode `1234`.
- [ ] 🤖 **Test the API as the restricted database user `app_rw`** locally. Nothing has run this way yet: the background job library (pg-boss) creates its own tables, and the app may need extra permissions. Fix what breaks now, not on Railway.
- [ ] 🤖 **OTP provider.** Implement the WhatsApp (or SMS) call in `deliverOtp()`. Keep demo mode as a fallback.
- [ ] 🤖 **Abuse limits.** Tighten `request-otp` per IP, add the Cloudflare Turnstile check (site key in the web build, secret on the API) on OTP and on the AI preview endpoints.
- [ ] 🤖 **Small gaps:** log-out button, real times on the Status screen, send the photo hash with uploads, translate the last English strings on the code screen.
- [ ] 🤖 **Build check:** `docker build` both production images locally and run the API image against a local database (`/healthz` ok, `db:migrate:prod` ok).
- [ ] 🤖 **Clean and commit:** delete the scratch files, review `git status`, commit in logical chunks.
- [ ] 👤 **Decide:** WhatsApp or SMS for OTP, the domain name, and whether Phase 1 should also include the officer UI (needs the design).

### Phase 2: Accounts and decisions (you)
Do these early because some take days to approve.
- [ ] **GitHub:** create a private repository. 🤖 I add it as `origin` and push.
- [ ] **Railway:** sign up and add a payment method. Create one project, "nyaysetu".
- [ ] **Cloudflare:** sign up (free plan is enough).
- [ ] **Cloudinary:** sign up (free plan to start).
- [ ] **Meta for Developers:** create a developer account and a Business account, add a WhatsApp number, create an **Authentication** template, and submit it. Approval time varies (⚠️ unverified, plan for days). Start this first.
- [ ] **Domain:** buy one (or move an existing one to Cloudflare nameservers). If you have none yet, use the free `*.pages.dev` and `*.up.railway.app` addresses and add a domain later.
- [ ] **Secrets:** generate with `openssl rand -hex 32`: one for `JWT_SECRET`, one for `PHONE_ENC_KEY`, one for the `app_rw` database password, one for the `postgres` password. Store them in a password manager. **Do not paste secrets into chat or commit them.**

### Phase 3: Deploy (I guide step by step; you click and paste in the dashboards)

**3.1 Push to GitHub**
- [ ] `git remote add origin <repo-url>` then `git push -u origin main`. Confirm CI is green.

**3.2 Railway: database**
- [ ] New service from the GitHub repo. Set the **Root Directory** to `infra/db` so it builds the custom image (PostgreSQL 17 + PostGIS + pgvector + pg_trgm). Do not use Railway's stock Postgres template, which lacks one of the extensions.
- [ ] Variables: `POSTGRES_PASSWORD=<postgres secret>`, `POSTGRES_DB=nyaysetu`, `PGDATA=/var/lib/postgresql/data/pgdata`.
- [ ] Add a **Volume** mounted at `/var/lib/postgresql/data`.
- [ ] **No public networking.** Only the API reaches it, over Railway's private network (`<service>.railway.internal:5432`).
- [ ] Turn on backups for the volume (or plan a scheduled `pg_dump`).

**3.3 Railway: API**
- [ ] New service from the same repo. The Dockerfile expects the repo root as its build context, so use the repo root and point it to `apps/api/Dockerfile` (Railway variable `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile`).
- [ ] Variables (see section 4): `NODE_ENV=production`, `PORT=8080`, `PUBLIC_WEB_ORIGIN`, `JWT_SECRET`, `PHONE_ENC_KEY`, `DEMO_MODE=false`, the Gemini key and model names, `STT_PROVIDER=gemini`, `STT_DAILY_CAP`, the Cloudinary and Turnstile values, the OTP provider values. Leave `ELEVEN_*` empty.
- [ ] **First deploy uses the `postgres` user** in `DATABASE_URL` (it creates extensions and the `app_rw` role). Pre-deploy command: `npm run db:migrate:prod`. It must finish with "migration complete".
- [ ] Run the production seed (reference data only). Verify the row counts.
- [ ] Set the `app_rw` password: `ALTER ROLE app_rw PASSWORD '<app_rw secret>'`. Then **switch `DATABASE_URL` to the `app_rw` user** and redeploy.
- [ ] Health check path `/healthz`. **Exactly one replica.** Generate a Railway domain for the API.
- [ ] Check the logs: no OTP codes, no secrets, no errors on boot.

**3.4 Cloudinary**
- [ ] Note the cloud name, API key and API secret. Put them into the Railway API variables.
- [ ] Create an upload preset: images only, size limit (for example 10 MB), a dedicated folder, no overwriting.
- [ ] Optionally restrict allowed formats and enable moderation later.

**3.5 Cloudflare Pages (the website)**
- [ ] Create a Pages project from the GitHub repo. Root = repo root. Build command: `npm install && npm run build -w apps/web`. Output directory: `apps/web/dist`. Set `NODE_VERSION=22`.
- [ ] Build variables: `VITE_API_URL=https://<api-domain>`, `VITE_DEMO_FALLBACK=false`, `VITE_TURNSTILE_SITE_KEY=<site key>`. (Never a secret in a `VITE_` variable.)
- [ ] Confirm `_redirects` is in the output (single-page-app fallback).

**3.6 Domain, DNS and HTTPS**
- [ ] Add the domain to Cloudflare and switch the registrar's nameservers to Cloudflare's.
- [ ] Pages custom domain: `nyaysetu.<tld>` (the website).
- [ ] DNS record `api.nyaysetu.<tld>` as a CNAME to the Railway API domain (orange-cloud proxied). Add the same name as a custom domain in Railway.
- [ ] SSL/TLS mode **Full (strict)**, **Always Use HTTPS**, minimum TLS 1.2, HTTP/3 on.
- [ ] Update Railway `PUBLIC_WEB_ORIGIN` to `https://nyaysetu.<tld>` (CORS), and the Pages `VITE_API_URL` to `https://api.nyaysetu.<tld>`. Redeploy both.

**3.7 Protection (Cloudflare)**
- [ ] **WAF managed rules** on; **Bot Fight Mode** on.
- [ ] **Rate-limit rules** (the free plan allows few rules, ⚠️ verify your limit; pick the most important): `/auth/request-otp` (about 5 per 10 minutes per IP), `/reports/understand` and `/voice/transcribe` (about 20 per minute per IP).
- [ ] **Turnstile** widget created for the site's hostname; site key in the web build, secret on the API.
- [ ] Do not geo-block India-only unless abuse appears (judges may be on roaming SIMs).
- [ ] Live status updates need the API to send a ping every 15 seconds and `Cache-Control: no-cache` so Cloudflare does not drop idle connections (already how the stream works; test it).
- [ ] Keep "Under Attack" mode as an emergency switch.

**3.8 OTP provider live**
- [ ] Put the provider keys in Railway. Test with your own number first, then a second phone.
- [ ] Confirm `devOtp` is **absent** from the `request-otp` response and no code appears in logs.

### Phase 4: Test on real devices, then go live
- [ ] Walk through section 6 (after-deploy verification) on a real iPhone and a real Android phone, on mobile data, in every language you will claim.
- [ ] Native speakers listen to their language's clips and read the screens (2.5). Fix, regenerate only the wrong clips, redeploy.
- [ ] Tell the first testers what is real and what is not (for example: officer screens, location outside Bhilai).
- [ ] Set budget alerts (Gemini, Railway, Cloudinary). Watch the first day closely.

### Rollback and recovery
- **API bad deploy:** in Railway, redeploy the previous successful deployment.
- **Website bad deploy:** in Cloudflare Pages, promote the previous deployment.
- **Bad migration or data:** restore the database from the latest backup. **Test this restore once before launch.**
- **Leaked key:** rotate it in the provider, update Railway, redeploy. Rotating `PHONE_ENC_KEY` is not safe (it would lock out existing users), so treat that key as write-once.
- **Abuse spike:** turn on Cloudflare "Under Attack" mode, lower the rate limits, set `STT_DAILY_CAP` lower.

### Rough effort and waiting time (approximate, unverified)
| Phase | Hands-on | Waiting |
|---|---|---|
| 1 Prepare the code | about 1 to 2 working sessions for Claude | none |
| 2 Accounts | 1 to 2 hours for you | Meta template approval (days), domain nameserver change (minutes to hours), DLT if you choose SMS (days to weeks) |
| 3 Deploy | 2 to 4 hours together | DNS propagation, first builds |
| 4 Test | half a day to a day | native-speaker review |

### What stays out of scope for now
ElevenLabs (live voice, regeneration, the voice bot), the WhatsApp bot, the officer and field UI (until the government design is provided), cities other than Bhilai.

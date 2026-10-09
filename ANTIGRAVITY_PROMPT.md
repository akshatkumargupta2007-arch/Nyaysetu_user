You're picking up an existing project called NyaySetu. Before writing any code, read these three files in the project root, in this order:

1. **`PROGRESS.md`** — tells you exactly what's done, tested, and committed vs. what's stubbed or untested. Read this first every session; it's kept up to date.
2. **`NYAYSETU_BIBLE.md`** — the full product rationale: what we're building, why, every architecture decision, the data model, the demo story. This is the "why." Don't make a product or architecture decision without checking it against this doc.
3. **`NYAYSETU_BUILD_MAP.md`** — the entire project broken into numbered tickets (`#A1`, `#B3`, `#D4`, `#G1`, etc.), grouped into phases (0, A, B, C, D, E, F, G, H, I), each with: Priority tag, Window tag, what it's Blocked by, what to Build, what to Watch out for, how to Test it, and when it's Done. This is the "how." **Always work ticket by ticket, in the exact numbered order, respecting the Blocked-by dependencies.** Don't freelance ahead or skip around.

## How this project has been worked on so far

Every ticket, when it was built, followed this discipline — keep doing it the same way:

1. Write the code for the ticket.
2. Typecheck it.
3. **Test it against a real, live local Postgres database** (via `docker compose`), not just mocks, unless the Bible/build map explicitly says something is mock-only (e.g. the AI engine has a documented MOCK MODE when `GEMINI_API_KEY` is unset — read `apps/api/src/lib/gemini.ts`'s top comment before assuming anything is "fake").
4. Re-run the tests 3+ times to rule out flakiness before trusting them.
5. If a test fails, **find the real root cause and fix it properly** — don't loosen the test to make it pass, and don't special-case around a bug. Several real bugs were found this way during earlier phases (see "Real bugs found" in `PROGRESS.md`); that's the standard to hold yourself to.
6. Only commit once everything above is green. Write commit messages that honestly describe what was built, what was tested, and what's still stubbed — never claim something works end-to-end if it hasn't actually been run end-to-end.

## What's already done (read `PROGRESS.md` for full detail)

- **Backend (Phases 0, A, B, C): fully built, tested, and committed to git.** Real Postgres + PostGIS + pgvector database, a real Fastify API, the full Complaint Intelligence Engine (jurisdiction resolution, hybrid retrieval, the constrained AI "understand" call, deterministic routing, duplicate detection, priority scoring, photo-reuse fraud detection), and an eval harness with real measured numbers. 71 tests passing. 4 commits, all local — **there is no git remote configured**, so don't assume you can push anywhere until one is set up.
- **Frontend (Phase D): tickets `#D1`–`#D4` are built** (design tokens/typography, Hindi/English i18n, the full Home/Report screen UI, and a genuinely thorough push-to-talk voice capture hook) **but this work is currently UNCOMMITTED** — check `git status` first and get it committed (or ask whether it should be) before building on top of it blindly.
- `#D4`'s voice capture hook calls `POST /voice/transcribe`, which **does not exist on the backend yet** — that's ticket `#G1`.

## Your task: start with `#G1`

Ticket `#G1` in `NYAYSETU_BUILD_MAP.md` (Phase G) is the STT provider switch — it's the highest-leverage next piece of work because the frontend half (`#D4`) is already built and waiting for exactly this endpoint. Read the full `#G1` ticket text in the build map (Build / Watch out / Test / Done when) and also read Bible §12 and §17.5b, which this ticket directly implements — they specify:

- **Local development uses Gemini for STT** (`STT_PROVIDER=gemini` in `.env`), not ElevenLabs — this saves ElevenLabs Scribe credits for staging/the real demo.
- **Production/deployed environments use ElevenLabs Scribe** (`STT_PROVIDER=eleven`).
- Both providers must sit behind one `transcribe(audio)` function so the rest of the app never knows which one ran.
- If the configured provider fails or hits its daily cap, it must **fall back automatically** to the other provider and log it — never leave the citizen with a dead mic.

Build it as its own ticket: a `POST /voice/transcribe` route in `apps/api`, the provider-switch logic, and tests against a live setup (you can test the Gemini path for real since mock/Gemini mode doesn't need a paid key the way live ElevenLabs does — check `docs/accounts.md` for what keys are actually configured before assuming ElevenLabs is testable yet).

Once `#G1` is done and tested, **go back to `PROGRESS.md`, update it honestly with what you just built and verified**, and then continue down the build map in ticket order — don't stop and ask what to do next each time; the build map already tells you.

## Ground rules

- Never invent a department, category, or any other business fact that should come from `data/` or the database — that's the whole architectural point of this project (read Bible §3 if this isn't obvious why).
- Never claim a number (accuracy, latency, test count) without it coming from an actual test/eval run you just did. `eval/results.md` is generated by `npm run eval`, never hand-edited.
- Don't modify `infra/db/Dockerfile` back to `FROM postgis/postgis` — that was a deliberately-fixed bug (see `PROGRESS.md`'s "Known environment gotchas").
- Docker Desktop has to be running for any database-backed command to work. If `docker compose` commands fail with a socket-connect error, that's why — start Docker first.

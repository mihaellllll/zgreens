# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Two servers must run simultaneously in separate terminals:

```bash
# API server (port 3001) — run from server/
cd server && npm run dev       # uses nodemon for auto-reload

# React client (port 5173) — run from client/
cd client && npm run dev
```

Other useful commands:

```bash
# After changing prisma/schema.prisma:
cd server && npx prisma db push

# Open Prisma Studio (DB GUI):
cd server && npx prisma studio

# Production build of client:
cd client && npm run build
```

No test suite is configured.

## Architecture

### Overview

Full-stack app split into `server/` (Node/Express/Prisma) and `client/` (React/Vite). The client dev server proxies all `/api/*` requests to `localhost:3001`, so the axios base URL is simply `/api` — no CORS handling needed in dev.

**The app is fully API-backed (PostgreSQL on Railway).** All grow-rack, seed, harvest, and sales data lives in the database — no localStorage data stores remain (except auth token and UI session state).

**Per-user data isolation:** Every model is scoped to `userId` — each user sees only their own data. All routes filter by `req.user.id`.
- `TraySlot` — unique per `[regal, slot, userId]`
- `SeedStorage` — unique per `[cropKey, userId]`
- `CropType` — unique per `[name, userId]`
- `Harvest`, `Sale`, `Batch`, `Customer`, `Task` — all have `userId`
- `Cost` and `SaleItem` have no userId but are always accessed through their parent (`Batch` / `Sale`) which is user-scoped

### Server

- **Entry**: `server/index.js` — mounts all routers under `/api/<resource>`
- **Auth**: JWT stored client-side in localStorage; `server/middleware/auth.js` verifies the Bearer token and attaches `req.user` (id, email, name)
- **Database**: PostgreSQL on Railway via Prisma ORM. Each route file instantiates its own `new PrismaClient()` — this is acceptable for the current scale
- **JWT secret**: hardcoded fallback `'zgreens-secret-key'`; override via `JWT_SECRET` env var

**Key business logic in `server/routes/batches.js`:**
- `generateTasks()` is called on batch creation and on every status change. It auto-creates watering, blackout, and harvest tasks. Tasks are not deduplicated — avoid calling status updates repeatedly.
- `expectedHarvestDate` is computed at creation time as `sowDate + cropType.growDays`
- Seed cost is auto-added as a `Cost` record on batch creation if `cropType.seedCostG > 0`

**Profitability** (`server/routes/profitability.js`): aggregates all batches grouping by crop name. Revenue from `SaleItem.subtotal`, costs from `Cost.amount`. Margin and ROI computed server-side.

**Dashboard** (`server/routes/dashboard.js`): returns active batch count, upcoming harvests (next 7 days), pending task count for current user, week-to-date revenue, and top crop by average profit.

### Client

- **Auth context**: `src/hooks/useAuth.jsx` — `AuthProvider` wraps the whole app; `useAuth()` returns `{ user, login, logout }`. Token and user object persisted to localStorage.
- **API client**: `src/api/client.js` — axios instance that injects Bearer token and redirects to `/login` on 401.
- **Routing**: `App.jsx` uses a `ProtectedLayout` component that redirects to `/login` if no user.
- **Global CSS utilities**: `.input`, `.btn-primary`, `.btn-secondary` defined as Tailwind `@layer components` in `src/index.css` — use on all form elements.
- **Modals**: `components/Modal.jsx` handles Escape key and backdrop click to close; pass `onClose` prop.

### Client-side Data Layer (localStorage)

All grow-rack and seed data lives in localStorage with these keys:

| Key | Shape | Owner |
|-----|-------|-------|
| `zgreens_regals_v1` | `Array(4) of Array(16)` — each slot `null \| { cropKey, plantedDate, notes }` | `Batches.jsx` |
| `zgreens_seed_storage` | `{ [cropKey]: grams }` | `storageUtils.js` |

**`src/data/cropData.js`** — the single source of truth for all 5 crop recipes (Dragoljub, Brokula, Gorušica, Crvena Rotkvica, Crveni Bosiljak). Contains `CROP_RECIPES` array and `getCurrentPhase(crop, plantedDate)` helper. Each recipe includes: `key`, `color`/`bgLight`/`stemColor`/`leafColor`/`leafShape`, `seedsPerTray`, `harvestDay`, and a `phases` array of `{ day, label, stage }` objects. Stages are: `seed | sprout | blackout | light | growing | ready`.

**`src/data/storageUtils.js`** — CRUD helpers (`getStorage`, `addSeeds`, `deductSeeds`, `getSeedAmount`) wrapping the `zgreens_seed_storage` key. `Batches.jsx` calls `deductSeeds(cropKey, crop.seedsPerTray)` automatically when a tray is planted.

### Page Summary

| Route | File | Data source |
|-------|------|-------------|
| `/` | `Dashboard.jsx` | API |
| `/crops` | `CropLibrary.jsx` | `CROP_RECIPES` (hardcoded) + API for custom crops |
| `/batches` | `Batches.jsx` | `zgreens_regals_v1` localStorage |
| `/storage` | `Storage.jsx` | `zgreens_seed_storage` localStorage |
| `/tasks` | `Tasks.jsx` | Reads `zgreens_regals_v1`, generates tasks client-side |
| `/profitability` | `Profitability.jsx` | API |
| `/sales` | `Sales.jsx` | API |

### Batches / Plitice Architecture

**Navigation hierarchy**: Regal overview (4 cards) → click regal → `ShelfView` (4 shelves × 4 trays = 16 slots). The `← Natrag` button returns to overview.

`Batches.jsx` also reads `?regal=&slot=` query params — `Tasks.jsx` navigates here with those params when a task bubble is clicked, so the correct tray detail opens automatically.

**Tray slot index** = `shelfIndex * 4 + trayInShelf` (0–15 within a regal).

**Plant SVG visual** (`TrayPlantSVG`) renders different numbers/heights of stems+leaves per `stage`. The `stage` is determined at render time by `getCurrentPhase()` from the stored `plantedDate`, so visuals advance automatically each day without any stored state update.

### Tasks / Zadaci Architecture

Tasks are **generated on-the-fly** from localStorage regal data — there is no stored task list. `generateTasks()` in `Tasks.jsx` iterates all 64 tray slots and, for each planted tray, emits:
- A **green** (`priority: 'next'`) bubble for `phases[phaseIdx + 1]`
- A **yellow** (`priority: 'later'`) bubble for `phases[phaseIdx + 2]`

`daysUntil` = `nextPhase.day − daysElapsed`. Tasks refresh on `window.focus`.

### Crop Library / Knjižnica Architecture

Always renders all 5 `CROP_RECIPES` as interactive 3D-tilt cards (mouse-tracking CSS perspective transform). Also loads API crops and shows any whose name doesn't match a hardcoded recipe as simple "Vlastite Sorte" cards. The "Add Crop" modal still saves to the API.

### Data Relationships (API side)

- `Sale.total` is **stored** (not computed on read) — sum from `items[].subtotal` before saving
- `SaleItem.subtotal` = `quantityG × pricePerG` — stored redundantly
- `Cost` records cascade-delete when their `Batch` is deleted; `Task.batchId` set to null on batch delete
- No multi-tenancy on batches, crops, sales, or customers — all users share data; only `Task` is scoped to `userId`
# Agent Instructions

> This file is mirrored across CLAUDE.md, AGENTS.md, and GEMINI.md so the same instructions load in any AI environment.

You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system fixes that mismatch.

## The 3-Layer Architecture

**Layer 1: Directive (What to do)**
- Basically just SOPs written in Markdown, live in `directives/`
- Define the goals, inputs, tools/scripts to use, outputs, and edge cases
- Natural language instructions, like you'd give a mid-level employee

**Layer 2: Orchestration (Decision making)**
- This is you. Your job: intelligent routing.
- Read directives, call execution tools in the right order, handle errors, ask for clarification, update directives with learnings
- You're the glue between intent and execution. E.g you don't try scraping websites yourself—you read `directives/scrape_website.md` and come up with inputs/outputs and then run `execution/scrape_single_site.py`

**Layer 3: Execution (Doing the work)**
- Deterministic Python scripts in `execution/`
- Environment variables, api tokens, etc are stored in `.env`
- Handle API calls, data processing, file operations, database interactions
- Reliable, testable, fast. Use scripts instead of manual work.

**Why this works:** if you do everything yourself, errors compound. 90% accuracy per step = 59% success over 5 steps. The solution is push complexity into deterministic code. That way you just focus on decision-making.

## Operating Principles

**1. Check for tools first**
Before writing a script, check `execution/` per your directive. Only create new scripts if none exist.

**2. Self-anneal when things break**
- Read error message and stack trace
- Fix the script and test it again (unless it uses paid tokens/credits/etc—in which case you check w user first)
- Update the directive with what you learned (API limits, timing, edge cases)
- Example: you hit an API rate limit → you then look into API → find a batch endpoint that would fix → rewrite script to accommodate → test → update directive.

**3. Update directives as you learn**
Directives are living documents. When you discover API constraints, better approaches, common errors, or timing expectations—update the directive. But don't create or overwrite directives without asking unless explicitly told to. Directives are your instruction set and must be preserved (and improved upon over time, not extemporaneously used and then discarded).

## Self-annealing loop

Errors are learning opportunities. When something breaks:
1. Fix it
2. Update the tool
3. Test tool, make sure it works
4. Update directive to include new flow
5. System is now stronger

## File Organization

**Deliverables vs Intermediates:**
- **Deliverables**: Google Sheets, Google Slides, or other cloud-based outputs that the user can access
- **Intermediates**: Temporary files needed during processing

**Directory structure:**
- `.tmp/` - All intermediate files (dossiers, scraped data, temp exports). Never commit, always regenerated.
- `execution/` - Python scripts (the deterministic tools)
- `directives/` - SOPs in Markdown (the instruction set)
- `.env` - Environment variables and API keys
- `credentials.json`, `token.json` - Google OAuth credentials (required files, in `.gitignore`)
- `costs.csv` - Persistent cost log at project root. Append-only; one row per paid API call. Never delete.

**Key principle:** Local files are only for processing. Deliverables live in cloud services (Google Sheets, Slides, etc.) where the user can access them. Everything in `.tmp/` can be deleted and regenerated.

## Cloud Webhooks (Modal)

The system supports event-driven execution via Modal webhooks. Each webhook maps to exactly one directive with scoped tool access.

**When user says "add a webhook that...":**
1. Read `directives/add_webhook.md` for complete instructions
2. Create the directive file in `directives/`
3. Add entry to `execution/webhooks.json`
4. Deploy: `modal deploy execution/modal_webhook.py`
5. Test the endpoint

**Key files:**
- `execution/webhooks.json` - Webhook slug → directive mapping
- `execution/modal_webhook.py` - Modal app (do not modify unless necessary)
- `directives/add_webhook.md` - Complete setup guide

**Endpoints:**
- `https://nick-90891--claude-orchestrator-list-webhooks.modal.run` - List webhooks
- `https://nick-90891--claude-orchestrator-directive.modal.run?slug={slug}` - Execute directive
- `https://nick-90891--claude-orchestrator-test-email.modal.run` - Test email

**Available tools for webhooks:** `send_email`, `read_sheet`, `update_sheet`

**All webhook activity streams to Slack in real-time.**

## Summary

You sit between human intent (directives) and deterministic execution (Python scripts). Read instructions, make decisions, call tools, handle errors, continuously improve the system.

Be pragmatic. Be reliable. Self-anneal.

Also, use Opus-4.5 for everything while building. It came out a few days ago and is an order of magnitude better than Sonnet and other models. If you can't find it, look it up first.

---

## Environment & Setup

**Python**: This machine has two Python installs. Always use `python` (3.10.7, has all packages). Never use `python3` (maps to 3.14, packages not installed).

```bash
pip install -r requirements.txt   # install all dependencies
modal deploy execution/modal_webhook.py  # deploy webhooks
```

**Google Auth — two modes:**
- `credentials.json` is a **service account** key (not OAuth). It can read/write existing sheets but **cannot create new sheets** (no Drive quota).
- To use a sheet: create it in Google Drive, share it with `clientele@aerobic-stream-481716-p7.iam.gserviceaccount.com` (Editor), then open by URL.
- `token.json` — OAuth user token, generated on first browser login. Takes priority over service account when present.

**Windows encoding**: Croatian and other non-ASCII characters crash terminal output (cp1252). Always open files with `encoding='utf-8'` and use `ensure_ascii=True` when writing JSON that scripts will read back.

**`.env` parse warnings**: The section-separator comments (`# ---`) in `.env` cause dotenv warnings. These are harmless — keys are read correctly.

## Available Directives → Scripts

| Directive | Script | What it does |
|---|---|---|
| `gmaps_lead_generation.md` | `gmaps_lead_pipeline.py` | Scrape Google Maps → enrich websites → Google Sheet |
| `scrape_leads.md` | `scrape_apify.py` / `scrape_apify_parallel.py` | Apify lead scraping → Google Sheet |
| `instantly_autoreply.md` | `instantly_autoreply.py` | Auto-reply to Instantly.ai campaign emails |
| `create_proposal.md` | `create_proposal.py` | PandaDoc proposal from client info or transcript |
| `upwork_scrape_apply.md` | `upwork_apify_scraper.py` + `upwork_proposal_generator.py` | Scrape Upwork jobs → generate cover letters + proposals |
| `jump_cut_vad.md` | `jump_cut_vad_singlepass.py` | Auto jump-cut video editor using voice activity detection |
| `google_serp_lead_scraper.md` | `scrape_apify.py` | SERP-based lead scraping |
| `pitch_email.md` | Gmail API via `token.json` | Croatian pitch email from Luka Josić / ZGreens to leads |
| `person_research.md` | `research_person.py` | Web research on any person → structured profile in Google Sheet |

**Gmail sending setup:**
- `credentials_gmail.json` — OAuth Desktop App credentials (separate from service account)
- `token.json` — generated once via browser login: `python -c "from google_auth_oauthlib.flow import InstalledAppFlow; flow = InstalledAppFlow.from_client_secrets_file('credentials_gmail.json', ['https://www.googleapis.com/auth/gmail.send']); creds = flow.run_local_server(port=0); open('token.json','w').write(creds.to_json())"`
- Gmail API must be enabled in Google Cloud Console
- OAuth consent screen test user `whathappened8008@gmail.com` must be added (app not verified)
- Use `python` (3.10), not `python3`

**Active lead sheet**: https://docs.google.com/spreadsheets/d/1fuw_Y5NsmU81Y3ZYGisHEiKrNOkeGGB1MXiWbVrRhLk/edit
- 158 Zagreb leads: restaurants, fine dining, vegan, catering, juice bars, hotels, wellness, markets
- Shared with service account `clientele@aerobic-stream-481716-p7.iam.gserviceaccount.com`

**Cost tracking**: `execution/cost_logger.py` is a shared utility imported by all scripts that make paid API calls. It appends one row to `costs.csv` per call. Functions: `log_anthropic(script, msg_response)`, `log_apify(script, actor, items)`, `log_pandadoc(script)`. Thread-safe. Never raises — silently no-ops on failure so it can't break calling scripts.

**Known missing file**: `execution/extract_website_contacts.py` is imported by `gmaps_lead_pipeline.py` but does not exist. The pipeline will fail at Step 2 (website enrichment) until this is created.

**Workaround**: Use `scrape_google_maps.py` (Maps data only, no website enrichment) then write results to an existing sheet via `gspread` directly.

**Person research known issues (untested, paused on no API credits):**
- DuckDuckGo returned 0 results in test run — POST requests may be blocked intermittently. TODO: add GET fallback with retry.
- `beautifulsoup4` was not installed — fixed by running `python -m pip install beautifulsoup4`.
- Script requires UTF-8 stdout fix for Croatian names — already applied via `sys.stdout.reconfigure(encoding='utf-8')`.
# Production Auditor Memory — ZGreens

## Project Architecture
- Client: React + Vite (port 5173), Tailwind, global `.input/.btn-primary/.btn-secondary` in `src/index.css`
- Server: Node/Express, Prisma ORM, SQLite (port 3001)
- Auth: JWT in localStorage, hardcoded fallback secret `'zgreens-secret-key'`
- No test suite configured

## Data Split — CRITICAL ARCHITECTURAL FLAW
Two completely separate data planes that NEVER sync:
- API-backed: Dashboard, Profitability, Sales, CropLibrary (DB via Prisma)
- localStorage-only: Batches/Plitice (`zgreens_regals_v1`), Storage/Skladište (`zgreens_seed_storage`), Tasks/Zadaci
- The API "Batches" concept (DB) and localStorage "Plitice" concept are DIFFERENT THINGS with no connection

## Key Files
- `client/src/pages/Batches.jsx` — localStorage-only, 4 regals × 16 slots, regal overview + shelf view
- `client/src/pages/CropLibrary.jsx` — 5 hardcoded + API custom crops, 3D tilt cards
- `client/src/pages/Storage.jsx` — localStorage-only, SVG jute bag visuals per crop
- `client/src/pages/Tasks.jsx` — derived from localStorage, auto-generated, no persistence
- `client/src/pages/Dashboard.jsx` — API-backed, English UI
- `client/src/pages/Profitability.jsx` — API-backed, English UI, Recharts bar chart
- `client/src/pages/Sales.jsx` — API-backed, English UI
- `client/src/data/cropData.js` — 5 hardcoded CROP_RECIPES (dragoljub, brokula, gorusica, rotkvica, bosiljak)
- `client/src/data/storageUtils.js` — read/write localStorage for seed grams
- `client/src/components/Sidebar.jsx` — mixed Croatian/English labels

## Systemic Issues (First Audit — 2026-02-20)
1. LANGUAGE CHAOS: Dashboard/Profitability/Sales are English; Batches/Storage/Tasks/CropLibrary are Croatian. Sidebar mixes both. `Sign out` in English, nav labels Croatian.
2. DUAL DATA ARCHITECTURE: localStorage crops ≠ API crops. Profitability has zero awareness of actual planted trays. Dashboard KPIs reflect API batches that don't exist in the UI farmers actually use.
3. NO DATA PERSISTENCE GUARANTEE: localStorage cleared = all planting history gone. No backup, no export, no sync.
4. STORAGE DEDUCTION BUG: `deductSeeds()` fires on `PlantingForm` submit before `onPlant` saves the tray. If modal crashes after deduction, seeds vanish with no tray created.
5. SEED DEDUCTION NOT REVERSIBLE: "Ubrano!" and "Propalo" both call `clearSlot()` — neither returns seeds to storage. Seeds lost permanently on clear regardless of outcome.
6. TASKS ARE DERIVED, NOT STORED: Tasks page re-generates from localStorage on every mount. No completion tracking, no "mark done," no history.
7. HARVEST OVERDUE SILENT: Overdue trays get a red badge on RegalCard but there is no notification, no push, no sound. A farmer misses the UI and the crop dies.
8. CRVENI BOSILJAK MISSING HARVEST PHASE: `cropData.js` phases array for bosiljak ends at day 12 `growing` — no `ready` phase. `getCurrentPhase` will never return `ready` for basil. Harvest day 14 is set but unreachable via phase lookup.
9. STYLE INCONSISTENCY: Batches/Storage/Tasks use 100% inline styles. Dashboard/Sales/Profitability use Tailwind `.card`/`.btn-primary` etc. Two completely different styling philosophies in one app.
10. NO MULTI-TENANCY: API entities (sales, customers, crops, profitability) are shared across all users.
11. HARDCODED JWT SECRET: `'zgreens-secret-key'` in server code.
12. STORAGE-ONLY CROPS EXCLUDED FROM PROFITABILITY: Custom API crops never appear in localStorage-based Batches. You cannot grow a custom crop and have it affect sales/profit.
13. CONFIRM() FOR DESTRUCTIVE ACTIONS: Uses browser `confirm()` dialog for delete (Sales, CropLibrary). Violates design consistency, breaks in iframes.
14. SEED DEDUCTION ALLOWS NEGATIVE: Warning shown if insufficient seeds, but `submit` button is disabled only when `!hasEnough`. However, `deductSeeds()` clamps at 0, so deducting 50g from 30g stock leaves 0g — the 20g deficit is silently absorbed.

## Pages Reviewed
- All 7 pages reviewed on 2026-02-20 (first full audit)
- Verdict tier: Hobby/Prosumer — not production-ready

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

**Critical distinction:** The app has two coexisting data systems:
- **API-backed** (server + SQLite): crops, legacy batch records, sales, tasks (old system), profitability, customers
- **localStorage-only** (client): tray/regal grow rack state, seed inventory, and auto-generated tasks (new system)

The Plitice (Batches), Skladište (Storage), and Zadaci (Tasks) tabs are **entirely client-side** and do not touch the API.

### Server

- **Entry**: `server/index.js` — mounts all routers under `/api/<resource>`
- **Auth**: JWT stored client-side in localStorage; `server/middleware/auth.js` verifies the Bearer token and attaches `req.user` (id, email, name)
- **Database**: SQLite file at `server/prisma/dev.db` via Prisma ORM. Each route file instantiates its own `new PrismaClient()` — this is fine for SQLite
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

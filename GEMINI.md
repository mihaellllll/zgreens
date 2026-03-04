# CLAUDE.md
> Keep GEMINI.md in sync after every edit (other agents read it).

## Role
Senior full-stack dev. Always inspect changes for bugs before finishing. High-end, polished UX only — no rough edges shipped.

## App
Microgreens farm management — Electron desktop, **local SQLite** (no Railway), React/Vite frontend, Node/Express/Prisma backend.

## Language Rule
**All UI text in Croatian.** No English strings in UI (code/keys OK). Examples: Odjava, Berba, Plitice, Regal, Polica, Tamna faza. Server error messages in Croatian too.

## No confirm() Dialogs
Never `confirm()` or `alert()`. Use inline two-step state: first click → `setPendingDelete(id)`, second click → execute action.

## Dev Commands
```bash
# Fast iteration (no rebuild needed for client):
cd server && node index.js      # API on :3001
cd client && npm run dev        # Vite on :5173 (proxies /api → 3001)

# Electron:
npm run electron:dev            # from root (needs client build first)
cd client && npm run build      # rebuild after client changes

# Schema changes:
cd server && npx prisma generate && npx prisma db push
cd server && npx prisma studio  # DB GUI
```

## Architecture

**Stack**: `electron.js` → `server/index.js` (Express/Prisma) → serves `client/dist/` + `/api/*`. Client uses relative `/api` baseURL.

**Auth**: JWT in localStorage. `server/middleware/auth.js` attaches `req.user` (id, email, name). 7-day expiry.

**Per-user isolation**: Every model scoped to `userId`. All routes filter by `req.user.id`. See MEMORY.md for model list.

**Key server routes**:
- `batches.js` — `generateTasks()` on create/status change; auto-adds seed Cost record
- `profitability.js` — aggregates Sales (SaleItems) + Harvests + Batch costs; no double-counting
- `dashboard.js` — weeklyRevenue, lastWeekRevenue, totalCapacity, lowSeeds, upcoming harvests, pendingTaskCount
- `ai.js` — Groq SDK or AI_PROXY_URL; reads `groqApiKey` from DB first (falls back to `GROQ_API_KEY` env); 503 if neither; auth endpoints: GET /auth/me, PATCH /auth/settings
- `trays.js` — `POST /:r/:s/plant` atomically upserts tray + deducts seeds; `DELETE /:r/:s` deletes slot + batch tasks

**Client entry points**:
- `src/hooks/useAuth.jsx` — `AuthProvider`, `useAuth()` → `{ user, login, logout }`
- `src/api/client.js` — axios + Bearer token + 401 → /login redirect
- `src/data/cropData.js` — `CROP_COLORS`, `buildPhases()`, `apiCropToRecipe()`, `getCurrentPhase()`
- `src/utils/farmLogic.js` — farm business logic (phases, dates, dashboard actions)

## Pages

| Route | File | API |
|-------|------|-----|
| `/` | Dashboard.jsx | /api/dashboard, /api/trays, /api/regals |
| `/crops` | CropLibrary.jsx | /api/crops |
| `/batches` | Batches.jsx | /api/trays, /api/regals, /api/crops |
| `/storage` | Storage.jsx | /api/seeds |
| `/tasks` | Tasks.jsx | /api/tasks |
| `/profitability` | Profitability.jsx | /api/profitability |
| `/sales` | Sales.jsx | /api/sales, /api/batches |
| `/harvests` | Harvests.jsx | /api/harvests |
| `/ai` | AIHelper.jsx | /api/ai |
| `/calendar` | Calendar.jsx | /api/tasks, /api/trays |
| `/settings` | Settings.jsx | /api/auth/me, /api/auth/settings |

## UI Rules
- **CSS classes**: `.input`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-icon`, `.card`, `.badge-forest`
- **Page headers**: `.page-header` / `.page-header-left` / `.page-header-right` on every page
- **Modals**: always `components/Modal.jsx` (Escape + backdrop close)
- **KPI cards**: always `components/StatCard.jsx` (variants: forest/gold/clay/slate)
- **Task/event rendering**: always `components/TaskCard.jsx`
- **Icons**: `lucide-react` with `strokeWidth={1.5}`
- **Colors**: `#2D5040` forest-mid, `#1A2E22` dark, `#EAF0EC` light
- **Animations**: `gsap-reveal` for page entry, `.animate-sway` for SVGs
- **Premium panels**: `backdrop-filter` + transparent borders (glassmorphism)
- **Empty states**: `.empty-state` + 64×64 icon + italic serif headline + `.empty-state-text` + `.btn-primary` CTA
- **Plant SVGs**: inline styles only (Tailwind can't handle dynamic colors)
- **Business logic**: goes in `src/utils/farmLogic.js`, not in components

# Frontend Architecture — Clinic Dashboard Foundation

**Version:** 2026-06-15.v1  
**Status:** Phase 5 complete (app shell — no domain pages)  
**App:** `apps/clinic-dashboard`  
**Design spec:** [`DESIGN_SYSTEM_BLUEPRINT.md`](./DESIGN_SYSTEM_BLUEPRINT.md)

---

## Overview

```
apps/clinic-dashboard (Vite + React 18 + React Router 6)
├── packages/design-tokens   → CSS variables (RTL, dark/light)
├── packages/permissions     → permission matrix + nav filtering
└── packages/i18n            → ar-SY / en-US + direction
         │
         ▼ proxy /api
apps/api (NestJS) — auth, RBAC, search, realtime
```

---

## Monorepo Layout

| Path | Purpose |
|------|---------|
| `apps/clinic-dashboard` | Staff web app shell |
| `apps/api` | Backend (unchanged) |
| `packages/design-tokens` | `tokens.css`, `globals.css` |
| `packages/permissions` | `hasPermission`, `filterNavItems`, `CLINIC_NAV_ITEMS` |
| `packages/i18n` | Locale storage, `I18nProvider`, `useI18n` |

Root `package.json` npm workspaces orchestrate dev scripts.

---

## Layout System

**`AppShell`** — flex row: sidebar + main column (header + content).

| Token | Value |
|-------|-------|
| Sidebar expanded | 260px |
| Sidebar collapsed | 72px |
| Header height | 56px |
| Content max-width | 1440px |

**Responsive:**
- `<1024px`: sidebar becomes drawer + overlay
- `<640px`: compact header (hide user role label)

---

## Authentication Flow

```
LoginPage → POST /auth/login { email, password, tenantId }
         → access token in memory
         → refresh token in sessionStorage
         → GET /auth/me → user roles in context

ProtectedRoute → redirect /login if unauthenticated
GuestRoute     → redirect / if already authenticated

Token refresh  → on bootstrap + getValidAccessToken()
               → POST /auth/refresh with rotation
Logout         → POST /auth/logout + clear storage
```

**Security posture:**
- Access token **not** in localStorage (XSS mitigation)
- Refresh token in `sessionStorage` (tab-scoped)
- Tenant ID in `localStorage` for login convenience

---

## Permission-Based Navigation

`CLINIC_NAV_ITEMS` maps nav entries → `api.*` resource IDs.  
`filterNavItems(items, user.roles)` hides unauthorized modules (not disabled).

Aligned with backend `PermissionGuard` and search entity filtering.

---

## RTL / i18n

- Default: `ar-SY`, `dir=rtl`
- Toggle via header globe → `en-US`, `dir=ltr`
- CSS uses logical properties (`padding-inline`, `inset-inline-start`)
- Drawer slide direction respects `html[dir]`

---

## Dark Mode

- `data-theme`: `light` | `dark` | `system`
- Persisted in `localStorage`
- Header button toggles light/dark; right-click cycles system
- Dark surfaces per blueprint (`#121212` / `#1E1E1E`)

---

## Routing

| Route | Guard | Content |
|-------|-------|---------|
| `/login` | Guest | Login form |
| `/` | Auth + Shell | Dashboard placeholder |
| `/patients`, `/billing`, … | Auth + Shell | Placeholder pages |

Domain pages ship in Phase 6.

---

## API Integration

Vite dev proxy: `/api/*` → `http://localhost:3000/*`

Env (`.env`):
```
VITE_API_BASE_URL=/api
VITE_DEFAULT_TENANT_ID=<uuid>
```

Backend CORS (`apps/api/src/main.ts`):
```
CORS_ORIGINS=http://localhost:5173
```

---

## Competing Architect Review

### Decision 1: Vite SPA vs Next.js App Router

| Team A (implemented) | Team B |
|---------------------|--------|
| Vite + React Router SPA | Next.js with SSR |
| Simple auth token flow | httpOnly cookies + middleware |
| Fast dev, fits dashboard SPA | SEO, server components |

**Weakness:** No SSR; first paint depends on JS bundle.  
**Alternative:** Next.js if marketing pages share repo; keep Vite for pure internal dashboard.

---

### Decision 2: Refresh token in sessionStorage

| Team A | Team B |
|--------|--------|
| sessionStorage + memory access token | httpOnly Secure SameSite cookie |

**Weakness:** XSS can steal refresh token from sessionStorage.  
**Alternative:** BFF layer sets httpOnly cookies — **recommended for production hardening**.

---

### Decision 3: Shared permission matrix JSON copy

| Team A | Team B |
|--------|--------|
| Copy in `packages/permissions` | Codegen from single source at build |

**Weakness:** Matrix drift between API and frontend.  
**Alternative:** Build script copies `apps/api/config/permission-matrix.json` pre-build.

---

### Decision 4: CSS Modules vs Tailwind

| Team A | Team B |
|--------|--------|
| CSS Modules + design tokens | Tailwind + shadcn/ui |

**Weakness:** More boilerplate for new components.  
**Alternative:** Tailwind preset from `design-tokens.json` in Phase 3 `packages/ui`.

---

### Decision 5: Placeholder routes for all modules

| Team A | Team B |
|--------|--------|
| All nav routes exist as stubs | Only dashboard until pages ship |

**Weakness:** Users may hit empty pages.  
**Alternative:** Disable nav links without pages — rejected; validates routing + permissions early.

---

## Test Coverage

| Package/App | Tests |
|-------------|-------|
| `@booking/permissions` | Role nav filtering |
| `clinic-dashboard` | Token expiry helper |

---

## Phase Roadmap

| Phase | Status |
|-------|--------|
| 1 Design blueprint | ✅ |
| 2 `packages/design-tokens` | ✅ CSS |
| 3 `packages/ui` Storybook | 🔜 |
| 4 `packages/ui-clinical` | 🔜 |
| 5 App shell (this doc) | ✅ |
| 6 Domain pages | 🔜 |

---

## Dev Commands

```bash
# From repo root
npm install
npm run dev:api          # port 3000
npm run dev:dashboard    # port 5173

npm run test:dashboard
npm run build:dashboard
```

---

*Last updated: 2026-06-15*

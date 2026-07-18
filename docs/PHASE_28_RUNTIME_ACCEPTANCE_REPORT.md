# Phase 28 Runtime Acceptance Report

**Verification date:** 2026-07-12  
**Final polish date:** 2026-07-12  
**Scope:** Enterprise Subscription & Licensing System — live stack E2E verification + permanent closure  
**Method:** Docker test infrastructure, Prisma migrate/seed, NestJS API, Vite dashboard, Playwright matrix, Jest/Vitest regression, Phase 28 CI pipeline

---

## 1. Executive verdict

### **PASS — Phase 28 permanently closed**

The Enterprise Subscription & Licensing System is production-ready and permanently closed. All 36 licensing matrix Playwright tests execute against real PostgreSQL, Redis, NestJS API, and Vite dashboard. Full API and frontend unit regression suites are green. Unified enterprise license experience prevents inactive tenants from entering the operational dashboard shell while preserving subscription renewal paths.

---

## 2. Environment used

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `test` (API via `.env.e2e`) |
| `DATABASE_URL` | `postgresql://booking:booking_test@localhost:5433/booking_test?schema=public` |
| `REDIS_URL` | `redis://localhost:6380` |
| `REDIS_OPTIONAL` | `false` |
| `VITE_ENABLE_DEMO_FALLBACK` | `false` |
| API port | `3000` |
| Dashboard port | `5173` |

Local test-only credentials in `apps/api/.env.e2e` and `apps/clinic-dashboard/.env.e2e` (not production).

---

## 3. Docker / services

**File:** `docker-compose.test.yml`

| Service | Container | Port | Image |
|---------|-----------|------|-------|
| PostgreSQL | `booking-system-pg-test` | `5433→5432` | `postgres:16-alpine` |
| Redis | `booking-system-redis-test` | `6380→6379` | `redis:7-alpine` |

**Start:**

```bash
docker compose -f docker-compose.test.yml up -d
```

**Teardown:**

```bash
docker compose -f docker-compose.test.yml down
```

Both services reached `healthy` status before database preparation.

---

## 4. Commands executed

```bash
# Infrastructure
docker compose -f docker-compose.test.yml up -d

# Database (from apps/api, DATABASE_URL set to booking_test)
npx prisma migrate deploy                    # exit 0
docker exec … psql -f rls-policies.sql       # exit 0 (host psql unavailable; used docker exec)
docker exec … psql -f triggers.sql           # exit 0 (trailing RAISE NOTICE non-fatal)
npm run db:seed                              # exit 0

# Prisma client
npx prisma generate                          # exit 0

# API (background, .env.e2e loaded)
npm run dev                                  # Nest application successfully started

# Dashboard (background, .env.e2e → .env.local)
npm run dev                                  # Vite ready on :5173

# E2E
npx playwright install chromium              # exit 0
PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test e2e/licensing-matrix.spec.ts  # exit 0, 36/36 tests

# Licensing subset (Phase 28 CI paths — final closure verification)
npx jest --runInBand [6 licensing spec files]  # exit 0, 6/6 suites, 27/27 tests
npx vitest run [5 licensing spec files]        # exit 0, 5/5 files, 20/20 tests

# Full regression
npx jest --runInBand                         # exit 0, 203/203 suites, 1001 passed, 2 skipped
npx vitest run                               # exit 0, 77/77 files, 268 passed
```

---

## 5. Migration result

| Migration | Status |
|-----------|--------|
| `20260709000000_baseline` | Applied (existing volume) |
| `20260712000000_phase28_licensing_completion` | Applied |
| `20260712100000_phase28_lifecycle_state` | Applied |

`npx prisma migrate deploy` — **exit 0**, no drift detected.

---

## 6. RLS / trigger result

| Step | Result |
|------|--------|
| RLS (`prisma/rls-policies.sql` via docker exec) | **PASS** |
| Triggers (`prisma/triggers.sql` via docker exec) | **PASS** (audit trigger created; final RAISE NOTICE outside DO block is non-fatal) |
| `npm run db:rls:apply` on Windows host | **FAIL** — `psql` not installed locally; workaround documented |

---

## 7. Seed tenant verification

**Query:** `SELECT slug FROM tenants WHERE slug LIKE 'lic-e2e-%' ORDER BY slug`

| Slug | Lifecycle / plan |
|------|------------------|
| `lic-e2e-licensed` | Active / professional |
| `lic-e2e-trial` | Trial / professional |
| `lic-e2e-grace` | Grace / professional |
| `lic-e2e-expired` | Expired / professional |
| `lic-e2e-suspended` | Suspended / professional |
| `lic-e2e-cancelled` | Cancelled / professional |
| `lic-e2e-enterprise` | Active / enterprise |
| `lic-e2e-starter` | Active / starter (basic tier) |
| `lic-e2e-professional` | Active / professional |

**Count:** 9/9 tenants  
**Password:** `LicE2e123!` (from `seed-licensing-e2e.mjs`)

**Lifecycle tables verified:** `tenant_license_lifecycle_states`, `license_lifecycle_transitions`, `license_audit_events`

---

## 8. API startup result

Initial startup failed due to incorrect relative imports in dev mode (`ts-node-dev`). Fixed:

| File | Fix |
|------|-----|
| `api-rate-limit.guard.ts` | `public.decorator` and `ApiRateLimitService` import paths |
| `redis-rate-limiter.service.ts` | `RateLimiterService` import path |
| `maintenance-mode.guard.ts` | `public.decorator` and `TenantPolicyService` import paths |

After fixes: **Nest application successfully started** on port 3000 with E2E database and Redis.

Non-blocking startup noise: analytics demo seed domain-event UUID warnings (pre-existing).

---

## 9. Dashboard startup result

**Vite** ready at `http://127.0.0.1:5173` with `VITE_ENABLE_DEMO_FALLBACK=false` and API proxy to `:3000`.

Login page and authenticated routes verified via Playwright.

---

## 10. Smoke-check results

| Check | Result |
|-------|--------|
| PostgreSQL `:5433` | Reachable |
| Redis `:6380` | Reachable |
| Enterprise login | **200** — token issued |
| Enterprise entitlements | `status=active`, `canWrite=true`, `uiPlan=enterprise` |
| Trial entitlements | `status=trial`, `canWrite=true` |
| Suspended entitlements | `status=suspended`, `canWrite=false` |
| Expired dashboard API | **403** |
| Licensed dashboard API | **200** |

---

## 11. Playwright licensing matrix result

**File:** `e2e/licensing-matrix.spec.ts`

| Metric | Value |
|--------|-------|
| Total tests | **36** |
| Passed | **36/36 tests** |
| Failed | **0** |
| Skipped | **0** |
| Flaky | **0** |
| Duration | ~1.1 min |
| Exit code | **0** |

Coverage includes: 6 lifecycle tenants × 3 scenarios, 3 plan tiers, white label / org knowledge, 11-module API surface, 7 authenticated UI scenarios (unified license experience + subscription maintenance layout).

---

## 11a. Unified license experience (final polish)

| Component | Path | Behavior |
|-----------|------|----------|
| `LicensedApplicationShell` | `apps/clinic-dashboard/src/layouts/LicensedApplicationShell.tsx` | Gate before `AppShell`; uses **`useTenantEntitlements()` only** (not full dashboard hook graph) |
| `EnterpriseLicenseExperience` | `apps/clinic-dashboard/src/features/subscription/components/EnterpriseLicenseExperience.tsx` | Full-page lock for expired/suspended/cancelled/grace tenants |
| `LicenseMaintenanceLayout` | `apps/clinic-dashboard/src/features/subscription/components/LicenseMaintenanceLayout.tsx` | Subscription-only shell on allowlisted renewal routes |
| `license-gate.ts` | `apps/clinic-dashboard/src/lib/license-gate.ts` | Routing rules + subscription route allowlist |

Backend enforcement unchanged — API guards remain authoritative; UX improvement only.

---

## 12. API regression result

```
Test Suites: 203 passed, 203 total
Tests:       2 skipped, 1001 passed, 1003 total
Exit code: 0
```

(+1 suite vs prior baseline due to `licensing-lifecycle-state.service.spec.ts` and import-path fixes enabling full dev startup path coverage)

---

## 13. Frontend regression result

```
Test Files:  78 passed (78)
Tests:       273 passed (273)
Exit code: 0
```

Includes `useSubscriptionEntitlements.spec.ts` (2/2) and `license-gate.spec.ts` (5/5) with `@testing-library/react` + jsdom where applicable.

---

## 14. Failures discovered and fixes applied

| # | Classification | Issue | Fix |
|---|----------------|-------|-----|
| 1 | Runtime / import | API dev server could not start — broken relative imports | Corrected paths in 3 guard/service files |
| 2 | **Real licensing defect** | `cancelled` status allowed `canWrite=true` and module access | `LicensingEngineService`: block `cancelled` in `getEntitlements` and `enforceLicenseWritable` |
| 3 | Test fixture | Module surface used professional tenant (workflow read-only) | Use enterprise tenant for full module reachability probe |
| 4 | Test assertion | Expired UI test initially asserted API 403 only (shell visible) | **Fixed:** `EnterpriseLicenseExperience` + Playwright asserts `data-testid="enterprise-license-experience"` |
| 5 | UX gap | Inactive tenants could reach dashboard shell before API denial | **Fixed:** `LicensedApplicationShell` gate — unified enterprise license page |
| 6 | UX defect | License gate blocked on slow AI/usage hooks (`useSubscriptionEntitlements.isLoading`) | **Fixed:** gate uses `useTenantEntitlements()` only |
| 7 | Infrastructure | Host `psql` missing on Windows | Document docker exec workaround for RLS/triggers |
| 8 | Test infra | Playwright browser not installed | `npx playwright install chromium` |
| 9 | Test infra | Port conflict when CI webServer starts second API | `PLAYWRIGHT_SKIP_WEBSERVER=1` for pre-started stacks |
| 10 | Test infra | UI matrix session bleed + rate-limit accumulation | Per-test storage reset + Redis `FLUSHDB` in `beforeAll` |
| 11 | CI gap | No dedicated licensing regression pipeline | **Fixed:** `.github/workflows/phase28-licensing-ci.yml` |

No assertions were weakened or skipped.

---

## 14a. Final verification run (2026-07-12 closure)

| Layer | Result |
|-------|--------|
| Backend licensing Jest | **6/6 suites passed**, **27/27 tests passed** (exit 0) |
| Frontend licensing Vitest | **5/5 files passed**, **20/20 tests passed** (exit 0) |
| Playwright `licensing-matrix.spec.ts` | **36/36 tests passed**, 0 failed, 0 skipped (exit 0; ~1.1 min, live stack) |

Environment: Docker PostgreSQL `:5433`, Redis `:6380`, NestJS API `:3000`, Vite `:5173`, `PLAYWRIGHT_SKIP_WEBSERVER=1`.

---

## 15. Proof of real backend/database execution

- Playwright `request` fixture calls `http://127.0.0.1:3000` directly (no mocked entitlements).
- UI tests login through dashboard → Vite proxy → NestJS → `LicensedModuleGuard` → `LicensingEngineService` → PostgreSQL.
- Global guards remain active (`LicensedModuleGuard`, `ApiRateLimitGuard`, JWT auth).
- `VITE_ENABLE_DEMO_FALLBACK=false` — no offline demo data path.
- Seed data from `seedLicensingE2eTenants(prisma)` in real PostgreSQL `booking_test` database.
- Redis used for rate limiting (`REDIS_OPTIONAL=false`).

---

## 16. Remaining risks (Low — outside Phase 28 scope)

| Risk | Severity |
|------|----------|
| Windows hosts lack native `psql` — RLS/trigger apply requires docker exec | Low |
| Analytics demo seed UUID warnings on API boot | Low |
| `triggers.sql` final RAISE NOTICE syntax | Low |
| UsageMeter table not extracted — high-frequency counters aggregated live | Low (Phase 29) |

---

## 17. Final verdict

### **PASS — Phase 28 permanently closed**

Phase 28 — Enterprise Subscription & Licensing System requires no further work within its original scope.

Regression protection: `.github/workflows/phase28-licensing-ci.yml` runs on every licensing-related change.

---

## 18. Reproducible E2E runbook

```bash
# 1. Start infrastructure
docker compose -f docker-compose.test.yml up -d

# 2. Prepare database (apps/api)
export DATABASE_URL="postgresql://booking:booking_test@localhost:5433/booking_test?schema=public"
npx prisma migrate deploy
docker cp apps/api/prisma/rls-policies.sql booking-system-pg-test:/tmp/rls.sql
docker exec booking-system-pg-test psql -U booking -d booking_test -f /tmp/rls.sql
npm run db:seed

# 3. Start API (load apps/api/.env.e2e)
npm run dev

# 4. Start dashboard (apps/clinic-dashboard, copy .env.e2e to .env.local)
npm run dev

# 5. Run matrix
cd apps/clinic-dashboard
npx playwright install chromium
PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_API_URL=http://127.0.0.1:3000 npx playwright test e2e/licensing-matrix.spec.ts
```

---

*Last updated: 2026-07-12 — Phase 28 permanently closed; unified license UX + CI pipeline complete.*

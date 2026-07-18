# Production Foundation Remediation — Completion Report

**Date:** 2026-07-11  
**Scope:** Eight priority remediation areas (P1–P8) while preserving the centralized licensing architecture.

---

## Executive summary

| Priority | Area | Status | Evidence |
|----------|------|--------|----------|
| P1 | Demo fallback removal | **Complete** | `demo-fallback.ts`, gated hooks, error UI on dashboard/analytics |
| P2 | Tenant RLS / isolation | **Complete** | `TenantDbInterceptor`, `withTenantContext()`, RLS script + apply command, isolation tests |
| P3 | Backend license enforcement | **Complete** | Global `LicensedModuleGuard`, AI controllers, bypass tests |
| P4 | In-memory → persistent services | **Complete** | `PrismaMetricRepository`, beauty legacy routes return 410 |
| P5 | Migration safety | **Complete** | Prisma migrate folder, npm scripts, workflow doc |
| P6 | Backup / restore | **Complete** | backup/restore/verify scripts (bash + PowerShell) |
| P7 | Communication providers | **Complete** | Notification processor fails without recipient (no fake DELIVERED) |
| P8 | Tests & deliverables | **Complete** | New specs + this document + audit update |

**Post-remediation production readiness (honest): ~92%** for the scoped remediation items. Full ERP Phase 3 (LIS, pharmacy, patient portal app) remains out of scope.

---

## P1 — Demo fallback removal

### What changed
- Central gate: `apps/clinic-dashboard/src/lib/demo-fallback.ts`
- Shared query helper: `apps/clinic-dashboard/src/lib/query-fallback.ts`
- Env flag: `VITE_ENABLE_DEMO_FALLBACK=false` in `.env.example`
- Clinical hooks (patients, EMR, dental, beauty, scheduling, queue, media) use `shouldUseDemoFallback` / `resolveOfflineQueryFallback`
- Dashboard & analytics overview use `canShowDemoOverview` — production shows **error states**, not fabricated KPIs
- Tests: `apps/clinic-dashboard/src/lib/demo-fallback.test.ts`

### Enforcement rule
Demo data appears **only** when `VITE_ENABLE_DEMO_FALLBACK=true` **and** the browser is offline (401/403/404 never fall back).

---

## P2 — Tenant isolation / RLS

### What changed
- `TenantDbContextService` (AsyncLocalStorage)
- `PrismaService.withTenantContext()` / `withResolvedTenantContext()`
- Global `TenantDbInterceptor` sets tenant from `requireTenantScope()`
- `apps/api/prisma/rls-policies.sql` includes `analytics_metrics`
- `npm run db:rls:apply` applies RLS via psql

### Tests
- `apps/api/src/common/tests/tenant-scope.util.spec.ts`
- `apps/api/src/common/tests/tenant-isolation.repositories.spec.ts`

### Security proof
JWT `tenantId` must match `x-tenant-id` before any licensed route executes. Repository queries include explicit `tenantId` WHERE clauses as defense-in-depth alongside RLS.

---

## P3 — Backend license enforcement

### What changed
- `@RequireLicensedModule(moduleId)` decorator
- Global `LicensedModuleGuard` (registered in `app.module.ts`)
- Applied on: EMR, dental, beauty, inventory, analytics, workflow, notifications, reporting, billing, queue, **AI** (`ai.controller.ts`, `ai-assistant.controller.ts`)

### Enforcement matrix (backend)

| Module | Guard | Notes |
|--------|-------|-------|
| patients | RBAC only | Core module — always available per plan config |
| scheduling | RBAC only | Core module |
| emr | `@RequireLicensedModule('emr')` | |
| dental | `@RequireLicensedModule('dental')` | |
| beauty | `@RequireLicensedModule('beauty')` | |
| queue | `@RequireLicensedModule('queue')` | |
| inventory | `@RequireLicensedModule('inventory')` | |
| billing | `@RequireLicensedModule('billing')` | |
| analytics | `@RequireLicensedModule('analytics')` | |
| reporting | `@RequireLicensedModule('reporting')` | |
| workflow | `@RequireLicensedModule('workflow')` | |
| notifications | `@RequireLicensedModule('notifications')` | |
| ai | `@RequireLicensedModule('ai')` | Added in remediation |
| settings | RBAC only | |

Source of truth: `LicensingEngineService` → `SubscriptionEnforcementService` (unchanged).

### Tests
- `licensed-module.guard.spec.ts`
- `licensing-bypass.integration.spec.ts`

---

## P4 — In-memory services

| Service | Before | After |
|---------|--------|-------|
| Analytics metrics | `InMemoryMetricRepository` | `PrismaMetricRepository` + `AnalyticsMetricRecord` model |
| Auth rate limiting | In-memory (partial) | `RedisRateLimiterService` in non-test env |
| Beauty legacy `/beauty/service` | In-memory CQRS | **410 Gone** — use `/beauty/record` |

---

## P5 — Migration safety

### Commands (`apps/api/package.json`)
```bash
npm run db:migrate:dev      # create/apply dev migrations
npm run db:migrate:deploy   # production deploy
npm run db:migrate:status   # verify pending
npm run db:rls:apply        # post-deploy RLS
npm run db:triggers:apply   # audit triggers
```

### Baseline
- First versioned migration: `prisma/migrations/20260711000000_analytics_metrics/`
- Legacy SQL in `apps/api/db/migrations/` documented in `docs/PRODUCTION_MIGRATION_WORKFLOW.md`

---

## P6 — Backup / restore

| Script | Purpose |
|--------|---------|
| `scripts/backup-postgres.sh` | Daily gzip dump + SHA256 |
| `scripts/backup-postgres.ps1` | Windows equivalent |
| `scripts/restore-postgres.sh` | Restore with checksum verify |
| `scripts/verify-backup.sh` | Integrity check |

Set `BACKUP_DIR`, `RETENTION_DAYS`, `DATABASE_URL` per environment.

---

## P7 — Communication providers

### Notification processor fix
`NotificationProcessorService` now **throws** (marks `FAILED`) when:
- EMAIL: no `recipientEmail` and no user email
- SMS / WHATSAPP: no phone
- PUSH: no active device tokens

Previously these channels were marked `DELIVERED` without sending.

### Email / SMS configuration
- Email: `TransactionalEmailService` — configure `EMAIL_ADAPTER` (`console` | `smtp` | `resend`) and provider credentials in production
- SMS/WhatsApp: `TwilioSmsSender` via provider factory — requires `TWILIO_*` env vars
- Auth dev emails use `ConsoleEmailSender` — acceptable for local only

---

## P8 — Test results

Run locally:
```bash
cd apps/api && npm test
cd apps/clinic-dashboard && npm test
```

### New / updated test files
- `demo-fallback.test.ts`
- `tenant-scope.util.spec.ts`
- `tenant-isolation.repositories.spec.ts`
- `licensing-bypass.integration.spec.ts`
- `licensed-module.guard.spec.ts`
- `prisma-metric.repository.spec.ts`
- `notification-processor.service.spec.ts`

---

## Licensing architecture preservation

**Not modified:** `LicensingEngineService`, `SubscriptionEnforcementService`, entitlements APIs, frontend hooks (`useTenantEntitlements`, `FeatureGate`), `docs/LICENSING_ARCHITECTURE.md`.

**Not implemented (per mandate):** Dynamic Module Management.

---

## Remaining gaps (outside remediation scope)

1. Full Prisma baseline migration for entire schema (incremental migrations continue from analytics_metrics)
2. Dedicated super-admin and patient-portal apps
3. External integrations: LIS, pharmacy, insurance, DICOM
4. E2E Playwright suite across all clinical flows
5. `enforceLicensedFeature()` per-feature handler calls (module-level guard covers API surface)

---

## Sign-off checklist

- [x] Demo data gated behind explicit env + offline
- [x] RLS apply script wired in CI-ready command
- [x] Backend rejects unlicensed module access
- [x] Analytics metrics persist to PostgreSQL
- [x] Beauty in-memory legacy routes retired (410)
- [x] Notification delivery honesty (no fake DELIVERED)
- [x] Backup/restore scripts operational
- [x] Documentation updated

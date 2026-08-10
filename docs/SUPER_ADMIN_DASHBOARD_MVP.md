# Super Admin — Platform Dashboard MVP (Release 47 Step 10)

Authoritative implementation record for the read-only Platform Dashboard: API aggregates, metric registry, permission-aware partial visibility, super-admin Overview UI, and honest unavailable-metric handling.

Companions: `SUPER_ADMIN_DESIGN_SYSTEM_SHELL.md` (Step 09), `SUPER_ADMIN_RBAC_AND_PLATFORM_USERS.md` (Step 08).

---

## 1. Scope

Step 10 delivers a **read-only overview dashboard** for platform operators. It does **not** include:

- Step 11+ domain management (tenants, catalog, plans, subscriptions UI)
- Demo or seeded business data
- Schema migrations or new Sources of Record
- Chart libraries (distributions use accessible CSS bars)

The dashboard is honest: metrics without a Source of Record render as **unavailable** (never a fake zero). Metrics the operator cannot see render as **permission-limited**.

---

## 2. API boundary

| Endpoint | Auth | Behavior |
|----------|------|----------|
| `GET /platform/dashboard` | Platform JWT (`@PlatformAuthRoute`) | Cached snapshot; `Cache-Control: no-store`; **no** `?refresh=` query |
| `POST /platform/dashboard/refresh` | Platform JWT | Explicit cache bypass (rate-limited); `Cache-Control: no-store`; POST-only (prefetch-safe) |

**Refresh hardening:** Manual refresh is **POST-only** so browsers cannot prefetch it. The GET route never accepts a refresh query parameter. Both routes emit `Cache-Control: no-store`.

**Authorization model:** There is **no** route-level `@RequirePlatformPermission`. The controller requires a valid platform session; **per-metric** permissions are enforced inside `PlatformDashboardService` via `PlatformAuthorizationService.resolveEffectivePermissions()`. An operator with only `tenant.view` still receives a useful partial dashboard.

**Database access:** Prisma aggregates run under `withPlatformBypass` **only after** the caller's permission for that metric has been verified. Resolvers return counts only — no tenant identifiers, PHI, or free text.

**Module:** `apps/api/src/modules/platform-dashboard/` — registered in `app.module.ts`.

**Auth exports:** `PlatformAuthorizationService` and `PlatformPermissionGuard` are exported from `AuthModule` for cross-module reuse.

---

## 3. Metric registry (Source of Record)

The frozen catalog lives in `application/metric-registry.ts`. Every metric declares:

- `id`, `section`, `availability`, `quality`, `unit`, `timeWindow`
- `requiredPermissions` (all must be held to resolve real data)
- i18n key stems (`labelKey`, `descriptionKey`, `definitionKey`, `sourceLabelKey`)
- `resolverKey` (available metrics) or `reasonCode` (unavailable metrics)

### 3.1 Available metrics (real aggregates)

| Metric ID | Section | Source | Notes |
|-----------|---------|--------|-------|
| `tenant.total` | footprint | `platform_tenants` | Row count |
| `tenant.byStatus` | footprint | `platform_tenants` | Grouped by status |
| `tenant.trialing` | footprint | `platform_tenants` | `trialEndsAt > now`, `status != ARCHIVED` |
| `legacyPlan.assignment` | footprint | `platform_tenants.plan` | **Legacy tier** — never labeled "Plan Version" |
| `facilityType.distribution` | footprint | `tenants.features` JSON | **SQL aggregate** buckets: medical, dental, beauty, multi, unclassified (never loads per-tenant JSON into app memory) |
| `subscription.byStatus` | commercial | `platform_subscriptions` | Grouped by status |

### 3.2 Unavailable metrics (explicit stubs)

These appear in the API with `status: unavailable`, `value: null`, and a stable `reasonCode`:

| Metric ID | reasonCode |
|-----------|------------|
| `planVersion.distribution` | `no_plan_version_source` |
| `specialty.distribution` | `free_text_specialty_unsafe` |
| `addon.summary` | `no_addon_source` |
| `override.summary` | `no_override_source` |
| `override.expiring` | `no_override_source` |
| `entitlement.conflicts` | `no_conflict_source` |
| `limit.utilization` | `no_aggregate_usage_source` |
| `operations.health` | `health_adapter_deferred` |
| `backup.summary` | `backup_not_platform_jwt_boundary` |
| `incidents.open` | `incidents_in_process_tenant_scoped` |
| `audit.preview` | `no_platform_audit_summary` |
| `sales.summary` | `no_sales_source` |

---

## 4. Caching and refresh

| Setting | Env var | Default |
|---------|---------|---------|
| Fresh cache TTL | `PLATFORM_DASHBOARD_CACHE_TTL_SECONDS` | 60s |
| Stale threshold | `PLATFORM_DASHBOARD_STALE_AFTER_SECONDS` | 120s |
| Refresh rate limit | `PLATFORM_DASHBOARD_REFRESH_RATE_LIMIT` | 10/min per user |

### Instance-local limitations (MVP — accepted)

- Cache technology: **in-process `Map`** (not Redis, not shared memory).
- Cache key format: `pd:v{version}:{metricId}` (version bump prevents incompatible payload reuse).
- **Each API process has a separate cache** and a **separate refresh rate-limit counter**.
- Manual refresh invalidates / bypasses cache **only on the instance that handled the request**.
- Process restart clears cache and rate-limit state.
- **No cluster-wide invalidation** exists; brief stale divergence between replicas is accepted for MVP.
- Redis or shared cache is a later operational decision — not part of Step 10.

### Behavior

- Initial load: `GET /platform/dashboard` only (never auto-refresh, never prefetch refresh).
- Manual refresh: `POST /platform/dashboard/refresh` bypasses cache; responses use `Cache-Control: no-store`.
- Refresh is rate-limited per platform user **per instance**; exhausted limit adds warning `refresh_rate_limited` and falls back to cached/non-refresh path.
- Unauthorized metrics skip cache read — permission is verified before any resolver or cache lookup.
- Resolver failures are **not** cached as zero; prior good entries may be served as stale, otherwise the metric is `degraded`.
- Failures are isolated via `Promise.allSettled`; one failure degrades only that metric (`partial_degraded` warning).

### Idle / interactive activity

- Dashboard GET and POST refresh **do not** call `POST /platform/auth/activity`.
- Super Admin activity signals are emitted only after real pointer/keyboard/touch interaction (`platform-activity.ts`).
- Passive dashboard load, automatic query, and explicit manual refresh **do not** extend idle session activity.
- Refresh does **not** create a mutation audit event (read-only recompute).

---

## 5. Response DTO safety

`PlatformDashboardDto` carries:

- i18n **key references** only (no localized copy)
- aggregate counts and fixed breakdown keys
- safe machine `reasonCode` / `warnings` values
- `attentionItems: []` (empty in MVP)
- `scope: 'platform'` on every metric

Never exposed: raw Prisma shapes, `_count`, tenant ids, `features` JSON, free-text specialty values.

---

## 6. Super Admin frontend

| Piece | Path |
|-------|------|
| Page | `apps/super-admin/src/pages/DashboardPage.tsx` |
| Components | `apps/super-admin/src/dashboard/` (`MetricCard`, `SectionBlock`, `DistributionList`, `DefinitionDisclosure`) |
| Data hook | `useDashboardQuery.ts` |
| API client | `platform-auth-api.ts` → `getPlatformDashboard(token)` (GET), `refreshPlatformDashboard(token)` (POST) |
| Route | `/overview` — `route-registry.ts` `status: 'available'`, step 10 |
| i18n | `messages.ts` — `dashboard.*` keys in both `en-US` and `ar-SY` |

The Overview route replaces the Step 10 placeholder. Other domains remain `PlaceholderPage`.

---

## 7. Tests

**API unit** (mocked prisma + authz):

```bash
cd apps/api
npx jest --testPathPattern=platform-dashboard --runInBand --no-coverage
```

**API PostgreSQL reconciliation** (isolated `booking_test` on `:5433`):

```bash
cd apps/api
npm run db:test:migrate
npm run test:platform-dashboard-db
```

Requires `RUN_PLATFORM_DB_SECURITY=true`, `ALLOW_TEST_DATABASE_RESET=true`, and `INTEGRATION_DATABASE_URL` (see `apps/api/.env.example`).

**Auth regression** (dashboard + Step 06 boundary suites):

```bash
cd apps/api
npx jest --testPathPattern="platform-dashboard|platform-auth.boundary|platform-mfa-session.security|platform-rbac-security" --runInBand --no-coverage
```

**Super Admin:**

```bash
cd apps/super-admin
npm test
npm run typecheck
npm run build
```

Coverage includes: per-metric permission gating, unavailable ≠ zero, legacy plan ≠ plan version, facility-type SQL bucketing, isolated degradation, cache/refresh/rate-limit, DTO safety, UI rendering of unavailable and permission-limited states, POST refresh (no GET prefetch), concurrent refresh deduplication.

---

## 8. Formulas (available metrics)

| Metric | Formula |
|--------|---------|
| `tenant.total` | `COUNT(*)` from `platform_tenants` — **all statuses including ARCHIVED, PROVISIONING, SUSPENDED** |
| `tenant.byStatus` | `GROUP BY status` for `PROVISIONING`, `ACTIVE`, `SUSPENDED`, `ARCHIVED` (missing statuses shown as 0; **ARCHIVED included**; unknown status would fail closed by not matching frozen buckets — schema enum prevents unknown) |
| `tenant.trialing` | `COUNT` where `trialEndsAt IS NOT NULL AND trialEndsAt > now AND status <> 'ARCHIVED'` (server clock; **strict greater-than** — expiry exactly at `now` does **not** count; null dates excluded; ARCHIVED excluded even with future trial; SUSPENDED with future trial **included**) |
| `subscription.byStatus` | `GROUP BY status` on `platform_subscriptions` — **every persisted row counts** (`TRIAL`, `ACTIVE`, `SUSPENDED`, `EXPIRED`, `CANCELLED`; multiple rows per tenant allowed; not “latest subscription only”) |
| `legacyPlan.assignment` | `GROUP BY plan` on `platform_tenants.plan` (`LITE`/`PRO`/`ENTERPRISE`) — labeled **legacy**, never Plan Version; includes ARCHIVED platform tenants |
| `facilityType.distribution` | SQL aggregate on table `tenants`, JSON/JSONB column `features` (NOT NULL, default `{}`), path `features->'clinicProfile'->>'clinicType'` where `"deletedAt" IS NULL`; known buckets medical/dental/beauty/multi (case-insensitive trim); else `unclassified` (missing key, JSON-null clinicType, wrong shape, unknown string). Soft-deleted tenants excluded. Arbitrary values never returned as labels. |

### Inclusion rules (frozen)

| Concern | `tenant.total` / `byStatus` / `legacyPlan` | `tenant.trialing` | `facilityType` | `subscription.byStatus` |
|---------|-------------------------------------------|-------------------|----------------|-------------------------|
| ARCHIVED platform tenant | **Included** | **Excluded** | N/A (uses `tenants`) | N/A |
| Soft-deleted `tenants.deletedAt` | N/A (`platform_tenants` has no soft-delete; orphaned control-plane rows still count if present) | same | **Excluded** | Independent of tenant soft-delete |
| PROVISIONING / SUSPENDED | **Included** | SUSPENDED counts if trial future; PROVISIONING only if trial future | Counted if `deletedAt` null | Independent |
| Historical subscriptions | N/A | N/A | N/A | **All rows counted** (no current-only filter in MVP) |

**Attention items:** empty in MVP — entitlement conflicts and expiring overrides have no verified Source of Record (actionability **Blocked**).

---

## 9. PostgreSQL reconciliation evidence (Step 10)

Harness: `apps/api/src/modules/platform-dashboard/tests/platform-dashboard-db.harness.ts`

Runner: `apps/api/scripts/run-platform-dashboard-db.mjs` → `npm run test:platform-dashboard-db`

Spec: `platform-dashboard.reconciliation.postgres.integration.spec.ts`

### Fixture matrix (`pd-fixt-*` tenant slugs)

| Fixture | platform_tenants | tenants.features | Expected bucket / metric |
|---------|------------------|------------------|--------------------------|
| prov | PROVISIONING, LITE, no trial | medical | status + legacy LITE |
| active-trial | ACTIVE, PRO, trial +1d | dental | trialing + dental |
| active-past | ACTIVE, ENTERPRISE, trial −1d | beauty | not trialing + beauty |
| active-no-trial | ACTIVE, LITE, trial null | multi | not trialing + multi |
| susp-trial | SUSPENDED, PRO, trial +1d | unknown clinicType | trialing + unclassified |
| arch-trial | ARCHIVED, ENTERPRISE, trial +1d | {} | not trialing (ARCHIVED excluded) |
| fac-missing | — | `{}` | unclassified |
| fac-null-type | — | `clinicProfile.clinicType` JSON null | unclassified |
| fac-wrong | — | wrong shape | unclassified |
| fac-deleted | — | medical + `deletedAt` set | **excluded** from facility count |

Note: `tenants.features` is **NOT NULL** in the schema; SQL NULL features cannot be persisted. Missing/null clinicType is exercised via empty object and JSON-null `clinicType`.

Subscriptions (5 rows, duplicate platform tenant allowed): one each TRIAL, ACTIVE, SUSPENDED, EXPIRED, CANCELLED.

### Reconciled counts (deterministic seed)

| Metric | Expected value |
|--------|----------------|
| `tenant.total` | 6 |
| `tenant.byStatus` | PROVISIONING=1, ACTIVE=3, SUSPENDED=1, ARCHIVED=1 |
| `tenant.trialing` | 2 (ACTIVE future + SUSPENDED future; ARCHIVED excluded) |
| `legacyPlan.assignment` | LITE=2, PRO=2, ENTERPRISE=2 |
| `subscription.byStatus` | 5 total (1 per status) |
| `facilityType.distribution` | +9 fixture rows (medical=1, dental=1, beauty=1, multi=1, unclassified=5; soft-deleted excluded); reconciled as **baseline + delta** when other tenants exist in `booking_test` |

Permission regression: caller with `permissions=[]` → restricted metrics `permission_limited`, `platformTenant.count` / `groupBy` / `$queryRaw` never invoked.

Controlled-clock trial boundary (fixture `pd-fixt-boundary-*`, fixed `now = 2030-06-15T12:00:00.000Z`):

| Row | Result |
|-----|--------|
| ACTIVE trialEndsAt = now − 1ms | excluded |
| ACTIVE trialEndsAt = now | excluded (`gt`, not `gte`) |
| ACTIVE trialEndsAt = now + 1ms | included |
| ARCHIVED trialEndsAt future | excluded |
| ACTIVE trialEndsAt null | excluded |
| SUSPENDED trialEndsAt future | included |

Expected trialing count under controlled clock: **2**.

---

## 10. Terminology freeze

- **Legacy plan tier** (`platform_tenants.plan`): LITE / PRO / ENTERPRISE assignment. Display as "Legacy plan tiers" — **not** "Plan Version".
- **Plan Version**: deferred; dashboard metric is explicitly unavailable.
- **Unavailable**: no Source of Record; never rendered as zero.
- **Permission-limited**: caller lacks permission; resolver never runs.

---

## 11. Rollback

- Disable or remove `PlatformDashboardModule` / `GET|POST /platform/dashboard*`.
- Restore Overview `PlaceholderPage` and route `status: 'placeholder'` if needed.
- Remove Super Admin `DashboardPage` / `src/dashboard/*` and dashboard i18n keys.
- Remove Dashboard PostgreSQL harness/spec and `test:platform-dashboard-db` if desired.
- Retain Steps 06–09 auth, MFA, RBAC, shell, confirmation, and locale isolation.
- Do **not** restore demo metrics, missing-source-as-zero, unsafe raw SQL interpolation, or GET-prefetchable refresh.

---

## 12. Out of scope

Step 11+ (Tenant Directory/Detail and later domains) is **not implemented** and is not started by this verification.

---

## 13. Step 10 gate status

**Status:** verification evidence complete for final Step 10 acceptance (real PostgreSQL 16 reconciliation + security regressions).

Gate evidence lives in this document (formulas, fixture matrix, POST refresh, instance-local cache) plus:

- `npm run test:platform-dashboard-db` (7/7)
- focused Jest: `platform-dashboard|platform-auth.boundary|platform-mfa-session.security|platform-rbac-security` (74)
- Super Admin `npm test` / `typecheck` / `build`
- `npx prisma validate` / `npx prisma generate`
- Full API `tsc` baseline: only pre-existing `prisma/seeds/permission-seeds.ts` vs `rootDir` (unchanged)

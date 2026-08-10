# Super Admin — Tenant Directory and Detail (Release 47 Step 11)



Read-only platform-operator views for listing and inspecting tenant control-plane metadata. No PHI, no provisioning mutations, no raw features JSON.



## API boundary

### Compatibility decision — Option A (legacy clinic GET preserved)

Step 11 focused verification restores the **legacy clinic JWT** list/detail contract on `GET /platform/tenants*` while moving **Platform JWT** read APIs to a non-colliding path. Clinic-dashboard `fetchPlatformTenants` continues to call `GET /platform/tenants` with clinic JWT + `api.platform_admin` / `view`. Super Admin uses Platform JWT on `/platform/tenant-directory*`. No silent DTO merge — legacy handlers return `PlatformTenantDto`; Platform controller returns Step 11 DTOs only.

| Consumer | Path | Auth | Permission | DTO |
|----------|------|------|------------|-----|
| `clinic-dashboard` `fetchPlatformTenants` | `GET /platform/tenants` | Clinic JWT | `api.platform_admin` / `view` | Legacy `PlatformTenantPageDto` / `PlatformTenantDto` |
| `clinic-dashboard` lifecycle mutations | `POST/PATCH /platform/tenants/*` | Clinic JWT | `api.platform_admin` actions | Legacy |
| Super Admin directory/detail | `GET /platform/tenant-directory` | Platform JWT | `tenant.view` | Step 11 directory/detail DTO |
| Super Admin access summary | `GET /platform/tenant-directory/:id/access-summary*` | Platform JWT | `entitlement.view` | Step 11 access summary DTO |

### Platform JWT routes (`PlatformTenantsController`)

| Route | Permission | Notes |
|-------|------------|-------|
| `GET /platform/tenant-directory` | `tenant.view` | Paginated directory; `Cache-Control: private, no-store` |
| `GET /platform/tenant-directory/:id` | `tenant.view` | Section-composed detail |
| `GET /platform/tenant-directory/:id/access-summary` | `entitlement.view` (+ `tenant.view` in service) | Licensing engine projection |
| `GET /platform/tenant-directory/:id/access-summary/items/:capabilityKey` | `entitlement.view` (+ `tenant.view` in service) | Single capability lookup |

Platform JWT only (`@PlatformAuthRoute`). Clinic `super_admin` tokens are rejected on these routes.

### Legacy clinic JWT routes (`PlatformAdminController`)

| Route | Permission | Notes |
|-------|------------|-------|
| `GET /platform/tenants` | `api.platform_admin` / `view` | Legacy list (`ListPlatformTenantsHandler`) |
| `GET /platform/tenants/:platformTenantId` | `api.platform_admin` / `view` | Legacy detail (`GetPlatformTenantHandler`) |
| `POST/PATCH /platform/tenants/*` | `api.platform_admin` actions | Lifecycle mutations (unchanged) |



## Availability matrix (field-level)



| Section / field | Step 11 availability | Permission | Source |

|-----------------|---------------------|------------|--------|

| **Directory** | | | |

| `items[].platformTenantId`, `tenantId`, `displayName`, `slug` | available | `tenant.view` | `platform_tenants` + `tenants` |

| `items[].status`, `region` | available (Prisma enums) | `tenant.view` | `platform_tenants.status`, `platform_tenants.region` |

| `items[].facilityType` | available | `tenant.view` | `tenants.features.clinicProfile.clinicType` bucketed |

| `items[].legacyPlan` | available / null | `plan.view` | `platform_tenants.plan` (`LITE`/`PRO`/`ENTERPRISE`) |

| `items[].subscriptionSummary` | available / null | `subscription.view` | Latest `platform_subscriptions` row (lateral join) |

| **Detail — identity** | available | `tenant.view` | `platform_tenants` + `tenants.slug` |

| **Detail — facility profile** | | | |

| `facilityType` | available | `tenant.view` | Bucketed clinic type |

| `specialties` | unavailable (`step12_catalog`) | — | Step 12 catalog |

| **Detail — contacts** | unavailable (`no_phi_in_step11`) | — | No PHI in Step 11 |

| **Detail — commercial** | | | |

| `planVersion` | unavailable (`step13_plans`) | — | Step 13 plans |

| `legacyPlan.plan` | available_legacy / permission_limited | `plan.view` | `platform_tenants.plan` |

| `subscription.history` | available (bounded) / permission_limited | `subscription.view` | `platform_subscriptions` |

| `addons` | unavailable (`step15_addons`) | — | Step 15 |

| `overrides` | unavailable (`step15_overrides`) | — | Step 15 |

| **Detail — access** | | | |

| `modules`, `features`, `limits`, `grants` | available / degraded | `entitlement.view` | `LicensingEngineService.resolveLicense(tenantId)` |

| Access without `entitlement.view` | permission_limited (`missing_entitlement_view`) | — | Licensing not invoked |

| `usage` counters | unavailable | — | Not exposed in Step 11 |

| Grant history actors | unavailable | — | Deliberately omitted |

| **Detail — operations** | unavailable (`operations_console_deferred`) when `operations.view`; else permission_limited | `operations.view` to see deferred stub | Step 22 console |

| **Detail — sales** | unavailable (`step23_sales`) | — | Step 23 |

| **Detail — audit link** | available / permission_limited | `audit.view` | Step 21 route placeholder |



## Enum DTO contract



Responses return **Prisma enum strings** (`ACTIVE`, `ME_SOUTH`, `PRO`, `TRIAL`, etc.). Directory/detail no longer map plans to starter/growth domain labels.



Filters accept either Prisma enums or documented lowercase aliases (e.g. `active` → `ACTIVE`, `growth` → `PRO`, `me-south` → `ME_SOUTH`). Unknown filter or sort values return `400 Bad Request` with a code-worthy message.



## Directory behaviour



- Pagination: `page` + `pageSize` (default 25, max 100). `limit=all` rejected. Stable sort uses allowlisted field + `pt.id ASC` tie-break.

- Search (max 64 chars): `displayName` ILIKE, exact UUID on platform/tenant id, `tenants.slug` ILIKE. `%` and `_` escaped. Raw search never written to audit details.

- Filters: `status`, `region`, `trialState` (`active|expired|none`), `facilityType`, `legacyPlan` (requires `plan.view`), `subscriptionStatus` (requires `subscription.view`).

- Sort allowlist: `displayName`, `createdAt`, `updatedAt`, `status`, `region`, `trialEndsAt`. Unknown sort fields rejected.

- Cross-tenant queries run under `withPlatformBypass` after permission check.

- Instance-local directory rate limit per platform user (`PLATFORM_TENANTS_DIRECTORY_RATE_LIMIT`, default 60/min).



## Access summary — entitlement source types



When `entitlement.view` is present, capabilities include `sourceType` on each item:



| `sourceType` | Meaning |

|--------------|---------|

| `current_license_projection` | Live output from `LicensingEngineService` |

| `plan_version_default` | Reserved for Step 13 plan-version catalog |

| `addon` | Reserved for Step 15 add-ons |

| `governed_override` | Reserved for Step 15 overrides |

| `operational_flag` | Operational toggles (future) |

| `legacy_plan_assignment` | Legacy `platform_tenants.plan` column |

| `legacy_license` | Pre-migration license rows |

| `unknown` | Unclassified source |



Step 11 runtime authority is `current_licensing_engine_projection` only.



## Audit

Directory list audits use sentinel tenant UUID `00000000-0000-4000-8000-000000000047`
(`PLATFORM_AUDIT_SENTINEL_TENANT_ID`) with `actorRoles: ['platform']`. The adapter upserts that
sentinel under `withPlatformBypass` before insert. Detail/access views audit with the governed
tenant's real `tenantId`.

### Sentinel identity (code-governed)

| Field | Constant |
|-------|----------|
| ID | `PLATFORM_AUDIT_SENTINEL_TENANT_ID` = `00000000-0000-4000-8000-000000000047` |
| Slug | `PLATFORM_AUDIT_SENTINEL_SLUG` = `pt-directory-audit-sentinel` |
| Display name | `PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME` |
| Table | `tenants` only (FK for `audit_entries.tenantId`); **not** in `platform_tenants` |
| Marker | Reserved ID + slug; exclusion via `excludePlatformAuditSentinelSql` / `excludePlatformAuditSentinelTenantWhere` |

**Why it exists:** `audit_entries.tenantId` is a non-null FK to `tenants`. Cross-tenant directory
reads have no single customer tenant, so the sentinel is a stable FK host. It has no subscription,
license, provisioning workflow, or tenant application credentials.

**Isolation:** facility-type Dashboard SQL, Tenant Directory joins, Detail lookup, licensing
`resolveLicense` (exact reserved-id fail-closed before cache/DB), and clinic `platform_tenants`
list/find exclude the sentinel at the database or guard layer. Tenant write boundaries
(`PlatformTenant.provision`, `ProvisionPlatformTenantHandler`, `PrismaPlatformTenantRepository.save`,
`PrismaTenantRepository.save`) reject the reserved identity via
`assertNotPlatformAuditSentinelTenantId` and emit `platform_audit_sentinel_tenant_collision_rejected`.
**Lifecycle:** reserved-id protection is always active; the persisted row may be lazy-absent until
an approved audit adapter upserts it; absence is not a startup fault. Arbitrary / similar-looking
UUIDs do not trigger sentinel handling. Duplicate identity is prevented by `tenants.id` PK.
PG suite `platform-tenants-sentinel-isolation.postgres.integration.spec.ts` proves
before/after/concurrent Dashboard + Directory equality, absent-row fail-closed, and repository
collision rejection. Application import/restore write path: **Not Applicable**.
Monitoring: `platform_audit_sentinel_license_rejected` / `platform_audit_sentinel_tenant_collision_rejected`
(bounded; no PHI).

### Stable audit actions

| Event | Action key | Policy |
|-------|------------|--------|
| Directory viewed / searched / filtered | `platform_tenants.directory.listed` | Single action; metadata distinguishes search/filters |
| Detail viewed | `platform_tenants.detail.viewed` | Persisted |
| Access summary viewed | `platform_tenants.access_summary.viewed` | Persisted |
| Capability explanation | `platform_tenants.capability_explanation.viewed` | Persisted on item endpoint (`kind` ≠ limit) |
| Limit explanation | `platform_tenants.limit_explanation.viewed` | Persisted on item endpoint (`kind` = limit) |
| Directory / commercial / section denials | — | **Not Applicable** — ForbiddenException paths do not write audit rows (no sensitive denial payload) |

Audit details never include raw search strings — only `searchApplied`, `searchLength`, and
allowlisted filter names/values (status, facilityType, etc.). `appliedFilters.search` is the
literal marker `applied`, never the query text.

**correlationId:** only persisted when already a UUID (session ids are not stored).

**Failure policy (best-effort):** read APIs catch audit failures, add `audit_degraded` warning, and still return data.


## Super Admin UI



- `/tenants` — directory table with filters and pagination (status filter sends Prisma enums).

- `/tenants/:tenantId` — read-only detail with context banner, unavailable sections (contacts, plan version, add-ons, overrides), and access modules/limits when entitled.

- API client: `listPlatformTenants`, `getPlatformTenantDetail`, `getPlatformTenantAccessSummary` on `platform-auth-api.ts` (paths under `/platform/tenant-directory`).

## Tests

```bash
cd apps/api
npm run test:platform-tenant-directory-db   # directory + access-summary + audit + sentinel isolation PG specs
npm run test:platform-dashboard-db
npx jest --testPathPattern="platform-tenants|platform-admin.*quer|platform-auth.boundary" --runInBand --no-coverage --testPathIgnorePatterns=postgres
cd ../super-admin && npm test && npm run typecheck && npm run build
```

### PostgreSQL evidence

- **Directory** (`platform-tenants-directory.postgres.integration.spec.ts`): full pagination (no duplicate ids), displayName sort tie-break, filter reconciliation, search by name/slug, subscription filter auth, Prisma enum responses (≥80 `pt-fixt-` fixtures).
- **Access summary** (`platform-tenants-access-summary.postgres.integration.spec.ts`): seeds LITE/PRO/ENTERPRISE tenants with varied subscription statuses; calls real `LicensingEngineService.resolveLicense` after `invalidateCache`; asserts capability `sourceType`, UNLIMITED limits, no raw features JSON, legacy plan distinct from uiPlan, grants not labeled addon; known module item lookup + unknown → 404; repeated resolve does not mutate license.
- **Audit persistence** (`platform-tenants-audit.postgres.integration.spec.ts`): real `AuditTrailPlatformTenantsAuditLog` under `withPlatformBypass` (sentinel upsert + insert); directory search/filter audits without raw search; serialized-row redaction of forbidden sentinels; capability/limit explanation actions; correlation ID UUID-only; denial policy N/A proven; detail/access actions persisted with correct `resourceId`; directory list succeeds when audit write fails (best-effort).
- **Sentinel isolation** (`platform-tenants-sentinel-isolation.postgres.integration.spec.ts`): mandatory before/after/repeated/concurrent Dashboard + Directory equality; search/filter/detail not-found; licensing NotFound + no cache; clinic list exclusion; customer row not overwritten.

### Frontend coverage (Super Admin `src/tenants/`)

~20 focused Vitest cases across `tenant-directory.spec.tsx`, `tenant-detail.spec.tsx`, and `tenants-pages.spec.tsx`: search/filter/pagination, permission-limited columns, stale-request guard, i18n/RTL, read-only banners, unavailable sections, access summary presentation, `SectionExplanation` keyboard behaviour.

## Final gate status

| Gate | Status |
|------|--------|
| Route compatibility Option A | **Pass** — legacy clinic GET restored; Platform reads on `/platform/tenant-directory` |
| PostgreSQL directory pagination | **Pass** |
| PostgreSQL access-summary / LicensingEngine | **Pass** |
| PostgreSQL audit persistence + redaction | **Pass** (best-effort failure policy documented) |
| PostgreSQL sentinel isolation | **Pass** (Dashboard + Directory before/after/concurrent) |
| Frontend focused coverage | **Pass** (~22 tenant-focused + shell/i18n regressions; 126 Super Admin total) |
| Step 06–10 focused regressions | **Pass** |
| Prisma validate / generate | **Pass** |
| Full API typecheck | **Pass** — only accepted `permission-seeds.ts` / `rootDir` baseline |
| Final Step 11 gate | **Eligible for final acceptance** |
| Auth boundary | Pass — `@PlatformAuthRoute` on new controller; clinic JWT rejected |
| Access-summary PG reconciliation | Pass (when `RUN_PLATFORM_DB_SECURITY=true`) |
| Audit PG persistence + redaction | Pass (when `RUN_PLATFORM_DB_SECURITY=true`) |
| Super Admin frontend tests | Pass — directory + detail specs expanded |
| Step 12+ scope | Not started (by design) |



## Rollback



Step 11 is read-only. Roll back by reverting the `platform-tenants` module and Super Admin routes; no schema migration is Step-11-specific (uses existing `platform_tenants` / `platform_subscriptions`). Directory audit sentinel UUID is stable and safe to leave. Never restore sentinel visibility in customer metrics/Directory, licensing for the sentinel, or raw search/license payloads in audit.



## Recommended next step



**Step 12** — specialty catalog on facility profile (`specialties` section) with governed catalog source and filter support. Do not implement Step 12 in the Step 11 delivery.



## Non-goals (Step 11)



- Provisioning / lifecycle mutations (remain on clinic JWT platform-admin).

- Plan Version catalog, add-ons, overrides UI.

- PHI contact fields.

- Operations console (deferred to Step 22).


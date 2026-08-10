# Release 47 Step 12 — Healthcare Catalog and Capability Model

## Purpose

Authoritative Platform Source of Record for healthcare catalog **metadata**:

- Facility Types
- Specialties
- Modules
- Features
- Limits
- Aliases
- Compatibility / dependency rules
- Localized display metadata (`en-US`, `ar-SY`)
- Lifecycle status

This catalog does **not** grant runtime entitlements. `LicensingEngineService` remains the runtime authority until Step 18.

## Bounded context

| In scope | Out of scope |
|----------|--------------|
| Catalog identity & stable keys | Plans / Plan Versions (Step 13) |
| Localization of catalog content | Plan Entitlements (Step 14) |
| Lifecycle DRAFT→ACTIVE→DEPRECATED→RETIRED | Add-ons / Overrides (Step 15) |
| Data-driven compatibility validation | Subscription management (Step 16) |
| Drift detection vs `LICENSED_*` | Tenant provisioning (Step 17) |
| Platform management APIs + Super Admin UI | Effective entitlement runtime (Step 18) |
| | Feature flags as purchased access |
| | Provider/patient specialties, PHI |

## Stable keys

Regex: `^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$`

| Kind | Prefix |
|------|--------|
| FACILITY_TYPE | `facility_type.` |
| SPECIALTY | `specialty.` |
| MODULE | `module.` |
| FEATURE | `feature.` |
| LIMIT | `limit.` |

Keys are immutable after create. Retired keys are never reused. No hard-delete API.

## Lifecycle

| State | Semantics |
|-------|-----------|
| DRAFT | Editable; not selectable for production combinations |
| ACTIVE | Available for future Plan/Add-on/provisioning selection |
| DEPRECATED | Resolvable; not recommended for new selection |
| RETIRED | Historical only; cannot be newly referenced |

High-impact transitions (activate / deprecate / retire / reactivate) require reason + optimistic concurrency. Frontend confirmation / step-up follows Step 09 when Platform policy marks the permission high-impact.

## Compatibility rule types

- `REQUIRES`
- `REQUIRES_ANY_OF` (grouped by `anyOfGroupKey`)
- `INCOMPATIBLE_WITH`
- `ALLOWED_FOR`
- `NOT_ALLOWED_FOR`

**Precedence:** unknown/inactive → incompatible → not-allowed → missing requires → missing any-of → allowed-for fail → deprecation warnings.

Evaluation is deterministic and order-independent. No executable expressions. No plan-name conditions.

Preview disclaimer: not an entitlement, not a subscription decision, not provisioning.

## Seed inventory (evidence-based)

### Facility Types

| Key | Legacy alias (`legacy_clinic_type`) |
|-----|-------------------------------------|
| `facility_type.general_clinic` | `medical` |
| `facility_type.dental_clinic` | `dental` |
| `facility_type.cosmetic_center` | `beauty` |
| `facility_type.laboratory` | — |
| `facility_type.radiology_center` | — |
| `facility_type.multi_specialty_center` | `multi` |
| `facility_type.hospital` | — |

`unclassified` remains a Dashboard/Directory runtime bucket only — not a catalog seed.

Ambiguous legacy `medical` is **not** remapped to hospital/laboratory/radiology.

### Specialties

From ClinicProfile UI options + dentistry: `specialty.general_medicine`, `specialty.dentistry`, `specialty.pediatrics`, `specialty.dermatology`, `specialty.orthodontics`, `specialty.cosmetic`, `specialty.physiotherapy`.

Provider/analytics specialties are **not** imported.

### Modules / Features / Limits

Seeded from `LICENSED_MODULES`, `LICENSED_FEATURES`, and `PlanLimits` keys with aliases:

- `licensed_module_id`
- `licensed_feature_id`
- `plan_features_key` (backendFeature links)
- `plan_limits_key`

### Capability gaps (documented, not fabricated)

- No `module.laboratory` product module yet
- No `module.radiology` product module yet

Facility types exist for future selection only.

## Transitional runtime boundary

| Authority | Owner |
|-----------|--------|
| Catalog metadata | Healthcare Catalog SoR |
| Runtime license / module / feature / limit decisions | `LicensingEngineService` + static registries |
| Tenant facility JSON display | Existing classifier / dual-read (unchanged) |

Catalog activation does **not** change clinic navigation, controller guards, or tenant request paths.

## Permissions

Reuse Step 08 keys (exact kind isolation — no cross-kind mutation via generic `anyOf`):

| Kind / surface | View | Manage |
|----------------|------|--------|
| Facility Type | `facility-type.view` | `facility-type.manage` |
| Specialty | `specialty.view` | `specialty.manage` |
| Module | `module.view` | `module.manage` |
| Feature | `feature.view` | `feature.manage` |
| Limit | `limit.view` | `limit.manage` |
| Compatibility rules | `compatibility-rule.view` | `compatibility-rule.manage` |

Lifecycle transitions require the item's **manage** permission **and** fresh server step-up.
Alias add/retire follows the item kind manage permission.
Compatibility manage does **not** grant item mutation; item manage does **not** grant rule mutation.

Assigned to Platform Owner (explicit grants), Platform Administrator, Plans & Subscription Manager; Auditor receives **view** keys only. No role-name authorization. No `super_admin`. No Owner wildcard.

## Server step-up (high-impact)

Enforced in `HealthcareCatalogService` via `PlatformAssuranceService.requireStepUp` on the **current** session (Step 07/09 model):

| Operation | Routes |
|-----------|--------|
| Item activate / deprecate / retire / reactivate | `POST .../items/:id/{activate\|deprecate\|retire\|reactivate}` |
| Rule activate / retire | `POST .../compatibility-rules/:id/{activate\|retire}` |
| Alias retire when legacy facility alias is in active tenant use | `POST .../items/:id/aliases/:aliasId/retire` |

Missing / stale step-up → `403 PLATFORM_STEP_UP_REQUIRED`. Step-up never grants a missing permission. Optimistic concurrency still applies after valid step-up.

Frontend: `ConfirmationDialog` via `useHighImpactAction`, then `StepUpModal` only if the API returns step-up required. Cancel / Escape send no mutation.

## APIs

Base: `/platform/healthcare-catalog` (Platform JWT only)

| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/items` | POST accepts `Idempotency-Key`; creates **DRAFT** only |
| GET/PATCH | `/items/:id` | OCC via `expectedVersion` |
| POST | `/items/:id/activate\|deprecate\|retire\|reactivate` | Reason + version + step-up |
| POST | `/items/:id/aliases` | Add alias |
| POST | `/items/:id/aliases/:aliasId/retire` | Retire alias |
| GET | `/items/:id/references` | Bounded buckets; Plan/Add-on/Override unavailable |
| GET/POST | `/compatibility-rules` | POST creates **DRAFT**; Idempotency-Key supported |
| POST | `/compatibility-rules/:id/activate\|retire` | Reason + version + step-up |
| POST | `/validate-selection` | Read-only preview; not entitlement |
| GET | `/drift-report` | Non-mutating |

`Cache-Control: private, no-store`. No hard-delete route. Safe DTOs only (no raw Prisma / license / PHI).

## Audit

Durable rows via `AuditTrailHealthcareCatalogAuditLog` on the Platform audit sentinel tenant.

Allowlisted metadata examples: item/rule id, canonical key, kind, lifecycle from/to, field names, locale codes, alias namespace, rule type, subject/target keys, expected/resulting version, reason category, result.

**Not persisted:** full translations/descriptions, raw bodies, tokens, session IDs, MFA, SQL/stack, tenant PHI, license payloads.

**Failure policy (best-effort):** catalog mutation succeeds if durable audit write fails; warn-only; no raw request fallback logging; sentinel remains isolated.

## Idempotency & concurrency

**Final contract (durable PostgreSQL):** `CatalogIdempotencyService` + table `healthcare_catalog_idempotency`
(migration `20260724120000_phase47_healthcare_catalog_idempotency`).

| Aspect | Contract |
|--------|----------|
| Scope | `actorId` + `operation` + `idempotencyKey` (unique) |
| Operations | `catalog.createItem`, `catalog.createRule` |
| Request identity | SHA-256 of deterministic canonical payload (sorted keys); **not** raw body storage |
| Stored fields | request hash, result resource type/id, status, createdAt, expiresAt |
| Never stored | raw request bodies, tokens, session IDs, full translation/description text |
| Replay | same key + same hash → reload original item/rule by id |
| Conflict | same key + different hash → 409 |
| Atomicity | idempotency row written in the same `withPlatformBypass` transaction as create |
| Retention | 7 days (`expiresAt`); expired rows are ignored on lookup; ops cleanup via `CatalogIdempotencyService.purgeExpired()` (bounded delete of expired only; no Step 12 scheduler) |
| Cross-replica / restart | durable in PostgreSQL during retention window |
| Key syntax | `^[A-Za-z0-9._:-]{1,128}$` |

Also: canonical key / alias namespace / rule tuple uniqueness under concurrent creates → one winner.
Updates and lifecycle use `updateMany` + `expectedVersion` (stale → 409).

## Final gate evidence (PostgreSQL 16)

Verified on approved local stack `booking-system-pg-test` → `booking_test` @ `localhost:5433` (PostgreSQL **16.14**):

### Seed inventory reconciliation (corrected)

| Metric | Exact value |
|--------|-------------|
| Inventory / persisted items (clean DB) | **68** |
| Facility Types | **7** |
| Specialties | **7** |
| Modules | **21** |
| Features | **21** |
| Limits | **12** |
| Per-kind sum | **68** (= total) |
| Translations total | **136** |
| `en-US` translations | **68** |
| `ar-SY` translations | **68** |
| Missing `en-US` / `ar-SY` | **0** |
| Duplicate `(itemId, locale)` | **0** |
| Seed compatibility rules | **13** |
| Seed run 1 ≡ seed run 2 | **identical** persisted counts |

**Prior mismatch root cause:** documentation incorrectly listed Feature **22** and translations **138**. Those figures included a leftover non-seed test row (`feature.lifecycle_race`, `systemSeeded=false`) left in `booking_test` after an earlier suite. Inventory source `ALL_SEED_ITEMS` was always **68** (Feature **21**). Clean truncate + double seed yields **68 / 136**. Seed CLI now reports both inventory upsert counts and persisted PostgreSQL counts.

### HTTP authentication

- Class-level `@PlatformAuthRoute()` on `/platform/healthcare-catalog`
- Every handler family covered by JwtAuthGuard Platform-principal boundary tests
- JwtStrategy rejects wrong issuer, wrong audience, wrong principal, revoked JTI, and platform tokens carrying `tenantId`
- Clinic / tenant / patient / pre-auth / step-up-as-access rejected
- Valid Platform session accepted with `tenantId = null`
- Catalog controllers/services do **not** call `/platform/auth/activity` or `touchActivity` (passive reads do not extend interactive idle)
- Suspended users / MFA-incomplete sessions cannot obtain Platform access tokens (enforced at Platform login/refresh/session completion — Step 08); Catalog routes consume only completed Platform access sessions
- Lifecycle routes additionally require server-verified fresh step-up (does not replace access token)

### Audit / idempotency / concurrency

- Durable `audit_entries` under Platform audit sentinel for mutation families (create/update/lifecycle/alias/rule + stale rejection)
- Serialized redaction: no full translations, descriptions, alias notes, tokens, session IDs, SQL/URLs, PHI
- Best-effort audit: mutation commits when audit write fails
- Durable PostgreSQL idempotency: actor+operation+key; replay after service recreation; failed create leaves no completed record; 7-day retention + `purgeExpired()` ops cleanup (no scheduler in Step 12)
- Concurrent canonical-key / alias / rule creates → one winner; OCC stale updates; update-versus-retire deterministic; no orphan translations/aliases on failed create

### Regression commands

- `npm run test:platform-healthcare-catalog-db` — **22 passed** (foundation + final-gate seed/audit/idempotency/concurrency)
- Catalog unit + HTTP auth boundary — **151 passed**
- `npm run test:platform-dashboard-db` — **7 passed** (Step 10)
- `npm run test:platform-tenant-directory-db` — **20 passed** (Step 11)
- `npm run test:platform-db-security` — **11 passed** (Step 08)
- `LicensingEngineService` unit suite — **7 passed**
- Super Admin full suite — **129 passed**; typecheck/build — **passed**
- Prisma validate/generate — **passed**
- Full API typecheck — only accepted pre-existing `permission-seeds.ts` rootDir error
- No Plan / Plan Version / Add-on / Override / Subscription SoR tables introduced
- **Step 13 not implemented**

**Final Step 12 gate result:** reconciliation passed — recommend final Step 12 acceptance.

## Super Admin UI

- Route `/catalog` status `available` (typed registry)
- Kind tabs (permission-filtered), search, lifecycle filter, missing-translation filter, pagination
- Create Draft / edit forms (en-US + ar-SY), Limit metadata, parent specialty, owning module
- Alias management, reference panel, compatibility-rule builder + lifecycle
- Lifecycle confirmation + step-up; no hard-delete; no Plan/entitlement value fields; no browser draft storage
- Compatibility preview preserved
- English + Arabic message parity; RTL-friendly key fields (`dir="ltr"`)

## Drift detection

`GET /platform/healthcare-catalog/drift-report` and `buildCatalogDriftReport()` compare runtime registries to aliases. Non-mutating. Feature-flag env keys are explicitly ignored.

## Migrations & seed

- Migration: `20260723180000_phase47_healthcare_catalog`
- Idempotency migration: `20260724120000_phase47_healthcare_catalog_idempotency` (additive)
- Seed: `npm run seed:healthcare-catalog` (idempotent; preserves admin-edited translations)
- PG tests: `npm run test:platform-healthcare-catalog-db`

## Rollback

1. Disable Catalog **mutation** routes / lifecycle controls; keep read-only list + preview if needed.
2. Disable rule builder / reference mutation UI; restore overview-only Catalog UI.
3. Optionally stop writing `healthcare_catalog_idempotency` (retain table until safe drop).
4. Retain Catalog tables and seed until a safe data rollback is available.
5. Must preserve Steps 06–11, licensing runtime, sentinel isolation, and legacy facility JSON behavior.

Never restore: lifecycle without server step-up, cross-kind manage, logger-only audit claims, raw bodies in audit/idempotency, stale-write overwrites, hard-delete, plan-name rules, browser-stored drafts, runtime dependency on incomplete Catalog, **misleading process-local Idempotency-Key claims**.

## Future integration points

- Step 13: Plans select ACTIVE catalog items
- Step 14: Plan Entitlements reference Module/Feature/Limit keys
- Step 15: Add-ons / Overrides reference catalog
- Step 17: Provisioning validates compatibility
- Step 18: Runtime may consume catalog + entitlements (not before)

**Step 13 is not implemented in this completion.**

## Evidence matrix

See discovery inventory embedded in `domain/catalog-seed.inventory.ts` and Step 01 discovery doc. Every seeded item cites `LICENSED_*`, facility classifier, or ClinicProfile specialty options.

## Gate status

**Step 12 final verification passed** on approved PostgreSQL 16 test infrastructure with durable idempotency, Catalog PG suite, Dashboard/Directory/security PG suites, auth boundary tests, Super Admin full suite, and LicensingEngineService non-regression.

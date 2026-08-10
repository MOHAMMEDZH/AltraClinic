# Super Admin — Plan Entitlements and Limits (Release 47 Step 14)

## Bounded context

Step 14 is the **Platform commercial-definition plane** for Plan Version capability entitlements and typed Limit assignments.

It is **not**:

- tenant runtime access
- subscription assignment
- Add-ons / Overrides (Step 15)
- Effective Entitlement Runtime (Step 18)
- a replacement for `LicensingEngineService`

A Plan Version entitlement means: *this Catalog capability is included in the commercial definition of that Plan Version.*

A Plan Version Limit means: *this typed commercial Limit value is defined for that Plan Version.*

Missing Limit assignment = **Unconfigured**. Missing never means Unlimited.

Publishing a Plan Version in Step 14 does **not** change tenant access.

## Discovery evidence (mapping matrix summary)

### Runtime SSOT sources

| Source | Path | Role |
|--------|------|------|
| Licensed modules | `apps/api/src/modules/subscription/domain/config/licensing.config.ts` | Module enablement by UI tier |
| Licensed features | same | Feature access states |
| Plan limits | `apps/api/src/modules/subscription/domain/config/plan-limits.config.ts` | Numeric limits; `-1` = Unlimited |
| Catalog seed | `apps/api/src/modules/platform-healthcare-catalog/domain/catalog-seed.inventory.ts` | Canonical keys 68/136/68/13 inventory |
| Plans seed | `apps/api/src/modules/platform-plans/domain/plan-seed.inventory.ts` | `plan.lite` / `plan.pro` / `plan.enterprise` |

### Entitlement-eligible Catalog kinds (frozen)

| Kind | Entitlement-eligible? | Notes |
|------|----------------------|-------|
| MODULE | Yes | Explicit commercial grant |
| FEATURE | Yes | Explicit commercial grant |
| FACILITY_TYPE | No | Eligibility selector — not seeded as Plan grants |
| SPECIALTY | No | Eligibility selector — not seeded as Plan grants |
| LIMIT | No | Typed Limit assignments only |

### Plan → UI tier mapping for seed

| Canonical Plan | UI tier | Limits key |
|----------------|---------|------------|
| `plan.lite` | starter | lite |
| `plan.pro` | professional | pro |
| `plan.enterprise` | enterprise | enterprise |

`business` remains Option B unresolved non-Plan UI tier — **not seeded**.

### Seed decision

Exact mappings from `LICENSED_MODULES` / `LICENSED_FEATURES` / `PLAN_LIMITS` are seeded into **Draft** Plan Versions only when `commercialDefinitionOwnership = UNINITIALIZED`.

Ownership model (`PlatformPlanCommercialDefinitionOwnership`):

| State | Meaning | Seed behavior |
|-------|---------|---------------|
| `UNINITIALIZED` | Seed-owned empty Draft (or newly created by seed) | May populate entitlements/Limits once |
| `SEED_INITIALIZED` | Seed already applied | Second seed is a no-op |
| `ADMINISTRATOR_OWNED` | Admin createDraft / clone / putEntitlements / putLimits / apply-required | Never overwritten — including intentionally empty |

Child-row count alone is **not** used to decide ownership.

Unresolved (do not seed):

- Facility Types / Specialties as commercial grants
- `business` UI tier
- Orphan `PlanFeatures` keys without exact `LICENSED_FEATURES` ids (`loyaltyProgram`, `multiCurrency`, `caregiverAccess`, `commissionRules`, `smsInvites`)
- Fabricated Unlimited from missing values

Full programmatic matrix: `plan-entitlement-seed.inventory.ts` (`entitlementMappingMatrix()`, `seededLimitsForPlan()`, `UNRESOLVED_ENTITLEMENT_MAPPINGS`).

### Existing Published versions

Step 13 production seed created **no** Published Plan Versions. Metadata-only Published versions created in tests remain immutable. Readiness reports `LEGACY_UNCONFIGURED` when Published/Retired with zero entitlements and zero Limits. Operators must **clone** to Draft before configuring.

## Semantics

### Explicit entitlements

Only operator-persisted Catalog keys (MODULE/FEATURE). Dependencies are **not** silently persisted. Optional `apply-required` helper requires confirmation, OCC, audit, and never adds incompatible capabilities.

### Missing entitlement

Means not included in the commercial definition — not a runtime deny, not an Override, not a Feature Flag.

### Limits

| State | Meaning |
|-------|---------|
| CONFIGURED | Typed `valueText` present, `unlimited=false` |
| UNLIMITED | `unlimited=true`, `valueText=null` |
| UNCONFIGURED | No assignment row |

Typed validation uses Catalog `limitValueType`, min/max, zero, Unlimited support, and owning Module entitlement when present.

### Empty entitlement set

**Warning** `empty_entitlement_set` — not a hard publication blocker (no evidenced minimum baseline in playbook).

## Data model

- `PlatformPlanVersionEntitlement` — unique `(planVersionId, catalogItemId)`, Restrict FKs
- `PlatformPlanVersionLimit` — unique `(planVersionId, catalogItemId)`, CHECK unlimited XOR valueText, Restrict FKs

No tenant ID, subscription ID, Add-on, Override, or usage columns.

Concurrency boundary: parent Plan Version `rowVersion`.

## Migration

Additive:

- `20260724190000_phase47_plan_entitlements` — entitlement and Limit child tables
- `20260725140000_phase47_plan_commercial_definition_ownership` — ownership enum + column

Preserves Steps 06–13, Catalog 68/136/68/13, Plans fingerprints, subscriptions, licensing.

Clean inventory (double seed): 3 Plans, 3 Drafts (`SEED_INITIALIZED`), 91 entitlements (16+33+42), 36 Limits (12×3), 0 Published, 0 duplicates, no Add-on/Override/runtime tables.

## APIs

| Method | Path | Permission | Bucket | OCC | Idempotency | Audit |
|--------|------|------------|--------|-----|-------------|-------|
| GET | `/platform/plans/:planId/versions/:versionId/entitlements` | `plan-entitlement.view` | read-heavy | — | — | — |
| PUT | same | `plan-entitlement.manage` | mutation | parent `rowVersion` | `plan.replaceEntitlements` | `platform_plan_version.entitlements_replaced` |
| POST | `.../entitlements/apply-required` | `plan-entitlement.manage` | mutation | parent `rowVersion` | `plan.applyRequiredDeps` | `required_dependencies_applied` **only when deps added** (no-op: completed idempotency, no mutation audit) |
| GET | `.../limits` | `plan-limit.view` | read-heavy | — | — | — |
| PUT | `.../limits` | `plan-limit.manage` | mutation | parent `rowVersion` | `plan.replaceLimits` | `platform_plan_version.limits_replaced` |
| GET | `.../entitlement-preview` | `plan-entitlement.view` | read-heavy | — | — | — |
| GET | `.../readiness` | `plan-version.review` (extended) | read-heavy | — | — | — |
| POST | `.../clone` | `plan-version.create` | high-impact | — | `plan.cloneVersion` | `platform_plan_version.cloned` (+ child counts) |
| POST | `.../publish` | `plan-version.publish` + step-up | high-impact | parent `rowVersion` | `plan.publishVersion` | `platform_plan_version.published` (+ counts, fingerprint schema v2) |
| GET | `.../compare` | `plan-version.view` | read-heavy | — | — | — |

All responses: `Cache-Control: private, no-store`. Class: `@PlatformAuthRoute()` + `PlatformPermissionGuard`. No Clinic/tenant-context metadata. Passiveivity not extended on passive reads.

## Step 14 final verification gate (evidence)

Evidence suites:

- `platform-plans.auth.boundary.spec.ts` — every handler family + JwtStrategy issuer/audience/principal/revoked; suspended `canAuthenticate=false`; MFA-incomplete preauth rejected; real step-up rejected as access; tenant headers ignored
- `platform-plans.authorization.spec.ts` — Step 13/14 permission isolation + repository non-execution; Platform Owner no wildcard; `super_admin` / tenant permissions / empty set / step-up-only fail closed
- `platform-plan-entitlements.postgres.integration.spec.ts` — seed, OCC, publish immutability, readiness
- `platform-plan-entitlements-final-gate.postgres.integration.spec.ts` — ownership, durable audit/redaction, per-op idempotency, concurrency, typed Limits, fingerprint, rate limits, retention
- `platform-plan-entitlements-closure.postgres.integration.spec.ts` — injected mid-transaction rollback, Option A orphan handling, full mutation/high-impact/read-heavy `429`, persisted ownership fixtures, production failure-hook absence
- `platform-plan-entitlements-concurrent-idempotency.postgres.integration.spec.ts` — concurrent equivalent same-key races for entitlements/Limits/apply-required/clone/publish
- `platform-plan-clinic-runtime.compat.spec.ts` — LicensingEngineService sentinel governed invariant + Clinic JWT rejection on Step 14 handlers + no Step 14 table lookup in runtime source
- `login-completion.session-class.spec.ts` — Clinic login completion rejects `sessionClass=platform`

Catalog supported Limit value types (Prisma enum): `INTEGER`, `DECIMAL`, `DURATION`, `BYTES`, `COUNT`. `BOOLEAN` is **Not Applicable** (not in Catalog SoR).

### Injected mid-transaction rollback

Test-only seam: optional `PLATFORM_PLANS_TX_FAILURE_HOOK` DI token. **Not registered** in `PlatformPlansModule`. Injection points covered: after entitlement/Limit delete and partial insert; after parent `rowVersion` bump; after clone entitlement/Limit partial copy and source linkage; after fingerprint before publish commit; before idempotency complete; before transaction commit. Each rejection leaves parent `rowVersion`, children, lifecycle, fingerprint, completed idempotency, and success audit unchanged. OCC losers are **not** used as rollback evidence.

Option A completed-only: orphan non-completed rows are purged on begin and never replay as success; failed transactions leave no idempotency row.

### Actual Step 14 rate-limit buckets

| Route family | Bucket |
|--------------|--------|
| replace entitlements / Limits / apply-required | mutation |
| clone / publish / retire | highImpact |
| entitlement/Limit reads, preview, readiness, compare | readHeavy |

Threshold enforcement proven with real service execution: `429`, no repository write, no success audit, no completed idempotency, Draft lifecycle and fingerprint unset after publish rejection.

### Seed-ownership fixtures (persisted)

| Fixture | Seed run 1 | Seed run 2 |
|---------|------------|------------|
| `UNINITIALIZED` Draft | becomes `SEED_INITIALIZED` with commercial children | no-op; counts stable |
| `SEED_INITIALIZED` Draft | unchanged | unchanged |
| `ADMINISTRATOR_OWNED` empty Draft | remains empty | remains empty |
| `ADMINISTRATOR_OWNED` non-empty Draft | custom children preserved | unchanged |
| Published (metadata-only or Step 14) | untouched | fingerprint/lifecycle unchanged |
| Retired | untouched | fingerprint/lifecycle unchanged |

### Concurrent idempotency matrix (final two-item gate)

| Operation | Concurrent callers | Mutations | Success callers | Equivalent 409 | Result identity | Parent version / fingerprint | Completed rows | Success audits | Duplicate children | Service recreation | Different-payload |
|-----------|-------------------|-----------|-----------------|----------------|-----------------|------------------------------|----------------|----------------|--------------------|--------------------|-------------------|
| replace entitlements | 2 | 1 | 2 | 0 | equal | `rowVersion` +1 once | 1 | 1 `entitlements_replaced` | 0 | **recreated graph → same result** | **409** |
| replace Limits | 2 | 1 | 2 | 0 | equal | `rowVersion` +1 once | 1 | 1 `limits_replaced` | 0 | **recreated graph → same result** | **409** |
| apply-required **mutating** | 2 | 1 (deps added) | 2 | 0 | equal | `rowVersion` +1 once | 1 | 1 `required_dependencies_applied` | 0 | **recreated graph → same result** | **409** |
| apply-required **no-op** | 2 | 0 children; no version bump | 2 | 0 | equal | unchanged | 1 | **0** (no mutation audit) | 0 | **recreated graph → same result** | **409** |
| clone | 2 | 1 Draft | 2 | 0 | same Draft id | same version number | 1 | 1 `cloned` | 0 | **recreated graph → same Draft** | **409** (different source) |
| publish | 2 | 1 transition | 2 | 0 | same fingerprint | fingerprint set once | 1 | 1 `published` | n/a | **recreated graph → same FP** | **409** (different reason/OCC) |

Apply-required mutating vs no-op are **independent fixtures** (never combined as ≤1).

**Service-recreation method:** discard the original Nest service instance; construct a new `PlanEntitlementsService` / `PlatformPlansService` (+ new `PlanIdempotencyService` via harness) against the same PostgreSQL; replay same actor/operation/key/canonical payload. No process-local response cache is reused. After recreation: mutation count, success-audit count, and completed-idempotency count remain exactly one for real mutations (zero mutation audits for apply-required no-op).

### Exact Healthcare Catalog inventory (Step 12 SoR)

Authoritative PostgreSQL seed reconciliation:

- Items: **68**
- Translations: **136**
- Aliases: **68**
- Compatibility rules: **13**

Step 14 commercial-definition seeds do not alter Catalog inventory. No Step 15 Catalog items.

### Bounded winner-reload contract

| Parameter | Value |
|-----------|-------|
| `PLAN_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS` | 25 |
| `PLAN_IDEMPOTENCY_REPLAY_DELAY_MS` | 20 (fixed delay; no busy loop) |
| Max duration | ≈ 500ms excluding query time |
| Committed winner | Replayed as soon as completed row is visible |
| Timeout | `503 Service Unavailable` (`IdempotencyEquivalentReplayTimeoutError`) — **retryable**, never conflicting-reuse 409 |
| Conflicting reuse | Different fingerprint on same key → **409** only |
| DB-lock details | Never exposed |

### Licensing sentinel decision (Option B — retained)

**Sentinel decision: Retained as governed production invariant.**

**Frozen lifecycle:** reserved-identifier protection is **always** active (exact match). The persisted `tenants` row may be **absent** until an approved Platform audit adapter upserts it lazily. Absence is **not** a startup fault and does **not** block ordinary tenant licensing. Exact reserved-id licensing requests always fail closed before cache/tenant lookup. Once present, the row is immutable through ordinary tenant workflows and must not be provisioned, imported, restored, licensed, archived, repurposed, or deleted via those paths.

| Topic | Contract |
|-------|----------|
| Owner / creation | Platform Tenants Directory audit FK host; lazy upsert by Platform audit-trail adapters under `withPlatformBypass`. Ops role: Platform Ops / Security. |
| Authoritative identifier | Single source: `platform-tenants.tokens.ts` (`PLATFORM_AUDIT_SENTINEL_TENANT_ID`, `isPlatformAuditSentinelTenantId`, `assertNotPlatformAuditSentinelTenantId`). Production source scan proves no duplicated magic UUID literal. |
| Tenant write paths | Production: `PlatformTenant.provision`, `ProvisionPlatformTenantHandler`, `PrismaPlatformTenantRepository.save`, `PrismaTenantRepository.save` (clinic tenant upsert). All use the shared assert helper. Test-only harness `prisma.tenant.create` paths are not production write surfaces. |
| Import / restore | **Not Applicable — no production tenant import/restore write path exists** in the application (backup-restore module has no Platform sentinel/tenant identity write endpoint). Infrastructure DB restore relies on PK uniqueness + post-restore application guards. |
| Collision prevention | Shared assert rejects reserved id; emits `platform_audit_sentinel_tenant_collision_rejected` (bounded: action/result/sourcePath/errorCategory only). |
| Exact / arbitrary / similar | Only exact reserved-id equality; arbitrary and similar UUIDs follow normal paths. |
| Missing row | Exact id still fail-closed; ordinary LITE/PRO/ENTERPRISE resolve unchanged; audit may recreate lazily. |
| Present row | Directory/list/find exclude; licensing fail-closed; no license cache entry; ordinary cache unchanged. |
| Duplicate / corrupt | `tenants.id` PK and `platform_tenants.tenantId` UNIQUE make duplicate sentinel identity impossible; second insert fails at DB. |
| Backup / restore | Platform DB backup includes the row when present. Application has no restore endpoint that inserts caller-provided tenant IDs. Restore into existing sentinel: PK conflict prevents overwrite. Absent after restore: lazy audit upsert recreates; reserved-id protection remains active. |
| Monitoring | `platform_audit_sentinel_license_rejected`; `platform_audit_sentinel_tenant_collision_rejected`. No PHI/tokens/sessions/bodies/reserved-id in labels. |
| Repository-exclusion rationale | List SQL `<>` is insufficient for `resolveLicense(id)` because the FK host row would otherwise resolve as lite via `loadTenantContext`. Fail closed **before** cache and license computation. |
| Rollback | Remove licensing branch only after an equivalent lower-boundary guarantee; keep write-boundary assert, Directory exclusion, and collision monitoring. Re-verify LITE/PRO/ENTERPRISE + Clinic. |

### Final concurrent idempotency and durable state model (closure)

**Selected model: Option A — completed-only atomic.**

Persisted state: only `status=completed` rows. No durable PENDING/FAILED Source of Record.
Mutation and completed-row insert commit in the same transaction.
Crash before commit leaves no idempotency row. Crash after commit leaves a completed replayable row.
Equivalent concurrent same-key/same-fingerprint callers: exactly one mutation commits; losers reload the winner (`IdempotencyEquivalentRaceLostError` / OCC stale → bounded poll); they do **not** receive 409.
Different fingerprint on the same key returns 409.
Orphan non-completed rows (if present) are purged on `beginOrReplay` and never replay as success.
Retention: 7 days via `purgeExpired`.

### Transaction timeout

- **Production** `PrismaService.withPlatformBypass`: Prisma default interactive timeout (**5s**). No global 60s production override.
- **Step 14 PG harness** `createPlansPrismaWrapper`: `maxWait=15s`, `timeout=60s` (test-only).

### Login completion session class

`LoginCompletionService` is Clinic staff/patient only. `sessionClass=platform` is **rejected**.
Platform MFA/session issuance uses `PlatformSessionCompletionService` exclusively.

### Final closure gate result

Step 14 final closure gate: service-recreation replay for all six idempotent operations, frozen sentinel lifecycle with executable write-boundary collision prevention and monitoring, exact Catalog inventory 68/136/68/13, and Steps 08–14 regressions. Step 15 Add-ons/Overrides commercial-definition SoR is documented in `docs/SUPER_ADMIN_ADD_ONS_AND_COMMERCIAL_OVERRIDES.md` and `docs/SUPER_ADMIN_ADD_ONS_OVERRIDES_LEGACY_MAPPING.md`. Plan readiness reports `addonReadiness` / `overrideReadiness` as `{ status: 'available', reason: 'step_15_commercial_definition' }` — commercial SoR exists; it does **not** alter Step 14 Published Plan Version snapshots or runtime licensing.

## Readiness matrix

| Dimension | Status |
|-----------|--------|
| metadata / translations | Step 13 checks |
| entitlement / dependency / compatibility / Limit / Catalog lifecycle | Step 14 |
| Add-on / Override | available (`step_15_commercial_definition`) — commercial definition SoR; not tenant-effective |
| subscription eligibility | false |
| runtime effectiveness | false |

Publication requires: permissions → fresh step-up → expected row version → `publicationReady` → fingerprint **schema v2** → atomic publish.

Existing Step 13 fingerprints (v1 shape without `schemaVersion`) are never recalculated.

## Clone / compare

Clone copies entitlements + Limits + Unlimited markers; resets publication fields.

Compare returns entitlement add/remove/unchanged and Limit add/remove/changed — commercial definition only.

## Permissions (role seed intent)

| Role | Intent |
|------|--------|
| Platform Owner | Explicit catalog grants (includes new keys via ALL_KEYS filter) |
| Platform Administrator | view + manage entitlements/Limits |
| Plans & Subscription Manager | view + manage + publish |
| Auditor | view only |
| Security / Ops / Sales | no commercial-definition mutation |

Enforcement is by permission key, never role name. `super_admin` grants nothing. Step-up grants no missing permission.

## Idempotency operations

- `plan.replaceEntitlements`
- `plan.replaceLimits`
- `plan.applyRequiredDeps`
- existing `plan.cloneVersion` / `plan.publishVersion` extended

## Audit

Bounded metadata only (keys counts, version numbers, fingerprint schema version). No translations, release notes, raw Limit payloads, tokens, tenant/subscription data, PHI.

## Runtime non-regression

`LicensingEngineService` retains the governed audit-sentinel fail-closed path (see Sentinel decision above) and otherwise preserves legacy Plan / overlay / Limit semantics. No request-time Plan Version entitlement lookup. Draft edit / publish / retire do not alter tenant runtime access.

## Rollback

Disable mutation routes / hide UI tabs; retain additive tables until safe DB rollback; restore Step 13 readiness messaging if needed. Never restore mutable Published snapshots or missing=Unlimited.

## Explicitly deferred

Step 15 Add-ons/Overrides, Step 16 Subscriptions, Step 17 Provisioning, Step 18 Effective Entitlement Runtime.

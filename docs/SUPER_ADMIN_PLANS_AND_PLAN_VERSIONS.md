# Super Admin — Plans and Plan Versions (Release 47 Step 13)

## Bounded context

Platform-managed commercial **Plan** and **Plan Version** Source of Record for Super Admin.

Owns: stable Plan keys, localized metadata, Plan/Version lifecycles, legacy aliases, Draft editing, publication, published immutability, cloning, comparison, readiness metadata, references.

Does **not** own: entitlements, Limit values, Add-ons, Overrides, subscriptions, runtime licensing, billing execution, Feature Flags.

## Final `business` decision — Option B

| Identifier | Decision |
|------------|----------|
| `business` | **Unresolved non-Plan UI tier** — not a `PlatformPlanAlias`, never `plan.business` |

Evidence: Clinic UI prices/limits/features for `business` differ from `professional` while sharing Prisma `PRO`. Mapping as Plan alias would falsely merge distinct commercial SKUs. Seed retires any prior `clinic_ui_plan:business` ACTIVE alias. `getLegacyMappings().unresolved` lists it with `classification: non_plan_ui_tier`.

## No fourth vocabulary

Canonical Plans only: `plan.lite`, `plan.pro`, `plan.enterprise`.

| Canonical | Proven aliases (high confidence) |
|-----------|----------------------------------|
| plan.lite | LITE, starter, lite, basic |
| plan.pro | PRO, growth, professional, pro, standard |
| plan.enterprise | ENTERPRISE, enterprise, premium |

## Canonical key rules

Regex: `^plan\.[a-z][a-z0-9_]{0,62}$`  
Forbidden: `plan.business` and unresolved commercial identifiers.

## Lifecycles

**Plan:** `DRAFT` → `ACTIVE` ↔ `ARCHIVED` (no hard-delete).  
**Plan Version:** `DRAFT` → `PUBLISHED` → `RETIRED`. One open Draft per Plan. Server-assigned monotonic version numbers.

## Publication readiness

| Check | Step 13 / 14 |
|-------|---------|
| Metadata readiness | enforced |
| Entitlement readiness | **Step 14** — see `SUPER_ADMIN_PLAN_ENTITLEMENTS_AND_LIMITS.md` |
| Limit readiness | **Step 14** |
| Subscription eligibility | **false** |
| Runtime effectiveness | **false** |

## Super Admin routes

| Route | Permission | Notes |
|-------|------------|-------|
| `/plans` | plan.view | list |
| `/plans/new` | plan.create | create |
| `/plans/legacy-mappings` | plan.view | resolved + unresolved |
| `/plans/:planId` | plan.view | detail, lifecycle, references |
| `/plans/:planId/edit` | plan.edit | metadata |
| `/plans/:planId/versions/new` | plan-version.create | Draft |
| `/plans/:planId/versions/:versionId` | plan-version.view | immutable Published/Retired |
| `/plans/:planId/versions/:versionId/edit` | plan-version.create | Draft only |
| `/plans/:planId/versions/:versionId/compare` | plan-version.view | Step 13 fields |

## Permissions

`plan.view|create|edit|lifecycle|alias.manage`, `plan-version.view|create|review|publish|retire`

Step-up: Plan activate/archive/reactivate, Version publish/retire, active-use alias retirement.

## Idempotency

Table `platform_plan_idempotency`. Ops: create Plan, Draft, clone, publish, alias. Retention 7 days. `purgeExpired()` operational cleanup (no dedicated scheduler required for MVP).

## Rate limits

| Bucket | Env | Default |
|--------|-----|---------|
| mutation | PLATFORM_PLANS_MUTATION_RATE_LIMIT | 60/min |
| highImpact | PLATFORM_PLANS_HIGH_IMPACT_RATE_LIMIT | 30/min |
| readHeavy | PLATFORM_PLANS_READ_HEAVY_RATE_LIMIT | 120/min |

## Migrations

Additive `20260724180000_phase47_platform_plans`.

Validation:

```bash
npm run test:platform-plans-migration   # clean + upgrade isolated DBs
npm run test:platform-plans-db          # smoke + final-gate + evidence
```

## Upgrade-path evidence

`scripts/validate-platform-plans-upgrade.mjs` parks `20260724180000_phase47_platform_plans`, deploys prior migrations, seeds representative Steps 06–12 state, applies Plans, and prints a **full JSON report** (`beforeCounts` / `afterCounts`).

Pre-Plans fixture includes:

| Domain | Fixture |
|--------|---------|
| Platform users | MFA-complete active + suspended |
| Sessions | Fresh step-up, stale step-up, revoked (same user) |
| Tenants | ACTIVE LITE, trialing PRO (`trialEndsAt`), SUSPENDED ENTERPRISE |
| Subscriptions | Matching `EntitlementPlan` rows per tenant |
| Audit | Sentinel tenant + 2 `auditEntry` rows |
| Catalog | Healthcare catalog seed (68 / 136 / 68 / 13) + optional idempotency row |

Post-upgrade assertions:

- Legacy table counts unchanged (users, sessions, tenants, subscriptions, audit, catalog)
- Catalog inventory unchanged after Plans seed
- Plans seed twice preserves administrator translation edits (`updatedAt > createdAt`)
- No `planVersionId` FK on `platform_subscriptions`
- No active `business` Plan alias (Option B)

## Audit matrix evidence

`platform-plans-evidence.postgres.integration.spec.ts` walks one Plan through create → update → activate → archive → reactivate → addAlias → retireAlias → createDraft → updateDraft → publish → clone → retire and asserts **exactly one** durable `auditEntry` per action/resource in `AuditTrailPlatformPlansAuditLog`:

| Action key |
|------------|
| `platform_plan.created` / `.updated` / `.activated` / `.archived` / `.reactivated` |
| `platform_plan.alias.added` / `.alias.retired` |
| `platform_plan_version.created` / `.updated` / `.published` / `.cloned` / `.retired` |

Serialized rows must not contain translation bodies, tokens, SQL, stack traces, or PHI markers (`Gate desc`, `مسودة`, `releaseNotes`, `Bearer`, `sessionId`, `password`, `SELECT`, `stack`, `PHI`).

## Per-operation idempotency evidence

Separate integration cases cover:

| Operation | Cases |
|-----------|-------|
| Plan create | replay, conflict (different payload), service recreation, actor isolation, failed duplicate (no completed row), malformed/oversized key → `BadRequest` |
| Draft create | replay, conflict, recreation, concurrent `Promise.all` → one draft |
| Clone | replay, conflict, recreation |
| Publish | replay, conflict, recreation; no completed row when step-up missing or version stale |

Retention: expire completed row → `purgeExpired()` ≥ 1; unexpired row remains.

## Rate-limit evidence

Harness injects raw `PlatformPlansConfig` (bypasses env `boundedInt` minimum of 5). Controllers are thin delegates to `PlatformPlansService`, where buckets are enforced (`HttpStatus.TOO_MANY_REQUESTS`):

| Bucket | Limit | Assertion |
|--------|-------|-----------|
| mutation | 2 | third `createPlan` → HTTP 429; plan count unchanged; no extra success audit |
| highImpact | 1 | first `publishVersion` ok; second publish on another draft → 429 before mutation; Draft lifecycle unchanged |
| readHeavy | 1 | first `compareVersions` ok; immediate replay → 429 |

Handler → bucket matrix is asserted in `platform-plans.auth.boundary.spec.ts` (every `/platform/plans/*` handler classified).

## Step-up isolation evidence

| Scenario | Setup | Expected |
|----------|-------|----------|
| Cross-session | `stepUpBySessionId`: session A fresh, session B stale (same user) | Activate with A ok; archive with B → `Forbidden`; plan stays ACTIVE; no archive audit |
| Cross-user | User A fresh session; user B session stale | Publish as B → `Forbidden`; version stays DRAFT |

Harness: `createPlansService({ stepUpBySessionId, config })` passes config as the service's 8th constructor argument (after `PlanEntitlementsService`).

## Runtime non-regression

Creating/publishing/retiring Plan Versions does not alter `LicensingEngineService`. No subscription Plan Version FK. Step 14 adds commercial entitlement/Limit tables only — see `SUPER_ADMIN_PLAN_ENTITLEMENTS_AND_LIMITS.md`.

## Rollback

Disable mutation/publish routes; keep read-only APIs; retain additive tables; restore list-only UI if needed. Preserve Steps 06–12 and licensing.

## Explicitly deferred

Step 15 add-ons/overrides commercial-definition SoR (`docs/SUPER_ADMIN_ADD_ONS_AND_COMMERCIAL_OVERRIDES.md`) · Step 16 subscriptions · Steps 17–18 runtime.

## Seed

`npm run seed:platform-plans` — three ACTIVE Plans + proven aliases; with `includeCommercialDefinitions` seeds Draft entitlement/Limit sets when empty. Administrator translation and commercial-definition edits are preserved.

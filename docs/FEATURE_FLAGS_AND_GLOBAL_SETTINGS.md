# Flexible Step 20 — Feature Flags and Global Settings

**Canonical roadmap:** Super Admin Flexible Plans & Entitlements Implementation Playbook v4  
**Release:** 47 — Flexible Super Admin MVP  
**Status:** **Accepted / Complete** — Model B test-hook containment + P01–P12; Case B one-pass 2026-08-04 green; prohibited evidence = 0  
**Authority order:** Playbook v4 → `SUPER_ADMIN_ARCHITECTURE.md` → `PHASE_47_EXECUTION_PLAN.md` → this freeze → Steps 16–19 / U01 / EER docs → repository evidence  

**Flexible Steps 21–29 remain unauthorized.** Step 21 Audit Center is out of scope.

### Permissions (repository-aligned)

Reuse hyphenated Platform RBAC keys:

- `feature-flag.view` / `feature-flag.manage` / `feature-flag.kill-switch` (new)
- `settings.view` / `settings.manage` / `settings.reference.manage` (new)

Kill-switch permission is distinct from ordinary manage. Plans & Subscription Manager has no flag mutation grants.

---

## 1. Discovery Summary (repository evidence)

| Concern | Evidence | Decision |
|---------|----------|----------|
| DB-backed Platform feature flags | **Absent** — no `PlatformFeatureFlag*` Prisma models | **New** additive SoR tables |
| Env operational containment | `TENANT_LIFECYCLE_ENABLED`, `TENANT_PROVISIONING_ENABLED`, `USAGE_METERING_*`, `*_CENTER_ENABLED` | **Preserve** as env SoR; Step 20 does not migrate/replace them |
| Per-center env flags | Observability, backup-restore, integrations, import-export, patient-portal catalogs | Remain env-backed; optional **read-only mirror/status** in Global Settings references |
| Frontend flag clients | Clinic/Super Admin: no shared Platform flag admin | **New** Super Admin Feature Flags & Settings surfaces |
| Global settings / secret store | Secrets via process env / `.env`; no Platform GlobalSetting table | Settings SoR = new DB for **safe** values + **references**; secrets stay env |
| Clinic “feature flags” wording | Clinic settings permission description | Clinic tenant settings ≠ Platform Step 20 |
| EER | `EffectiveEntitlementRuntimeService` is entitlement SoR | Step 20 adds **operational decision layer** around EER; does not duplicate resolver |
| Pattern to mirror | Step 19 `tenant-lifecycle` (preview, OCC, idempotency, audit, step-up, Passport matrix) | Reuse conventions |

---

## 2. Sources of Record (frozen)

| Domain | SoR | Notes |
|--------|-----|-------|
| Feature Flag definition + targeting + kill-switch state | `PlatformFeatureFlag` (+ targets/history/idempotency) | Platform ops only |
| Global Setting safe values / references | `PlatformGlobalSetting` (+ history/idempotency) | No credentials |
| Secrets / provider credentials | Process environment / accepted secret store | **Never** Step 20 tables or API bodies |
| Commercial entitlements | Steps 13–16 snapshots + Flexible Step 18 EER | Flags cannot grant |
| Tenant lifecycle denial | Step 19 / PlatformTenant status + login | Flags cannot reactivate |
| Provisioning readiness | Step 17 | Flags cannot provision absent modules |
| U01 meters | U01 tables + U01 env flags | Not merged into general flags |
| Env containment (`*_ENABLED`) | Process env | Immutable via Step 20 mutations; may appear as read-only references |

---

## 3. Secret-reference boundary

API/UI may expose only:

- `configured: boolean`
- `providerType` (bounded enum/string)
- `referenceId` (non-secret key name / alias)
- `lastVerifiedAt` (nullable)
- `healthCategory` (`unknown` \| `ok` \| `degraded` \| `missing`)
- `rotationRequired` (boolean when known)

**Never** return or persist: API keys, passwords, client secrets, private keys, connection strings, SMTP passwords, SMS tokens, storage credentials, signed URLs, raw env values.

Mutations that claim to write secret material → `400` `secret_write_forbidden`.

---

## 4. Naming

### Flag keys

- Namespace prefix: `ops.` (operational) — immutable after create  
- Canonical, lower-snake or dotted, max 128 chars  
- Unique case-insensitively after normalization  
- Must not collide with Catalog `module.*` / `feature.*` / `limit.*` / `specialty.*` without `ops.` prefix  
- Non-secret; safe for logs  

### Setting keys

- Namespace prefix: `setting.`  
- Same immutability / uniqueness / non-secret rules  

---

## 5. Flag effect types (frozen)

| Effect | May | Must not |
|--------|-----|----------|
| `KILL_SWITCH_DENY` | Deny already-entitled capability | Grant access |
| `ROLLOUT_ALLOW_FOR_ENTITLED` | Expose entitled capability to subset | Grant unpurchased access |
| `INTERNAL_IMPLEMENTATION_SELECTION` | Choose implementation path | Change commercial authority |
| `OPERATIONAL_ENABLEMENT` | Enable/disable entitled subsystem | Bypass lifecycle / pending |

---

## 6. Targeting (supported)

- `GLOBAL` — all tenants (still subject to entitlement + lifecycle)  
- `TENANT_ALLOWLIST` — explicit tenant UUIDs  
- `TENANT_DENYLIST` — explicit tenant UUIDs (deny wins)  
- `PERCENTAGE` — deterministic stable bucket `hash(flagKey + ':' + tenantId) % 100 < percentage`  

**Unsupported:** user-level experiments, fuzzy name matching, frontend-trusted membership, unstable random per request.

Deny precedence: denylist > kill switch > allowlist/percentage exclusion > entitlement/lifecycle.

---

## 7. Resolver precedence (frozen)

Effective operational access for capability `C`:

1. **Lifecycle / security deny** (SUSPENDED, ARCHIVED, PROVISIONING inaccessible, auth failures) → **DENY**  
2. **Authoritative entitlement deny** (EER / Step 16 snapshot) → **DENY**  
3. **Applicable kill-switch deny** → **DENY**  
4. **Rollout targeting exclusion** → **DENY operational exposure** (entitlement unchanged)  
5. **Allow** only when entitlement allows **and** operational controls permit  

A flag **allow** never converts entitlement deny → allow.  
Managed pending never falls back to Legacy.  
PROVISIONING tenants remain inaccessible regardless of flags.

Explanation codes (bounded): `lifecycle_denied`, `entitlement_denied`, `kill_switch_denied`, `rollout_excluded`, `operational_allow`, `flag_not_applicable`.

---

## 8. Kill switch

Requires: `feature_flag.kill_switch` permission, fresh step-up, impact preview + fingerprint, reason, expected `rowVersion`, idempotency key, confirmation, durable audit, cache invalidation of operational evaluations. Fail-safe deny. Never grants.

---

## 9. Cache

- Cache is **not** authority.  
- Kill-switch / targeting mutations bump flag `rowVersion` and invalidate process-local operational cache for that flag key.  
- Stale allow must not survive when authoritative version mismatches (fail closed to re-evaluate).  

---

## 10. Idempotency & OCC

- Completed-only durable PostgreSQL idempotency (mirror Step 19).  
- Every mutation requires `expectedRowVersion`.  
- Exact replay: same result, no extra audit/history/`rowVersion` bump.  

Operations (implemented set):

- `FEATURE_FLAG_CREATE`  
- `FEATURE_FLAG_UPDATE`  
- `FEATURE_FLAG_TARGET_UPDATE`  
- `FEATURE_FLAG_KILL_SWITCH_ACTIVATE`  
- `FEATURE_FLAG_KILL_SWITCH_DEACTIVATE`  
- `FEATURE_FLAG_DEPRECATE`  
- `GLOBAL_SETTING_UPDATE`  
- `GLOBAL_SETTING_REFERENCE_UPDATE`  

---

## 11. Permissions (narrow additions)

| Permission | Purpose |
|------------|---------|
| `feature_flag.view` | List/detail/history/preview read |
| `feature_flag.manage` | Create/update/target/deprecate |
| `feature_flag.kill_switch` | Activate/deactivate kill switches |
| `global_setting.view` | List/detail/history read |
| `global_setting.manage` | Safe value updates |
| `global_setting.reference.manage` | Safe reference metadata updates |

Clinic principals denied. Role-name / wildcard bypass denied. UI visibility ≠ authorization.

---

## 12. Containment

`FEATURE_FLAGS_SETTINGS_ENABLED` env flag, default **false**.  
When off: mutations → `503` `feature_flags_settings_disabled`; reads with view permission may return empty/safe status.  
Does not override commercial/lifecycle/EER authority.

---

## 13. Non-goals / Step 21 boundary

Step 20 does **not** implement: Audit Center search/export, Operations Console, notification template admin, raw secret management, experimentation platform, billing, sales, commercial SoR writes, physical tenant deletion, Steps 21–29.

Object-specific history views use Step 20 history tables + Platform audit linkage only.

---

## 14. Catalog / commercial invariants

Catalog remains **68 / 136 / 68 / 13**.  
No automatic Plan/Subscription/Add-on/Override/lifecycle/provisioning/U01/secret changes from Step 20 migrations.

---

## 15. Acceptance pointer

Step 20 is **Accepted / Complete** after test-hook production containment closure (Model B).

Hooks activate **only** when `NODE_ENV === 'test'` **and** `FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION` matches an inventory point. Production / development / missing `NODE_ENV` cannot activate hooks even when the selector is set.

**Containment suite:** P01–P12 in `feature-flags-settings-hook-containment.postgres.integration.spec.ts` (see §18).

**Case B one-pass** (production guard change):  
`2026-08-04T21:14:30.623Z` → `2026-08-04T22:16:14.233Z` — `durationMs: 3703610`, `exitCode: 0`, `failures: 0`, `retries: 0`, `dbRestarts: 0`, `productEditsDuringSequence: 0`.  
Step 20 DB runner (#30): suites=6, tests=62, failures=0, skips=0; F15–F20 and P01–P12 all **PASSED**.

Local one-pass JSONL/console evidence deleted after verification (prohibited artifact count **0**).

**Flexible Step 21 remains unauthorized.**

---

## 16. F15–F20 failure-injection inventory (closure gate)

Suite: `apps/api/src/modules/feature-flags-settings/tests/feature-flags-settings-failure-injection.postgres.integration.spec.ts`  
Hooks: test-only via Model B — `NODE_ENV === 'test'` **and** `FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION` exact match (never production-activatable).

| ID | Exact test name | Hook | Semantic stage | Prior state | Final |
|----|-----------------|------|----------------|-------------|-------|
| F15 | `F15 EER adapter failure — fail-closed; entitlement/lifecycle/kill-switch denials preserved` | `eer_adapter_failure` | OperationalDecisionService after entitlement allow, before flag load | Stub / registration-only | **PASSED** (executed) |
| F16 | `F16 service recreation before replay — exact replay, conflict 409, no duplicate side effects` | service recreation (scenario) | Durable idempotency replay after new stack | Partial (ID only) | **PASSED** (expanded) |
| F17 | `F17 notification/outbox (durable history event) failure after commit — retryable, no duplicate` | `notification_outbox_failure` | Post-commit durable history/event boundary (no email/SMS) | Missing | **PASSED** |
| F18 | `F18 environment compatibility adapter failure — env authority preserved; no secret copy` | `environment_compatibility_adapter_failure` | `readEnvironmentCompatibilityStatus` env↔DB bridge | Missing | **PASSED** |
| F19 | `F19 target resolution failure — no false allow; deny precedence; cross-tenant isolation` | `target_resolution_failure` | Target resolution before rollout include | Missing | **PASSED** |
| F20 | `F20 rollback/recovery failure on kill-switch — full TX rollback; retry recovers` | `rollback_recovery_failure` | Kill-switch TX after history+idempotency staging | Missing | **PASSED** |

Prior “F15–F20 remaining points are named and injectable…” stub was **removed** and does not count as proof.

Runner (`scripts/run-feature-flags-settings-db.mjs`) prints each F15–F20 and P01–P12 name/result; missing or non-PASSED fails the runner.

---

## 17. Evidence hygiene

Ignore rules (root `.gitignore`, path-scoped):

- `/apps/api/step20-final-onepass*`
- `/apps/api/br-step20-*`
- `/apps/api/step20-*.txt`
- `/apps/api/step20-hook-containment*`

Prohibited Step 20 evidence search after cleanup: **0 files**.  
Ignored residue is not accepted — artifacts were deleted.

---

## 18. Failure-Injection Production Containment (Model B)

**Selected model:** Model B — hard runtime test guard.

**Guard implementation** (`isFeatureFlagsSettingsFailureInjectionActive` in `feature-flags-settings.constants.ts`):

```ts
if (process.env.NODE_ENV !== 'test') return false;
return process.env.FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION === point;
```

| NODE_ENV | Selector set | Activates? |
|----------|--------------|------------|
| `test` | exact point match | yes (Jest / dedicated test process only) |
| `production` | any | **no** |
| `development` | any | **no** |
| missing / malformed | any | **no** |

**Rejected as insufficient:** custom-env-only gating (previous defect); Feature Flag / Global Setting toggles; request-provided activation; Model C without bundle proof.

**Activation channels proven inert (P01–P12):** HTTP body/header/query/reason/confirmation/idempotency; DB flag/setting/target/reference values; frontend forms/routes/messages; `.env.example` / compose / package scripts; Platform roles (no injection permission); logs/audit/errors.

**Suite:** `feature-flags-settings-hook-containment.postgres.integration.spec.ts`  
**Hook inventory:** all identifiers in `FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION_POINTS` (F01–F20 points including F15–F20).

**`emitDurableHistoryEvent`:** object-specific Step 20 post-commit history/outbox boundary only — not Audit Center, not export, not cross-domain search, not Step 21 schema/routes/navigation.

**Containment closure one-pass (Case B):** `2026-08-04T21:14:30.623Z` → `22:16:14.233Z` — exit 0; F15–F20 + P01–P12 PASSED inside runner; evidence artifacts deleted (count 0).

# Effective Entitlement Runtime (Flexible Step 18)

## Canonical roadmap identity

| Flexible v4 | This document |
|-------------|----------------|
| **Step 18 — Effective Entitlement Runtime and Licensing View** | **This capability (Complete)** |
| Step 17 — Tenant Creation and Provisioning | Not implemented |
| Supplemental U01 — Usage Metering | Additive; calls `getLimit`; not this step |

Historical internal prompts called this runtime “Step 17.” Prefer **Playbook v4 / PHASE_47** numbering in new writing.

## Discovery status

**Completed before production behavior change.** This document includes the **final closure gate** provenance, terminal denial, successor handoff, and Option B multi-instance cache contracts.

---

## Runtime-management provenance

Derived from Step 16 commercial history (**no new schema**).

| Classification | Meaning | Runtime |
|----------------|---------|---------|
| `NEVER_MANAGED` | No commercial configs, snapshots, fingerprints, terminal records, or chains | **LEGACY** only |
| `AUTHORITATIVE_ACTIVE` | Current `ACTIVE_COMMERCIAL` + validated snapshot | SNAPSHOT allow |
| `AUTHORITATIVE_PENDING_SUCCESSOR` | Current Draft/Scheduled with predecessor → last effective predecessor snapshot | SNAPSHOT (predecessor) |
| `AUTHORITATIVE_SUSPENDED` | Current suspended with snapshot | Deny `runtime_suspended` |
| `AUTHORITATIVE_TERMINAL` | Cancelled/Expired current, or **zero-current** after managed history | Deny `runtime_cancelled` / `runtime_expired` / `runtime_terminal` |
| `AUTHORITATIVE_PENDING_ACTIVATION` | First Draft/Scheduled before any activation | Deny `runtime_pending_activation` |
| `AUTHORITATIVE_INVALID` | Ambiguous current, orphaned authority, broken chain, malformed snapshot | Fail-closed deny |

### Legacy fallback eligibility

Legacy is allowed **only** when provenance is `NEVER_MANAGED`.

**Never** fall back when:

- any Step 16 commercial configuration history exists
- activation / snapshot / fingerprint / terminal history exists
- predecessor/successor chain exists
- zero-current after managed history
- malformed / ambiguous / unsupported authority

Never merge LEGACY and SNAPSHOT in one result.

### Cancellation / expiry (no legacy resurrection)

Step 16 clears `isCurrent` on cancel/expire. Closure gate resolves that as `AUTHORITATIVE_TERMINAL` → deny (`runtime_terminal`), **not** legacy Plan/feature JSON.

Terminal `getLimit` → `{ state: 'UNCONFIGURED', code: runtime_terminal|runtime_cancelled|runtime_expired }`.

### Successor handoff

Before successor activation, the last valid predecessor activation snapshot remains runtime-effective (`AUTHORITATIVE_PENDING_SUCCESSOR`). Draft/Scheduled successors never cause legacy fallback. Successful successor activation atomically switches to the successor snapshot. Failed activation leaves predecessor authority.

Do **not** select runtime authority by `createdAt`. Do **not** treat `isCurrent` Draft alone as “no snapshot → legacy”.

---

## Cache contract — Option B (safe process-local)

**Deployment topology:** multi-instance Nest API processes with independent process-local Maps.

**Backend:** in-process Map (not Redis). Shared cache not required.

**Safety:** every resolve **re-reads authoritative lightweight identity from PostgreSQL** (provenance, lifecycle, snapshot id, fingerprint) **before** cache lookup. Cache key:

```text
effective-entitlement-runtime/v1|tenantId|provenance|source|lifecycle|snapshotId|fingerprint
```

Old keys become unreachable when identity changes. TTL alone is **not** the authorization control; identity re-read is.

| Setting | Default |
|---------|---------|
| `EFFECTIVE_ENTITLEMENT_CACHE_ENABLED` | `true` |
| Positive TTL | 60s |
| Negative TTL | 30s |
| Maximum stale window for **authorization** | **0** (identity mismatch → miss) |
| Stampede | single-flight per key |

Disable cache: `EFFECTIVE_ENTITLEMENT_CACHE_ENABLED=false`.

Invalidation hooks on activate/suspend/resume/cancel/supersede/renew remain as optimization; multi-instance correctness does not depend on cross-instance invalidation buses.

---

## Runtime-inspection permission (Option A)

**Permission:** `subscription.view`

**Permits:** commercial configuration read; bounded runtime source/status; bounded entitlement explanation.

**Does not permit:** snapshot JSON export; cache payload; mutation; invalidation; override assignment; lifecycle transition.

Routes: `GET /platform/subscriptions/:id/runtime`, `GET .../runtime/explain?key=` — Platform auth, `Cache-Control: private, no-store`, readHeavy rate bucket.

---

## Public API

```text
canUseModule / canUseFeature / canUseSpecialty → EntitlementDecision
getLimit → EffectiveLimit (CONFIGURED | UNLIMITED | UNCONFIGURED)
explainEntitlement → bounded EntitlementExplanation
resolveEffectiveEntitlements → EffectiveEntitlementBundle (+ provenance)
```

Clinic `LicensingEngineService.resolveLicense` projects SNAPSHOT (including denies) into `TenantLicense`; LEGACY leaves legacy matrices. Flag `EFFECTIVE_ENTITLEMENT_RUNTIME_ENABLED=false` restores pure legacy for all tenants (explicit rollback).

---

## Rollback

- Disable snapshot projection: `EFFECTIVE_ENTITLEMENT_RUNTIME_ENABLED=false` (full legacy restore).
- Disable cache: `EFFECTIVE_ENTITLEMENT_CACHE_ENABLED=false`.
- Retain Step 16 snapshots/history.
- Never restore cancellation→legacy, expiry→legacy, successor-Draft→legacy, or mixed sources.

---

## Schema

**Zero** Step 17 Prisma models / migrations. Reuses Step 16 commercial tables only. Step 18 absent.

---

## Clinic frontend validation

**Selected path:** Path A — green Clinic build (Path B unavailable: no authentic pre-Step-17 Git commit, tag, worktree, or diagnostic artifact; only R42 baseline `439eebff` exists and predates the current Clinic dynamic/workflow surface).

### Toolchain (frozen)

| Item | Value |
|------|--------|
| App path | `apps/clinic-dashboard` |
| Node | v24.16.0 |
| npm | 11.13.0 |
| TypeScript | 5.9.3 |
| Bundler | Vite 5.4.x (`tsc -b && vite build`) |
| Tests | `vitest run` / focused `vitest run src/features/subscription` |
| Typecheck | `npx tsc -b --pretty false` (no dedicated `typecheck` script) |
| Build | `npm run build` |
| Lockfile | repo-root `package-lock.json` |

### Pre → post diagnostics (Path A)

| | Pre-fix (captured) | Post-fix |
|--|---------------------|-----------|
| Total `error TS` | **205** | **0** |
| Step 17-related Clinic diagnostics | **0** | **0** |
| Dominant codes | TS2345, TS2322, TS6133 | — |

Root causes corrected (type-only; no entitlement/auth semantic change):

- `readonly` catalog arrays vs mutable params across dynamic-* builders/validation
- duplicate `AnalyticsCatalogEntry` / `ReportCatalogEntry` (`string` vs `LicensedModuleId`) unified
- `schemaVersion: '1.0' as const` for `ModuleRegistryBootstrapSnapshot` fixtures
- `EffectiveExtension` payload field access (`descriptionKey` / `resourceId`)
- `LicensedModuleId` casts at registry/catalog boundaries
- unused imports in Clinic + `packages/module-registry`
- AI `AiRouteContext.path`, workflow `as const` / `MeResponse`, PDF `BlobPart`, misc one-offs
- removal of stale emitted `.js`/`.d.ts` beside sources in `module-registry` / `dashboard-export` so Vite resolves `.ts`

### Final Clinic sequence (no retry)

| Step | Result |
|------|--------|
| Focused subscription tests | 5 files / 17 tests, exit 0 |
| Module-registry tests | 2 files / 5 tests, exit 0 |
| Dynamic-navigation tests | 3 files / 10 tests, exit 0 |
| Full Clinic frontend tests | 143 files / 627 tests, exit 0 |
| Typecheck `tsc -b` | 0 errors, exit 0 |
| Build | exit 0 |
| Clinic API/guard jest boundary | 5 suites / 48 tests, exit 0 |
| Step 17 `test:effective-entitlement-runtime-db` | 6 suites / 55 tests, exit 0 |

Local `.clinic-*` diagnostic dumps used during Path A were removed after the gate and are ignored via `apps/clinic-dashboard/.gitignore` (`.clinic-*`). They are not committed.

---

## Step 15 flakiness

**Cause:** concurrent equivalent idempotency losers could observe post-commit lifecycle and throw unrecovered `BadRequestException` (`Cannot … from …`) instead of OCC conflict.

**Correction:** `recoverEquivalentReplay` in add-ons/overrides treats those BadRequests as recoverable when an idempotency claim exists.

---

## Final regression and working-tree hygiene

Executed on the final working tree after Clinic Path A (local PostgreSQL 16 / `booking-system-pg-test` / `booking_test`):

| Gate | Command | Result |
|------|---------|--------|
| Step 15 | `npm run test:platform-add-ons-overrides-db` | **5 suites / 65 tests**, ~210s, exit **0**, no retry |
| Step 16 | `npm run test:platform-subscriptions-db` | **19 suites / 444 tests**, ~490s, exit **0**, no retry |
| Clinic typecheck | `npx tsc -b --pretty false` | exit **0** |
| Clinic build | `npm run build` | exit **0** |
| Emitted cleanup | deleted stale tracked `.js`/`.d.ts`/`.js.map` under `packages/dashboard-export/src` | **not regenerated**; package exports remain `.ts` |
| Evidence hygiene | removed local `.clinic-*` + `br-43g-*.txt` evidence files | not staged; `.clinic-*` ignored |
| `git diff --check` | full working tree | exit **0** |

No Step 15/16 production defect was exposed. No schema, runtime subscription, or `PlatformTenant.plan` mutation.

---

## Supplemental Capability U01 (Usage Metering)

Additive Usage Metering calls `getLimit` and does **not** change entitlement SoR. It is **not** Flexible Step 18. See `docs/USAGE_METERING_AND_LIMIT_ENFORCEMENT.md`.

## Final decision status

**Flexible Step 18 — Effective Entitlement Runtime:** complete / accepted.  
**Supplemental U01:** additive extension (feature-flagged; defaults OFF); final validation passed.  
**Flexible Step 17 — Tenant Creation and Provisioning:** next required roadmap step.  
**Flexible Step 19 — Tenant Lifecycle Actions:** not authorized.

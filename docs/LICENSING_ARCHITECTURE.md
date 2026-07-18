# Enterprise Subscription & Licensing Architecture

This document describes the centralized licensing system for the Healthcare ERP SaaS platform. It is the **single source of truth** for what each tenant can access. Dynamic Module Management (Phase 3) will consume this engine without introducing scattered checks.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PlatformTenant                                   │
│  plan · status · trialEndsAt · contractEndDate · suspendedAt            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                    PlatformSubscription (active row)
                                │
                                ▼
              ┌─────────────────────────────────────┐
              │     LicensingEngineService          │
              │  resolveLicense() · getEntitlements()│
              │  enforce*() · previewPlanChange()   │
              └──────────────┬──────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  licensing.config    plan-limits.config   TenantSubscriptionService
  (modules, features,  (numeric limits,     (usage aggregation,
   plan tiers)          backend features)     grants, plan catalog)
         │                   │                   │
         └───────────────────┴───────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
   SubscriptionEnforcementService    GET /tenant/subscription/*
   (backward-compatible facade)      (license, entitlements, preview)
              │
              ▼
   Domain handlers (users, branches, reports, identity, …)
              │
              ▼
   clinic-dashboard: useTenantEntitlements · FeatureGate · License UI
```

### Core principles

| Principle | Implementation |
|-----------|----------------|
| Single engine | All checks flow through `LicensingEngineService` |
| Config-driven plans | `licensing.config.ts` + `plan-limits.config.ts` + `plan-name.mapper.ts` |
| Tenant isolation | Every query scoped by `tenantId`; cache keyed per tenant |
| Backend enforcement | APIs reject unauthorized access; UI gates are additive |
| No ClinicSubscription for SaaS | Patient packages (`ClinicSubscription`) are separate from platform SaaS licensing |

### Key files

| Layer | Path |
|-------|------|
| Engine | `apps/api/src/modules/subscription/application/services/licensing-engine.service.ts` |
| Lifecycle state | `apps/api/src/modules/subscription/application/services/licensing-lifecycle-state.service.ts` |
| Facade | `apps/api/src/modules/subscription/application/services/subscription-enforcement.service.ts` |
| Communication dispatch | `apps/api/src/modules/subscription/application/services/communication-dispatch.service.ts` |
| API rate limiting | `apps/api/src/modules/subscription/application/services/api-rate-limit.service.ts` |
| Worker licensing | `apps/api/src/modules/subscription/application/services/licensing-execution.guard.ts` |
| Immutable audit | `apps/api/src/modules/subscription/application/services/licensing-audit.service.ts` |
| Module/feature matrix | `apps/api/src/modules/subscription/domain/config/licensing.config.ts` |
| Plan limits | `apps/api/src/modules/subscription/domain/config/plan-limits.config.ts` |
| UI plan mapping | `apps/api/src/modules/subscription/domain/config/plan-name.mapper.ts` |
| Types | `apps/api/src/modules/subscription/domain/types/tenant-license.types.ts` |
| Frontend entitlements | `apps/clinic-dashboard/src/features/subscription/hooks/useSubscriptionEntitlements.ts` |
| Feature gate | `apps/clinic-dashboard/src/features/subscription/components/FeatureGate.tsx` |

### Supported UI plans

`starter` · `professional` · `business` · `enterprise`

Mapped to backend plans `lite` · `pro` · `enterprise` with business tier overrides (e.g. 120 users on pro backend + business UI tier).

### License lifecycle states

`active` · `trial` · `grace` · `suspended` · `cancelled` · `expired` · `provisioning`

Read-only mode applies during `grace` and `suspended`.

---

## 2. Database Changes

Licensing composes existing subscription records **plus** Phase 28 dedicated persistence:

| Model | Role |
|-------|------|
| `Tenant` | `features` JSON: `subscriptionUiPlan`, `subscriptionGrants`, grant history |
| `PlatformTenant` | Canonical SaaS plan, status, contract dates, suspension |
| `PlatformSubscription` | Active billing row, cycle, auto-renew, end date |
| **`TenantLicenseLifecycleState`** | **Durable last-known license status per tenant (replaces in-memory lifecycle cache)** |
| **`LicenseLifecycleTransition`** | **Idempotent commercial transition ledger — exactly-once audit events** |

Grant bonuses (`usersBonus`, `storageGbBonus`, `aiCreditsBonus`) live in `Tenant.features.subscriptionGrants`.
| **`LicenseAuditEvent`** | **Append-only immutable licensing audit (authoritative history)** |
| **`CommunicationDispatchLedger`** | **Idempotent per-notification dispatch metering (Email/SMS/WhatsApp/Push)** |

See [`LICENSING_LIFECYCLE_STATE.md`](./LICENSING_LIFECYCLE_STATE.md) for durable lifecycle transition design.

Migration: `20260712000000_phase28_licensing_completion` · `20260712100000_phase28_lifecycle_state`

Future schema candidates (Phase 29+):

- `UsageMeter` table for high-volume metering (AI tokens, API calls)
- `ScheduledPlanChange` for deferred downgrades

---

## 3. API Changes

New tenant-scoped endpoints under `GET/POST /tenant/subscription`:

| Method | Path | Permission | Returns |
|--------|------|------------|---------|
| `GET` | `/license` | `api.subscription:view` | Full `TenantLicense` payload |
| `GET` | `/entitlements` | `api.subscription:view` | License + usage + limits + `canWrite` / `canMutate` |
| `POST` | `/plan-change/preview` | `api.subscription:manage` | `PlanChangePreview` (lost features/modules, warnings) |

Existing endpoints unchanged but now invalidate license cache on plan/grant/trial mutations.

Handlers: `GetTenantLicenseHandler`, `GetTenantEntitlementsHandler`, `PreviewTenantPlanChangeHandler` in `tenant-subscription.handlers.ts`.

---

## 4. Licensing Flow

```
Request (any domain mutation)
    │
    ▼
SubscriptionEnforcementService.enforce*()
    │
    ▼
LicensingEngineService.enforceLicenseWritable()  ──► 403 if read-only / suspended / expired
    │
    ▼
resolveLicense(tenantId)
    │
    ├─ Cache hit (60s TTL) → return
    │
    └─ Cache miss:
         load Tenant + PlatformTenant + PlatformSubscription
         map backend plan + subscriptionUiPlan → uiPlan
         apply grant bonuses → effectiveLimits
         compute modules + features + status
         cache → TenantLicense
    │
    ▼
Check resource / feature / module against effectiveLimits + matrix
    │
    ├─ OK → proceed
    └─ Fail → PlanLimitExceededException (403, upgradeRequired: true)
```

`resolveLicense()` output includes: `licenseId`, plan tiers, billing cycle, dates, status, `modules`, `features`, `backendFeatures`, `effectiveLimits`, `grantHistory`, `readOnly`.

---

## 5. Feature Flag Flow

Feature flags are defined centrally in `LICENSED_FEATURES` (`licensing.config.ts`).

```
UiSubscriptionPlan (starter → enterprise)
    │
    ▼
featureStateForPlan(featureId, uiPlan)
    │
    ▼
FeatureAccessState: enabled | disabled | limited | upgrade
    │
    ├─ Frontend: useSubscriptionEntitlements().canAccessFeature(id)
    │             FeatureGate checks server state + canWrite
    │
    └─ Backend: enforceLicensedFeature(tenantId, featureId)
                enforceFeature(tenantId, backendFeatureKey)  // PlanFeatures
```

Frontend feature IDs align with dashboard config (`aiChat`, `workflow`, `whiteLabel`, etc.). Backend `PlanFeatures` keys (`aiModels`, `customWorkflows`, …) map via `LicensedFeatureDefinition.backendFeature`.

Identity bootstrap (`get-identity-features.handler`) reads resolved license features so login payload matches enforcement.

---

## 6. Usage Tracking Flow

```
TenantSubscriptionService.getUsage(tenantId)
    │
    ├─ users, branches, patients (DB counts)
    ├─ appointmentsThisMonth, reportsThisMonth (period counts)
    ├─ storageGb (media aggregation)
    ├─ apiCallsToday, sms/email/whatsapp (notification counters)
    └─ AI usage (aiUsageDaily aggregate)
    │
    ▼
LicensingEngineService.getEntitlements()
    │
    ▼
buildUsageSnapshots(effectiveLimits, usage)
    │
    ▼
UsageLimitSnapshot[]: current, maximum, remaining, percentUsed,
                      warning (≥80%), critical (≥95%)
```

Enforcement compares **cached usage snapshot** from `getUsage()` for most resources. Doctor limits still query role-filtered user count (skipped when unlimited).

Grant bonuses extend effective limits before comparison.

---

## 7. Upgrade Flow

```
User selects higher plan (Plans UI)
    │
    ▼
POST /tenant/subscription/plan-change/preview { plan }
    │
    ▼
previewPlanChange() → direction: upgrade, immediate: true
    │
    ▼
User confirms → PATCH plan (ChangeTenantSubscriptionPlanHandler)
    │
    ├─ Update PlatformTenant.plan + PlatformSubscription
    ├─ Append grant history / audit entry
    ├─ licensing.invalidateCache(tenantId)
    └─ Frontend refetches entitlements
```

Upgrades take effect immediately. Proration and payment collection integrate with existing billing handlers (future: Stripe webhook sync).

---

## 8. Downgrade Flow

```
User selects lower plan
    │
    ▼
POST /plan-change/preview
    │
    ▼
previewPlanChange():
    lostFeatures ← lostFeaturesOnDowngrade(current, target)
    lostModules  ← lostModulesOnDowngrade(current, target)
    limitChanges ← diff effectiveLimits
    warnings     ← usage exceeds target limits (users, branches)
    │
    ▼
DowngradeModal displays server preview (not static catalog only)
    │
    ▼
Confirm → plan change handler (same as upgrade)
```

Scheduled downgrades and proration are architecturally supported via `PlanChangePreview.effectiveDate` and `immediate` flags; payment integration is a future dependency.

---

## 9. Trial Flow

```
PlatformSubscription.status = TRIAL  OR  trialEndsAt > now
    │
    ▼
resolveLicenseStatus() → status: trial
    │
    ├─ canMutate: true (active writes allowed)
    ├─ UI: trial days remaining in License page audit section
    └─ GrantTenantTrialHandler extends trialEndsAt + audit
```

Automatic expiration: when `trialEndsAt` passes without renewal → transitions to `grace` or `expired` based on contract end + `DEFAULT_GRACE_PERIOD_DAYS` (7).

---

## 10. Grace Period Flow

```
contractEndDate / subscription.endDate < now
    AND now ≤ end + GRACE_DAYS
    │
    ▼
status: grace · readOnly: true
    │
    ├─ enforceLicenseWritable() → 403 with upgrade message
    ├─ GET entitlements → canWrite: false, canMutate: false
    └─ Frontend: read-only banner on License page
```

After grace window → `expired` → full lockout except subscription management routes.

---

## 11. Enforcement Flow

### Global guard chain (HTTP)

```
JwtAuthGuard → ApiRateLimitGuard → MaintenanceModeGuard → RolesGuard
  → PermissionGuard → LicensedModuleGuard (@RequireLicensedModule + @RequireLicensedFeature)
  → Controller handler → SubscriptionEnforcementService / LicensingEngineService
```

**30 domain controllers** use `@RequireLicensedModule`. Five system controllers are intentionally exempt: `auth`, `tenant`, `platform-admin`, `tenant-subscription`, `subscription` (patient packages).

### LicensedFeatureId backend enforcement

Full matrix: [`LICENSING_ENFORCEMENT_COMPLETION.md` § Feature Enforcement Matrix](./LICENSING_ENFORCEMENT_COMPLETION.md).

| Mechanism | Scope |
|-----------|--------|
| `@RequireLicensedModule` + `@RequireLicensedFeature` | Module + primary feature on domain controllers |
| `@RequireLicensedFeature` on routes | apiAccess, integrations, auditLogs, customRoles, AI copilots, organizationKnowledge, multiProviderAi |
| `SubscriptionEnforcementService.enforceLicensedFeature` | Settings branding (`customBranding`, `whiteLabel`) |
| `AiSubscriptionService.enforceWorkspaceAccess` | medicalCopilot, dentalCopilot, reportingAi, inventoryAi (via `resolveLicense()` only) |
| `enforceFeature` in handlers | customWorkflows, advancedAnalytics, aiModels, loyaltyProgram |
| **Client-only (documented)** | `prioritySupport` — SLA tier flag, no backend API |

### AI quota interpretation

`AiSubscriptionService` derives all plan context from `LicensingEngineService.resolveLicense()`. The `ai-plan-limits.config.ts` file is a **quota interpreter** keyed by resolved plan — not an independent licensing engine.

### Commercial audit

`LicensingCommercialAuditService` + `LicensingCommercialAuditListener` record plan changes, renewals, trials, grace transitions, suspensions, reactivations, cancellations, feature enable/disable, and denials via `LicensingAuditService.recordLicenseEvent`.

### Background + realtime

- **12/12 workers:** `LicensingExecutionGuard.allowWorkerExecution`
- **WebSockets:** `RealtimeAuthorizationService.filterAllowedChannels` → `isModuleActive`
- **Communication:** `CommunicationDispatchService` at notification dispatch

### Frontend (UX layer)

- `LicensedApplicationShell` — evaluates entitlements **before** `AppShell`; uses `useTenantEntitlements()` for fast fail-closed gate (not AI/usage hooks)
- `EnterpriseLicenseExperience` — full-page enterprise lock UI (status, plan, expiration, renewal, contact sales/admin, organization context)
- `LicenseMaintenanceLayout` — minimal shell for `/settings/subscription/*` when license blocks main app
- `license-gate.ts` — fail-closed routing rules (`expired`, `suspended`, `cancelled`, `grace`, grace-expired)
- `useSubscriptionEntitlements()` — fail-closed when entitlements unavailable (`safeMode`)
- `FeatureGate` — hides/blocks UI; backend always authoritative

### Caching

- In-memory per-tenant **license resolution cache**: **60 seconds**, invalidated on plan/grant/trial mutations
- **Commercial lifecycle transitions** use `TenantLicenseLifecycleState` + `LicenseLifecycleTransition` (database-backed, restart-safe)

---

## 12. Remaining Future Dependencies

| Area | Status | Next step |
|------|--------|-----------|
| **Phase 28 acceptance** | **PASS (100%)** | Runtime verified 2026-07-12 — see [`PHASE_28_RUNTIME_ACCEPTANCE_REPORT.md`](./PHASE_28_RUNTIME_ACCEPTANCE_REPORT.md) |
| Dynamic Module Management | **Ready** | Phase 29 implementation |
| `@RequireLicensedModule` full wiring | **Complete** | **29/35** controllers (5 exempt: auth, tenant, platform-admin, subscription APIs; 1 partial: audit feature-only) |
| `enforceLicensedFeature` wiring | **Complete** | All 21 `LicensedFeatureId` (see enforcement completion doc) |
| Full module wiring | **Complete** | 21 `LICENSED_MODULES` IDs |
| Notification events | **Complete** | Commercial audit + dispatch warnings |
| Payment provider sync | Existing UI | Webhook → invalidate cache + status update |
| Usage metering table | Not implemented | Move high-frequency counters off live aggregates |
| License audit table | **Complete** | `LicenseAuditEvent` append-only + `AuditEntry` mirror |
| API rate limiting | **Complete** | Redis edge guard + plan-derived limits |
| Communication dispatch limits | **Complete** | Email/SMS/WhatsApp/Push at dispatch |
| Background job licensing | **Complete (12/12 workers)** | `LicensingExecutionGuard.allowWorkerExecution` |
| White label / custom domains | **Complete** | `SettingsService` enforces `whiteLabel` / `customBranding` |
| Scheduled downgrades | Preview supports dates | Persist `ScheduledPlanChange` rows |
| E2E tests | **Complete** | `licensing-matrix.spec.ts` — **36/36 tests passed** (exit 0); CI: `phase28-licensing-ci.yml` |
| Licensing unit subset (Phase 28 CI) | **Complete** | Backend Jest **6/6 suites, 27/27 tests**; frontend Vitest **5/5 files, 20/20 tests** |

See also: [`LICENSING_ENFORCEMENT_COMPLETION.md`](./LICENSING_ENFORCEMENT_COMPLETION.md)

---

## Testing

| Suite | Coverage |
|-------|----------|
| `licensing-engine.service.spec.ts` | License resolution, business tier, grants, preview, enforcement |
| `subscription-enforcement.service.spec.ts` | Facade delegation, all resource limits, features |
| `licensed-feature.guard.spec.ts` | Feature metadata enforcement + audit on denial |
| `licensing-execution.guard.spec.ts` | Background/WS shared module checks + worker denial |
| `communication-dispatch.service.spec.ts` | Dispatch quotas, idempotency, grace, unlimited |
| `api-rate-limit.service.spec.ts` | Plan limits, tenant isolation, auth sliding window |
| `licensing-audit.service.spec.ts` | Append-only events, denial mirror |
| `licensing-lifecycle-state.service.spec.ts` | Durable transitions, idempotent audit, persistKnownStatus |
| `licensing-commercial-audit.service.spec.ts` | Plan upgrade, trial, suspension audit |
| `licensed-feature-enforcement.integration.spec.ts` | Feature guard denial + audit |
| `useSubscriptionEntitlements.spec.ts` | Frontend fail-closed behavior (jsdom + @testing-library/react) |
| `license-gate.spec.ts` | Unified license experience routing rules |

Run:

```bash
cd apps/api
npx jest src/modules/subscription/tests/licensing-engine.service.spec.ts \
         src/modules/subscription/tests/subscription-enforcement.service.spec.ts
```

---

## Security checklist

- [x] Tenant-scoped queries only
- [x] Permission guards on subscription APIs
- [x] Backend rejects over-limit mutations (create paths)
- [x] Read-only / suspended states block writes via `enforceLicenseWritable`
- [x] No cross-tenant cache leakage (keyed by tenantId)
- [x] **Module gate on licensed controllers** (29/35 with `@RequireLicensedModule`; 5 exempt by design; audit partial)
- [x] **All LicensedFeatureId backend-enforced or documented client-only**
- [x] Commercial audit (`LicensingCommercialAuditService` + domain event listener)
- [x] Rate limit enforcement at API edge (Redis `ApiRateLimitGuard`)
- [x] Communication dispatch limits (Email/SMS/WhatsApp/Push)
- [x] Licensing audit log (`LicenseAuditEvent` authoritative + `AuditEntry` mirror)
- [x] Background worker licensing (all BullMQ workers)
- [x] Durable commercial lifecycle transitions (no in-memory status cache)
- [x] Subscription licensing E2E (`subscription-licensing.spec.ts` + `licensing-matrix.spec.ts`)

---

*Last updated: Phase 28 runtime acceptance (2026-07-12) — **PASS**. See [`PHASE_28_RUNTIME_ACCEPTANCE_REPORT.md`](./PHASE_28_RUNTIME_ACCEPTANCE_REPORT.md).*

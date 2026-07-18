# License Lifecycle State — Durable Commercial Transitions

**Phase:** 28 (Enterprise Subscription & Licensing)  
**Status:** Production  
**Cross-references:** [`LICENSING_ARCHITECTURE.md`](./LICENSING_ARCHITECTURE.md) · [`LICENSING_ENFORCEMENT_COMPLETION.md`](./LICENSING_ENFORCEMENT_COMPLETION.md)

---

## Problem

Commercial lifecycle audit events (trial end, grace start, grace end, suspension, reactivation, cancellation) previously depended on an **in-process status cache** inside `LicensingEngineService`. After a process restart, previous status was lost, risking duplicate or missing commercial audit events.

## Solution

Durable lifecycle tracking via two PostgreSQL tables and `LicensingLifecycleStateService`:

```
resolveLicense(tenantId)
        │
        ▼
LicensingLifecycleStateService.syncFromResolvedLicense()
        │
        ├─ Read TenantLicenseLifecycleState (previous status)
        ├─ Compare to resolved license.status
        ├─ If changed: INSERT LicenseLifecycleTransition (idempotent unique)
        │              UPDATE TenantLicenseLifecycleState
        │              recordLicenseStatusTransition() exactly once
        └─ If unchanged: update uiPlan only if needed
```

Platform events that already emit commercial audit (suspend, resume, archive, trial grant) call `persistKnownStatus()` so subsequent `resolveLicense()` calls do not re-detect the same transition.

## Database models

| Model | Purpose |
|-------|---------|
| `TenantLicenseLifecycleState` | One row per tenant — last known `licenseStatus` + `uiPlan` |
| `LicenseLifecycleTransition` | Append-only ledger; `@@unique([tenantId, previousStatus, newStatus])` prevents duplicate audit |

Migration: `20260712100000_phase28_lifecycle_state`

## Idempotency guarantees

1. **Unique constraint** on `(tenantId, previousStatus, newStatus)` — concurrent workers cannot double-insert.
2. **P2002 handling** — if transition row already exists, state is still updated but commercial audit is skipped.
3. **`persistKnownStatus()`** — used after platform/commercial events already audited elsewhere.

## Events covered

| Transition | Detection | Audit source |
|------------|-----------|--------------|
| Trial start | `GrantTenantTrialHandler` → `persistKnownStatus('trial')` | `recordTrialStart` (platform) |
| Trial end | `syncFromResolvedLicense` (trial → active/expired) | `licensing.lifecycle.sync` |
| Grace start | `syncFromResolvedLicense` (active → grace) | `licensing.lifecycle.sync` |
| Grace end | `syncFromResolvedLicense` (grace → expired) | `licensing.lifecycle.sync` |
| Plan upgrade/downgrade | Commercial audit listener on plan change | `LicensingCommercialAuditListener` |
| Renewal | Commercial audit listener | `LicensingCommercialAuditListener` |
| Suspension | Listener + `persistKnownStatus('suspended')` | Platform suspend event |
| Reactivation | Listener + `persistKnownStatus('active')` | Platform resume event |
| Cancellation | `syncFromResolvedLicense` or listener | Platform archive / sub cancelled |

## Key files

| File | Role |
|------|------|
| `licensing-lifecycle-state.service.ts` | Durable sync + idempotent audit |
| `licensing-engine.service.ts` | Calls `syncFromResolvedLicense()` in `resolveLicense()` |
| `licensing-commercial-audit.listener.ts` | `persistKnownStatus()` after platform events |
| `tenant-subscription.handlers.ts` | Trial grant persists known status |

## What is NOT lifecycle state

The **60-second license resolution cache** (`licenseCache` in `LicensingEngineService`) remains for performance. It caches resolved entitlements only — commercial transition detection uses the database, not process memory.

## Tests

- `licensing-lifecycle-state.service.spec.ts` — bootstrap, grace transition, duplicate skip
- **Phase 28 licensing verification (2026-07-12):**
  - Backend Jest: **6/6 suites**, **27/27 tests** passed (exit 0)
  - Frontend Vitest: **5/5 files**, **20/20 tests** passed (exit 0)
  - Playwright `licensing-matrix.spec.ts`: **36/36 tests** passed, 0 failed, 0 skipped (exit 0)
- See [`PHASE_28_RUNTIME_ACCEPTANCE_REPORT.md`](./PHASE_28_RUNTIME_ACCEPTANCE_REPORT.md)

---

*Last updated: 2026-07-12 — Phase 28 permanently closed.*

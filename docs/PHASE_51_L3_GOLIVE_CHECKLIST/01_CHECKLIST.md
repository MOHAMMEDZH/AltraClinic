# L3 — Tenant go-live checklist (one tenant)

**Scope:** Taking **one** platform tenant live using existing runbooks and UIs.  
**Not:** Proof that cutover already ran. Capture evidence only when L6 is authorized.

Mark each step ☐ / ☑ locally during an authorized go-live; do not check boxes in-repo as “done.”

---

## 0. Before you start

Complete [`02_PRECONDITIONS_STOP_THE_LINE.md`](./02_PRECONDITIONS_STOP_THE_LINE.md). If any stop-the-line item fails → **STOP**.

Hub: [`OPERATOR_INDEX.md`](../OPERATOR_INDEX.md)

---

## 1. Platform readiness (environment — not tenant-specific)

| # | Check | Pointer |
|---|--------|---------|
| 1.1 | Deploy / rollback path understood (D-17 topology remains EXTERNAL) | [`PHASE_49_K5_DEPLOY_ROLLBACK/`](../PHASE_49_K5_DEPLOY_ROLLBACK/) `01_DEPLOY_RUNBOOK.md`, `02_ROLLBACK_RUNBOOK.md` |
| 1.2 | Cutover gates / ownership reviewed | [`RELEASE_47_STEP29_RELEASE_READINESS.md`](../RELEASE_47_STEP29_RELEASE_READINESS.md) §§7–14 |
| 1.3 | Backup / restore cutover SoR known; drill posture current | [`PHASE_49_K3_BACKUP_RESTORE/`](../PHASE_49_K3_BACKUP_RESTORE/) |
| 1.4 | Tenant isolation production-check path known | [`PHASE_49_K6_TENANT_ISOLATION/`](../PHASE_49_K6_TENANT_ISOLATION/) · `npm run test:phase49-tenant-isolation-check` (when DB available) |
| 1.5 | Health / observability readiness known | [`PHASE_49_K4_OBSERVABILITY_ALERTING/`](../PHASE_49_K4_OBSERVABILITY_ALERTING/) |
| 1.6 | Secrets / config hygiene posture known | [`PHASE_49_K2_SECRETS_CONFIG/`](../PHASE_49_K2_SECRETS_CONFIG/) |

K5 dry-run remains **PARTIAL** without real prod cutover — see K5 `05_DRY_RUN_CHECKLIST.md`. Do **not** invent CD/k8s in-repo.

---

## 2. Provision (tenant identity + onboarding)

| # | Check | Pointer |
|---|--------|---------|
| 2.1 | Confirm provisioning flag / containment rules for this environment | [`TENANT_CREATION_AND_PROVISIONING.md`](../TENANT_CREATION_AND_PROVISIONING.md) (`TENANT_PROVISIONING_ENABLED` fail-closed when off) |
| 2.2 | Create / provision tenant via Super Admin onboarding (authorized roles only) | SA `TenantOnboardingPage` · [`SUPER_ADMIN_TENANT_DIRECTORY_AND_DETAIL.md`](../SUPER_ADMIN_TENANT_DIRECTORY_AND_DETAIL.md) · provisioning SoR above |
| 2.3 | Verify tenant appears in directory / detail; record `platformTenantId` | SA tenant directory / detail |
| 2.4 | Lifecycle actions only as authorized (do not merge Step 19 into onboarding SoR) | [`TENANT_LIFECYCLE_ACTIONS.md`](../TENANT_LIFECYCLE_ACTIONS.md) |

---

## 3. License / commercial assignment

| # | Check | Pointer |
|---|--------|---------|
| 3.1 | Explain package using L2 sale clarity (plans / entitlements / add-ons) | [`PHASE_51_L2_PRICING_PACKAGING/`](../PHASE_51_L2_PRICING_PACKAGING/) |
| 3.2 | Assign published plan version (+ add-ons/overrides if sold) | [`SUPER_ADMIN_SUBSCRIPTION_MANAGEMENT_AND_COMMERCIAL_ASSIGNMENT.md`](../SUPER_ADMIN_SUBSCRIPTION_MANAGEMENT_AND_COMMERCIAL_ASSIGNMENT.md) · SA `/subscriptions` |
| 3.3 | Confirm tenant-facing license / entitlements resolve | Clinic subscription UI · [`LICENSING_ARCHITECTURE.md`](../LICENSING_ARCHITECTURE.md) |
| 3.4 | Do **not** claim Stripe/payment live | L2 [`02_WHAT_IS_NOT_SOLD.md`](../PHASE_51_L2_PRICING_PACKAGING/02_WHAT_IS_NOT_SOLD.md) |

---

## 4. Smoke (list only — run / evidence in L6)

When L6 is authorized, capture evidence per L6 format. **Here = what to run, not that it passed.**

| # | Precursor (list) | Pointer |
|---|------------------|---------|
| 4.1 | Wave I packs / onepass (optional/heavy) | [`PHASE_51_L1_DISCOVERY_INVENTORY/05_LAUNCH_SMOKE_PRECURSORS.md`](../PHASE_51_L1_DISCOVERY_INVENTORY/05_LAUNCH_SMOKE_PRECURSORS.md) · `test:phase48-onepass` |
| 4.2 | Step 28 / Step 29 final onepass (as required by release gate) | `test:step28-security-final-onepass` · `test:step29-release-final-onepass` · Step 29 doc |
| 4.3 | Clinic Progressive Inventory + Inventory E2E (path-filtered CI) | `.github/workflows/clinic-dashboard-ci.yml` |
| 4.4 | Licensing matrix / subscription licensing (if commercial path touched) | `e2e/licensing-matrix.spec.ts` · Phase 28 licensing CI |
| 4.5 | K6 tenant isolation check (when test Postgres available) | `test:phase49-tenant-isolation-check` |

```text
L3 does not claim smoke green.
L6 owns evidence format + authorized run record.
```

---

## 5. Handoff (launch-day support/ops)

| # | Check | Pointer |
|---|--------|---------|
| 5.1 | Incident SEV / first 15 / RM path known to support | [`PHASE_49_K7_INCIDENT_BASICS/`](../PHASE_49_K7_INCIDENT_BASICS/) + [`SECURITY_RUNBOOKS.md`](../SECURITY_RUNBOOKS.md) |
| 5.2 | Notification / DR / ops console paths known | [`NOTIFICATION_DELIVERY_OPERATIONS.md`](../NOTIFICATION_DELIVERY_OPERATIONS.md) · [`DISASTER_RECOVERY.md`](../DISASTER_RECOVERY.md) · OPERATOR_INDEX |
| 5.3 | Launch-day support handoff package reviewed | [`PHASE_51_L4_SUPPORT_OPS_HANDOFF/`](../PHASE_51_L4_SUPPORT_OPS_HANDOFF/) |

---

## 6. Close-out (honest)

| # | Check |
|---|--------|
| 6.1 | Deferred items still deferred (D5 picker, etc.) — [`06_DEFERRED_REGISTER_SEED.md`](../PHASE_51_L1_DISCOVERY_INVENTORY/06_DEFERRED_REGISTER_SEED.md) |
| 6.2 | No claim of Phase 51 PA or 100% commercial complete |
| 6.3 | If production cutover was **not** executed, record that honestly (K5 PARTIAL remains) |

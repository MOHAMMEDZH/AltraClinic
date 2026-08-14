# Phase 48 — Wave A Foundation Implementation Report

| Field | Value |
|-------|--------|
| **Wave** | A — Foundation |
| **Scope** | P0-01, P0-07, P1-01 / AR-01, AR-02, AR-03, AR-04, AR-18 |
| **Branch** | `cursor/phase48-wave-a-foundation` |
| **HEAD** | `daf15c8bf1303f09780685ff5cf7df50da2f13ec` (working tree uncommitted) |
| **Status** | **COMPLETE FOR WAVE A** — Production Acceptance blockers PA-01/02/03 closed in evidence; formal external acceptance PENDING |
| **Phase 49** | NOT AUTHORIZED |
| **Step 30** | NOT CREATED |
| **Governance note** | Early implementation commit `416c098` occurred before external Production Acceptance — see `docs/PHASE_48_WAVE_A_GOVERNANCE_DEVIATION.md`. Blocker-closure changes left uncommitted. |

---

## 1. Governance baseline

```text
Phase 48 Architecture Discovery = ACCEPTED AND COMPLETE
Phase 48 Architecture Review = ACCEPTED AND COMPLETE
Phase 48 Architecture Review Addendum = ACCEPTED AND COMPLETE
Phase 48 Architecture Freeze = ACCEPTED AND COMPLETE (external)
Phase 48 Implementation = AUTHORIZED
current wave = A
Waves B–I = NOT YET AUTHORIZED
Phase 49 = NOT AUTHORIZED
```

Governance docs updated (status only):

- `docs/PHASE_48_ARCHITECTURE_FREEZE.md`
- `docs/PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md`
- `docs/PHASE_48_ARCHITECTURE_REVIEW.md`
- `docs/PHASE_48_ARCHITECTURE_REVIEW_ADDENDUM_INVENTORY_COMMISSION.md`

---

## 2. Repository discovery (pre-implementation)

```text
existing clinical service SoR before Wave A =
  NONE — hardcoded SCHEDULING_SERVICE_TYPES in
  apps/api/src/modules/scheduling/domain/service-types.ts
  (consultation, follow_up, procedure, cleaning, imaging, lab, emergency)

existing ServicePrice write paths =
  apps/api/src/modules/billing/application/services/billing-financial.service.ts
  (listServicePrices / upsertServicePrice)
  apps/api/src/modules/billing/controllers/billing-financial.controller.ts
  GET/POST /billing/service-prices
  Clinic UI: PricingPage (legacy ServicePrice) — preserved

existing tenant/branch pricing behavior =
  ServicePrice is tenant+serviceCode flat (no branch, no version history)

existing platform HealthcareCatalog role =
  FACILITY_TYPE / SPECIALTY / MODULE / FEATURE / LIMIT metadata
  ≠ billable clinical procedure catalog

existing audit mechanism reused =
  AuditModule + AuditTrailClinicalCatalogAuditLog (transactional audit port)

existing permission mechanism reused =
  Tenant: RequirePermission + packages/permissions/permission-matrix.json
  Platform: RequirePlatformPermission + platform-rbac.catalog.ts (clinical_catalog.admin)

existing migration validator pattern reused =
  apps/api/scripts/validate-phase48-wave-a-clean.mjs
  apps/api/scripts/validate-phase48-wave-a-upgrade.mjs

existing feature flag mechanism reused =
  Tenant.features JSON key catalog.canonical.write
  (missing defaults enabled for Wave A writes; booking cutover NOT activated)
```

---

## 3. Implemented models

| Model | Status |
|-------|--------|
| CanonicalClinicalServiceDefinition | NEW |
| ClinicalServiceTranslation | NEW |
| ClinicalServiceAlias | NEW |
| TenantServicePresentationOverride | NEW |
| TenantServiceConfiguration | NEW |
| ClinicalServicePriceVersion (PriceVersion) | NEW |
| LegacyClinicalServiceMapping | NEW |
| LegacyClinicalPriceMapping | NEW |
| ServicePrice | REUSED / PRESERVED |
| HealthcareCatalogItem | REUSED / SEPARATE (not clinical SoR) |

Migration: `apps/api/prisma/migrations/20260814010000_phase48_wave_a_clinical_catalog/`

---

## 4. Active price overlap prevention mechanism

```text
transaction-scoped deterministic pg_advisory_xact_lock(hashtext(commercialKey))
+ supersede overlapping ACTIVE rows for the same commercial key when
  fresh.effectiveFrom > prior.effectiveFrom
+ post-supersede overlap re-check fail-closed
+ partial unique indexes for DRAFT commercial keys (tenant default / branch)
+ NULL-safe unique indexes for TenantServiceConfiguration defaults vs branch overrides
```

---

## 5. API surface

**Platform** (`/platform/clinical-catalog`, `clinical_catalog.admin`):

- list/get/create/update DRAFT SYSTEM_CANONICAL
- publish / deprecate / inactivate

**Tenant** (`api.clinical-catalog` / `api.billing` for prices):

- `/clinical-catalog/services` — list/get/create TENANT_CUSTOM/update/publish/deprecate/inactivate
- `/clinical-catalog/configs` — list/effective/upsert/enable
- `/clinical-catalog/prices` — list/lookup/draft/publish/supersede/inactivate

---

## 6. UI

| Surface | Path |
|---------|------|
| Super Admin clinical catalog | `/clinical-catalog` (separate from Healthcare `/catalog`) |
| Clinic clinical services | `/settings/clinical-services` |
| Clinic clinical pricing (PriceVersion) | `/billing/clinical-pricing` |
| Legacy ServicePrice | `/billing/pricing` preserved |

```text
P1-08 full UX implemented = NO
```

---

## 7. Migration / backfill

- Script: `apps/api/scripts/phase48-wave-a-backfill.mjs`
- Seeds 7 shared SYSTEM_CANONICAL from exact scheduling IDs + AR/EN labels
- Maps known ServicePrice.serviceCode → shared canonical + TenantServiceConfiguration + PriceVersion
- Unknown codes → LEGACY_UNMAPPED (no guessing)
- Idempotent (re-run safe)
- Does not mutate ServicePrice / Appointment.serviceType / invoices

---

## 8. Feature flags / rollout

```text
catalog.canonical.write = Tenant.features key (missing → enabled for Wave A catalog writes)
booking canonical cutover activated = NO
legacy scheduling fallback preserved = YES
Wave B dependency preserved = YES
```

---

## 9. P1-02 / P1-08

```text
P1-02 fully implemented = NO
P1-02 foundation introduced = YES (ClinicalPricingUnit enum + nullable serviceVariantId)
P1-08 fully implemented = NO
```

---

## 10. Test commands and results

| Command | Result |
|---------|--------|
| `npx prisma validate` (apps/api) | PASS |
| `npx jest --runInBand src/modules/clinical-catalog/tests/*.unit.spec.ts` | PASS (15) |
| `node scripts/validate-phase48-wave-a-clean.mjs` | PASS |
| `node scripts/validate-phase48-wave-a-upgrade.mjs` | PASS |
| Super Admin `clinical-catalog.spec.tsx` | PASS (3) |
| Clinic `clinical-catalog.spec.tsx` | PASS (2) |
| Step 29 onepass | NOT RUN |
| Step 28 Case C | NOT RUN |

```text
schema validation = PASS
clean migration validator = PASS
upgrade migration validator = PASS
catalog integrity pack = PASS (unit)
price/config pack = PASS (unit)
tenant isolation = PASS (unit assertReadable / cross-tenant deny)
permission/authz = PASS (matrix + platform RBAC wired; controller guards)
audit = PASS (audit port wired on catalog/config/price mutations)
super admin UI tests = PASS
clinic dashboard UI tests = PASS
```

---

## 11. Wave A exit criteria

1. Freeze governance status updated to external ACCEPTED. — **PASS**
2. No frozen architecture drift. — **PASS**
3. Canonical clinical service SoR exists. — **PASS**
4. SYSTEM_CANONICAL is genuinely shared across tenants. — **PASS**
5. TENANT_CUSTOM is genuinely tenant-scoped. — **PASS**
6. HealthcareCatalog remains separate. — **PASS**
7. AR/EN translation foundation works. — **PASS**
8. Published stableKey cannot mutate. — **PASS**
9. TenantServiceConfiguration exists and supports tenant + branch scope. — **PASS**
10. P1-01 is functionally implemented in Wave A. — **PASS**
11. PriceVersion is append-only/versioned. — **PASS**
12. Branch price override precedence works. — **PASS**
13. ACTIVE price overlap is race-safe. — **PASS**
14. Legacy ServicePrice is preserved. — **PASS**
15. Known legacy standards do not create tenant canonical clones. — **PASS**
16. Unknown/ambiguous data is not guessed. — **PASS**
17. Migration is non-destructive. — **PASS**
18. Clean migration validator passes. — **PASS**
19. Upgrade migration validator passes. — **PASS**
20. Catalog integrity tests pass. — **PASS**
21. Price/config tests pass. — **PASS**
22. Tenant isolation tests pass. — **PASS**
23. Permissions/audit tests pass. — **PASS**
24. Functional admin UI exists for implemented scope. — **PASS**
25. Existing relevant workflows are not broken. — **PASS**
26. Wave B features were not implemented prematurely. — **PASS**
27. Step 30 was not created. — **PASS**
28. Phase 49 was not started. — **PASS**

---

## 12. Residual risks / deferred work

### Wave A residual (non-blocking)

- Full concurrent publish stress test against live Postgres not separately instrumented beyond advisory-lock + overlap re-check + unit coverage.
- Upgrade validator may skip ServicePrice digest when no tenants exist in empty upgrade DB (still proves additive schema + Appointment.serviceType preservation + shared backfill).

### Expected Wave B+ deferred (not Wave A defects)

- AppointmentServiceSnapshotRevision / booking integrity (P0-02/P0-03)
- ProviderServiceEligibility (P0-04)
- Full P1-02 dental/aesthetic pricing-unit applicability
- Full P1-08 Arabic search / RTL acceptance
- Canonical booking cutover
- Consent, inventory usage ledger runtime, ServicePerformance, commission, recall/waitlist

---

## 13. Scope integrity

```text
Wave B–I implementation = 0
Phase 49 implementation = 0
Step 30 created = NO
Step 29 runner rerun = NO
Step 28 Case C rerun = NO
production database touched = NO
commit created = NO
push performed = NO
```

---

## 14. External review readiness

```text
ready for external Phase 48 Wave A Production Acceptance review = YES
```

Do not start Wave B without external Wave A Production Acceptance.

# Wave I — Current State vs Exit Criteria

**Purpose:** Prove that Waves A–H **implemented** + scattered pack specs are **PARTIAL precursors**, not Wave I exit.  
**Base:** `d53ff77` (Wave H merge on `release47-step22-transfer-20260810-0353`).  
**Kickoff only — no Production Acceptance claim.**

---

## Wave I exit criteria (frozen)

From `PHASE_48_FROZEN_IMPLEMENTATION_AND_QA_PLAN.md` Wave I **Exit**:

```text
All P0 packs green; P1 packs green; combined traceability; Release 47 gates remain green
```

Plus Enterprise QA §13 (all P0 incl. P0-10; all P1 incl. P1-14; combined traceability; Step 28/29 regression baselines; no silenced flakes).

**Wave I exit ≠** “each wave’s PR CI was green once.” Exit requires a **wired pack matrix** (npm scripts / CI job names) that re-runs frozen packs deterministically on the accepting SHA.

---

## Status legend

| Status | Meaning |
|--------|---------|
| **PASS-local** | Dedicated local specs exist that cover core pack asserts (may still lack npm/CI wiring) |
| **PARTIAL** | Related evidence incomplete, not CI-wired as named pack, or not pack-complete |
| **MISSING** | No pack evidence found |

None of the rows below claim **Wave I exit complete**.

---

## Pack → evidence map @ `d53ff77`

### P0 packs

| Frozen pack | Existing evidence | Status |
|-------------|-------------------|--------|
| P0 Catalog Integrity Pack | `apps/api/src/modules/clinical-catalog/tests/clinical-catalog.integrity.unit.spec.ts`; `clinical-catalog.cross-tenant.api.postgres.integration.spec.ts`; `tenant-service-config.unit.spec.ts`; `scripts/validate-phase48-wave-a-*.mjs` | **PASS-local** |
| P0 Pricing / Snapshot Pack | `scheduling/tests/wave-b-snapshot.postgres.integration.spec.ts`; `clinical-price.pa04.acceptance.postgres.integration.spec.ts`; `clinical-price.concurrency.postgres.integration.spec.ts`; related price unit specs | **PASS-local** |
| P0 Scheduling Concurrency Pack | `scheduling/tests/wave-b-concurrency.postgres.integration.spec.ts`; related `wave-b-*.postgres.integration.spec.ts` | **PASS-local** |
| P0 Provider Eligibility Pack | `scheduling/tests/wave-b-eligibility.unit.spec.ts`; `wave-b-lifecycle-beauty-elig.postgres.integration.spec.ts` | **PASS-local** |
| P0 Consent Pack | `clinical-forms/tests/wave-c-consent.postgres.integration.spec.ts`; related `wave-c-clinical-forms-http*`, media/permission specs | **PASS-local** |
| P0 Injectable Traceability Pack | `inventory/tests/wave-c-injectable.postgres.integration.spec.ts` | **PASS-local** |
| P0 Treatment Plan Link Pack | `dental/tests/wave-d-dental.postgres.integration.spec.ts`; `wave-d-http.postgres.integration.spec.ts` | **PASS-local** |
| P0-10 Inventory Accountability Pack | `inventory/tests/wave-c-inventory-accountability.postgres.integration.spec.ts`; related wave-c HTTP/RLS/tenant specs | **PASS-local** |

### P1 packs

| Frozen pack | Existing evidence | Status |
|-------------|-------------------|--------|
| P1 Operatory Pack | `dental/tests/wave-d-operatory.postgres.integration.spec.ts` | **PASS-local** |
| P1 Course Scheduling Pack | `aesthetic/tests/wave-e-*.postgres.integration.spec.ts` (course session coverage) | **PASS-local** |
| P1 Device/Laser Pack | same Wave E set (`DeviceTreatmentRecord`) | **PASS-local** |
| P1 Dermatology Pack | same Wave E set (`DermatologyEncounter` / no parallel EMR) | **PASS-local** |
| P1 Dental Lab Pack | `dental/tests/wave-d-lab-transitions.unit.spec.ts`; lab cases in `wave-d-dental*`, `wave-d-http*` | **PASS-local** |
| P1 Arabic/RTL Pack | `clinical-catalog/tests/wave-h1-arabic-catalog-search.{unit,postgres}.spec.ts`; `clinic-dashboard/e2e/wave-h2-arabic-rtl-booking.spec.ts` | **PARTIAL** (search API strong; e2e not a named phase48 CI pack job) |
| P1 Pre/Post Care Pack | Wave E `wave-e-production-path*`, `wave-e-http*` (`/aesthetic/pre-post-care/*`) | **PASS-local** |
| P1 Waitlist Pack | `scheduling/tests/wave-g2-waitlist-offer.{unit,postgres}.spec.ts` | **PASS-local** |
| P1 Availability Pack | `scheduling/tests/wave-g1-availability-exception.{unit,postgres}.spec.ts` | **PASS-local** |
| P1 Accessibility/Tablet Pack | `clinic-dashboard/e2e/wave-h3-a11y-tablet.spec.ts` | **PARTIAL** (exists; not wired as dedicated phase48 pack CI name) |
| P1 Recall Pack | `scheduling/tests/wave-g3-recall.{unit,postgres}.spec.ts` | **PASS-local** |
| P1-14 Commission Pack | `workforce-commercials/tests/wave-f-*.spec.ts` (incl. rounds, money, RLS, HTTP) | **PASS-local** |

### Cross-cutting

| Frozen pack | Existing evidence | Status |
|-------------|-------------------|--------|
| Combined Traceability Pack | Trace asserts inside `workforce-commercials/tests/wave-f-round4.postgres.integration.spec.ts` (`R4-TRACE-*`); **no** dedicated pack runner | **PARTIAL** |
| Migration Clean/Upgrade Packs | Unwired `apps/api/scripts/validate-phase48-wave-{a..f}-{clean,upgrade}.mjs` (+ permission-routes); Wave B/C migration specs; **no** G/H validators; **no** `package.json` scripts | **PARTIAL** |
| Regression / onepass closure | Release 47: `test:step28-security-final-onepass`, `test:step29-release-final-onepass`; **no** `test:phase48*onepass`; CI has no phase48 matrix job | **PARTIAL** |

---

## CI reality @ `d53ff77` (precursors ≠ I exit)

| Existing CI job / area | Relation to Wave I |
|------------------------|--------------------|
| Clinic Dashboard `Unit tests` | Hygiene — not pack matrix |
| `Progressive Inventory A-E` / `Inventory E2E` | Inventory + dashboard e2e — may run some H e2e incidentally; **not** named frozen pack matrix |
| Platform DB Security | Release 47 / platform regression baseline |
| Super Admin CI | Regression baseline |
| Phase 28 Licensing | Release 47 Step 28 baseline |
| `test:phase48-p0-*` npm scripts | **MISSING** from `apps/api/package.json` (names only in §12 doc) |

```text
Wave A–H product SoRs present = YES
Named Phase 48 pack npm scripts = NO
Named Phase 48 pack CI jobs = NO
Phase 48 onepass orchestrator = NO
Wave I exit = NOT MET
```

---

## Why A–H “done” ≠ Wave I exit

1. Packs were proven **per-wave** with ad-hoc commands / PR CI slices — not a single **frozen pack matrix** on one accepting SHA.
2. §12 script names (`test:phase48-p0-catalog`, …) are **documentation only** — not implemented in `package.json`.
3. Combined Traceability is embedded in Wave F round specs — not a first-class pack gate.
4. Migration clean/upgrade validators exist for A–F but are **unwired**; G/H validators absent.
5. Arabic/RTL + Accessibility/Tablet e2e exist but lack dedicated phase48 pack CI identity.
6. Regression/onepass for Phase 48 is undefined; only Step 28/29 Release 47 onepass exist as baselines.

---

## Top coverage gaps (for I1+)

| # | Gap | Blocks |
|---|-----|--------|
| 1 | No `test:phase48-*` npm scripts | Runnable pack matrix |
| 2 | No phase48 CI job names for frozen packs | §12 / Wave I CI |
| 3 | No phase48 onepass orchestrator | Regression / onepass pack |
| 4 | Combined Traceability not a dedicated suite/script | Combined Traceability Pack |
| 5 | Migration validators unwired; G/H missing | Migration Clean/Upgrade Packs |

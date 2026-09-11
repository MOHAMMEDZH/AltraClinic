# Wave I — Pack Matrix (I1)

**Purpose:** Authoritative frozen-pack → runnable command inventory.  
**Evidence base:** I0 `2f06970` / Wave H merge `d53ff77`.  
**Machine SSOT:** `apps/api/scripts/phase48-pack-matrix.json`  
**Runner:** `node apps/api/scripts/run-phase48-pack.mjs <pack-id>` (also via npm scripts below).

I1 wires **existing** tests only. Full matrix green = I2/I3. Do **not** treat script presence as Wave I PA.

---

## How to run

```bash
cd apps/api
npm run test:phase48-pack-list
npm run test:phase48-p0-catalog          # unit + pg (pg needs test DB)
npm run test:phase48-p1-waitlist         # unit + pg
npm run test:phase48-p1-arabic-rtl       # H1 API half

cd ../clinic-dashboard
npm run test:phase48-p1-arabic-rtl-e2e   # requires API/webServer; may skip if API down
npm run test:phase48-p1-accessibility-tablet
npm run test:phase48-owner-ux
```

Jest always uses `--runInBand`. Failures exit non-zero (runner does not swallow).

---

## Optional CI (workflow_dispatch only)

| Workflow | File | Trigger | Job name |
|----------|------|---------|----------|
| Phase 48 Pack Matrix (manual) | `.github/workflows/phase48-pack-matrix.yml` | **`workflow_dispatch` only** | `phase48-pack-smoke` |

**Not** added as a required PR check / branch-protection gate. Manual pack selection via input `pack_id` (default: `p1-waitlist` unit-friendly smoke when DB available, or list).

---

## API packs (`apps/api`)

| Frozen pack | npm script | Layers | Primary patterns / scripts | Notes |
|-------------|------------|--------|----------------------------|-------|
| P0 Catalog Integrity Pack | `test:phase48-p0-catalog` | unit + pg | `clinical-catalog.integrity.unit`, `tenant-service-config.unit`, `clinical-catalog.cross-tenant.api.postgres` | |
| P0 Pricing / Snapshot Pack | `test:phase48-p0-snapshot-pricing` | unit + pg | `clinical-price.unit`, `pricing-unit-applicability.unit`, `wave-b-snapshot.postgres`, `clinical-price.(pa04\|concurrency).postgres` | §12 name |
| P0 Scheduling Concurrency Pack | `test:phase48-p0-concurrency` | pg | `wave-b-concurrency.postgres` | §12 name |
| P0 Provider Eligibility Pack | `test:phase48-p0-eligibility` | unit + pg | `wave-b-eligibility.unit`, `wave-b-lifecycle-beauty-elig.postgres` | §12 name |
| P0 Consent Pack | `test:phase48-p0-consent` | pg | `wave-c-consent.postgres` | |
| P0 Injectable Traceability Pack | `test:phase48-p0-injectable` | pg | `wave-c-injectable.postgres` | |
| P0 Treatment Plan Link Pack | `test:phase48-p0-plan-link` | pg | `wave-d-dental.postgres`, `wave-d-http.postgres` | |
| P0-10 Inventory Accountability Pack | `test:phase48-p0-inventory-accountability` | pg | `wave-c-inventory-accountability.postgres` | |
| P1 Operatory Pack | `test:phase48-p1-operatory` | pg | `wave-d-operatory.postgres` | |
| P1 Course Scheduling Pack | `test:phase48-p1-course` | pg | `wave-e-aesthetic`, `wave-e-production-path` | Shared Wave E suite |
| P1 Device/Laser Pack | `test:phase48-p1-device` | pg | `wave-e-aesthetic`, `wave-e-http` | Shared Wave E suite |
| P1 Dermatology Pack | `test:phase48-p1-derm` | pg | `wave-e-aesthetic`, `wave-e-round1` | Shared Wave E suite |
| P1 Dental Lab Pack | `test:phase48-p1-lab` | unit + pg | `wave-d-lab-transitions.unit`, `wave-d-dental`, `wave-d-http` | |
| P1 Pre/Post Care Pack | `test:phase48-p1-pre-post-care` | pg | `wave-e-production-path`, `wave-e-http` | |
| P1 Waitlist Pack | `test:phase48-p1-waitlist` | unit + pg | `wave-g2-waitlist-offer.{unit,postgres}` | |
| P1 Availability Pack | `test:phase48-p1-availability` | unit + pg | `wave-g1-availability-exception.{unit,postgres}` | |
| P1 Recall Pack | `test:phase48-p1-recall` | unit + pg | `wave-g3-recall.{unit,postgres}` | |
| P1-14 Commission Pack | `test:phase48-p1-commission` | unit + pg | `wave-f-money.unit`, `wave-f-workforce\|http\|rls.postgres` | Narrow subset of full F rounds |
| P1 Arabic/RTL Pack (API) | `test:phase48-p1-arabic-rtl` | unit + pg | `wave-h1-arabic-catalog-search.{unit,postgres}` | Booking e2e on dashboard |
| Combined Traceability Pack | `test:phase48-combined-traceability` | pg | `wave-f-round4.postgres` + `--testNamePattern=R4-TRACE` | First-class runner; suite still embedded |
| Migration Clean/Upgrade (clean) | `test:phase48-migration-clean` | validator | `validate-phase48-wave-{a..f}-clean.mjs` | G/H validators absent |
| Migration Clean/Upgrade (upgrade) | `test:phase48-migration-upgrade` | validator | `validate-phase48-wave-{a..f}-upgrade.mjs` | G/H validators absent |
| Regression / onepass closure | `test:phase48-regression-baselines` | onepass | `test:step28-security-final-onepass`, `test:step29-release-final-onepass` | HEAVY; Phase 48 onepass = I5 |

**API pack scripts wired:** 23 (`test:phase48-pack-list` + 22 runnable packs).

---

## Clinic-dashboard packs

| Surface | npm script | Layer | Spec | Notes |
|---------|------------|-------|------|-------|
| P1 Arabic/RTL (booking e2e) | `test:phase48-p1-arabic-rtl-e2e` | e2e | `e2e/wave-h2-arabic-rtl-booking.spec.ts` | Requires API/webServer |
| P1 Accessibility/Tablet | `test:phase48-p1-accessibility-tablet` | e2e | `e2e/wave-h3-a11y-tablet.spec.ts` | Requires API/webServer |
| Owner UX (H4 bounded) | `test:phase48-owner-ux` | e2e | `e2e/wave-h4-owner-ux.spec.ts` | Requires API/webServer |

Skip-if-API-down is honest skip — **not** a fake PASS.

---

## Explicit I1 non-goals

- Making all packs green (I2/I3)
- Required GitHub Checks / branch protection
- Phase 48 onepass orchestrator (I5)
- Product/SoR changes
- Wave I Production Acceptance

# Wave E Test Plan

Evidence plan for Aesthetic / Dermatology. Commands run from `apps/api` unless noted.

## A. Unit

| Pack | Pattern / command | Covers |
|------|-------------------|--------|
| Course/session transitions + device schema keys | `npm test -- --testPathPattern=wave-e-transitions` | DRAFT/ACTIVE/COMPLETED/CANCELLED; session PLANNED→BOOKED; plannedSessions/interval bounds; registered `parameterSchemaKey` |
| Pricing-unit applicability | `npm test -- --testPathPattern=pricing-unit-applicability` | PER_COURSE/PER_PACKAGE allowed; dental/aesthetic rejects retained |

## B. PostgreSQL integration

Env (as used for Wave E postgres suites): platform DB security / test reset flags per repo convention (`RUN_PLATFORM_DB_SECURITY`, `ALLOW_TEST_DATABASE_RESET` as required by harness).

| Pack | Pattern | Covers |
|------|---------|--------|
| Domain / audit / refs | `--testPathPattern=wave-e-aesthetic` | Course+sessions create; transitions; explicit appointment link; cross-tenant reject; audit rollback; provider≠recorder; schema key reject; device correct+audit; Encounter derm; no DermatologyRecord; PRE/POST kinds; mixed-tenant session trigger; InventoryUsageLedger reuse |
| HTTP / RBAC | `--testPathPattern=wave-e-http` | 400 malformed bodies; doctor allow / receptionist deny on courses; device create allow; nurse deny corrections; PRE/POST kinds; no-derm-record endpoint |
| RLS / NOBYPASSRLS | `--testPathPattern=wave-e-rls` | booking_app, rolbypassrls=false; same/cross-tenant SELECT/INSERT/UPDATE/DELETE; dangerous child shapes; no `dermatology_records` table |

Combined: `npm run test:integration -- --testPathPattern=wave-e-`

## C. Migration validators

| Gate | Command |
|------|---------|
| Clean apply | `node scripts/validate-phase48-wave-e-clean.mjs` |
| Upgrade from Wave D | `node scripts/validate-phase48-wave-e-upgrade.mjs` |

Expect tables + RLS OK markers and `PHASE48_WAVE_E_*_VALIDATOR_PASSED`.

## D. Permission route validator

| Gate | Command |
|------|---------|
| 3-matrix + controller markers | `node scripts/validate-phase48-wave-e-permission-routes.mjs` |

Resources: `api.treatment-course`, `api.device-treatment`, `api.dermatology-encounter`, `api.pre-post-care`.

## E. Regression (prior waves)

| Pack | Intent |
|------|--------|
| Wave B postgres | Confirm booking integrity unchanged |
| Wave C postgres | Confirm clinical safety / usage ledger unchanged |
| Wave D postgres / unit | Confirm dental + ServicePerformance + pricing path unchanged |

Record results in `REGRESSION_RESULTS.md` when run.

## F. Build

| Gate | Command |
|------|---------|
| API compile | `cd apps/api && npm run build` |

Record in `BUILD_RESULTS.md` (baseline TS6059 on `permission-seeds.ts` may apply — note only if observed).

## G. QA pack mapping (frozen)

| Frozen pack | Primary evidence |
|-------------|------------------|
| Course scheduling | aesthetic + transitions + http course routes |
| Device/laser | aesthetic device + schema key unit + http |
| Derm workflows | Encounter open + no DermatologyRecord asserts |
| Pre/Post Care | kinds + assert instance kind |

# Wave C Round 10 — Test Results

**Date:** 2026-08-18
**Branch:** `cursor/phase48-wave-c-clinical-safety`
**Env:** `INTEGRATION_DATABASE_URL=postgresql://booking:booking_test@localhost:5433/booking_test`, `ALLOW_TEST_DATABASE_RESET=true`, `RUN_PLATFORM_DB_SECURITY=true`

## Full Wave C

```
npx jest --config jest.integration.config.cjs --runInBand --testPathPattern="wave-c-"
```

| Suites | Tests | Exit |
|--------|-------|------|
| 13 | 206 | 0 |

Includes stock-request accountability (including V2 warehouse rollback), malformed lineId HTTP, dashboard-contract HTTP body, atomic rollback, retry, and concurrent fulfillment tests.

Round 9 baseline was 203 tests; Round 10 added 3 (2 warehouse rollback + 1 dashboard HTTP contract).

## Inventory / Clinical Forms / permissions / media / billing / RLS

Covered by the same `wave-c-` run: accountability, injectable, tenant-references, HTTP permission, billing production path, RLS, migration, clinical-forms HTTP, consent, permission-contract, media-patient, media-owner, ClinicalFormVersion concurrency. All PASS.

## Wave B postgres

```
npx jest --config jest.integration.config.cjs --runInBand --testPathPattern="wave-b-"
```

| Suites | Tests | Exit |
|--------|-------|------|
| 12 | 268 | 0 |

## Affected units

```
npx jest --config jest.config.cjs --runInBand cancel-invoice.handler.spec.ts consume-inventory.handler.spec.ts
```

| Suites | Tests | Exit |
|--------|-------|------|
| 2 | 3 | 0 |

## Permission / clean / upgrade

| Command | Exit |
|---------|------|
| `node scripts/validate-phase48-wave-c-permission-routes.mjs` | 0 |
| `node scripts/validate-phase48-wave-c-clean.mjs` | 0 |
| `node scripts/validate-phase48-wave-c-upgrade.mjs` | 0 |
| `npm test` in `packages/permissions` | 0 (6 tests) |

## Dashboard

| Command | Result |
|---------|--------|
| `npm test` (`vitest run`) | **151 files / 669 passed**, exit 0 |
| Targeted fulfill tests | 26 passed |
| `npx tsc -b` | exit 0 (no new type errors) |
| `npm run build` (`tsc -b && vite build`) | `tsc -b` OK; **vite** fails in pre-existing `packages/module-registry` Rollup export (`CANONICAL_BRANCH_SURFACES`). Not a Round 10 file. See KNOWN_LIMITATIONS. |

## Build (API)

```
cd apps/api && npm run build
```

Exit **2** — only `TS6059` on `prisma/seeds/permission-seeds.ts`. No new Wave C diagnostics. Matches Wave B accepted baseline.

## Failures / skips

None in executed Wave C / Wave B / dashboard vitest / unit suites.

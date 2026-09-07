# Wave D Regression Results (Round 3)

Date: 2026-08-20 (local)

## Wave D

| Scope | Command | Result |
|-------|---------|--------|
| Unit | `npm test -- --testPathPattern=pricing-unit-applicability\|wave-d-lab-transitions` | PASS (2 suites / 9 tests) |
| Postgres | `npm run test:integration -- --testPathPattern=wave-d` | PASS (6 suites / 53 tests) |
| RLS subset | `npm run test:integration -- --testPathPattern=wave-d-rls` | PASS (1 suite / 16 tests) |
| Clean migration | `node scripts/validate-phase48-wave-d-clean.mjs` | PASS |
| Upgrade migration | `node scripts/validate-phase48-wave-d-upgrade.mjs` | PASS |
| Permission routes | `node scripts/validate-phase48-wave-d-permission-routes.mjs` | PASS |

Env for postgres: `RUN_PLATFORM_DB_SECURITY=true`, `ALLOW_TEST_DATABASE_RESET=true`

## Prior-wave

| Scope | Command | Baseline | Actual | Result |
|-------|---------|----------|--------|--------|
| Wave A pricing unit | `clinical-price.unit.spec.ts` | 11 tests | 11 tests | PASS |
| Wave B full postgres | `--testPathPattern=wave-b-` | 12 suites / 268 | 12 suites / 268 | PASS |
| Wave C full postgres | `--testPathPattern=wave-c-` | 13 suites / 206 | 13 suites / 206 | PASS |
| packages/permissions | `npm test --workspace=packages/permissions` | 6 tests | 6 tests | PASS |

No prior-wave regression failure observed.

## API build

| Command | Exit | Notes |
|---------|------|-------|
| `cd apps/api && npm run build` | 2 | TS6059 `permission-seeds.ts` only (allowed baseline); no new diagnostics |

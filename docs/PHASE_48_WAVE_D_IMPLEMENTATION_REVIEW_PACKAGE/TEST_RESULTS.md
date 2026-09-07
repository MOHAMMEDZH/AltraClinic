# Wave D Test Results (Round 3)

Date: 2026-08-20 (local)

## Round 3 targeted (B4 QA closure)

| Area | Command | cwd | Suites | Tests | Exit |
|------|---------|-----|--------|-------|------|
| B4 RLS + child-parent tenant isolation | `npm run test:integration -- --testPathPattern=wave-d-rls` | `apps/api` | 1 | 16 | 0 |

Env: `RUN_PLATFORM_DB_SECURITY=true`, `ALLOW_TEST_DATABASE_RESET=true`

Round 3 additions in `wave-d-rls.postgres.integration.spec.ts`:

- R3-T1 through R3-T5 (explicit mixed-tenant FK + wrong-child-tenant INSERT)
- Parent-switch UPDATE cases (where schema permits UPDATE)
- Append-only correction immutability documentation
- Six-table per-operation lifecycle matrix

## Full Wave D (Round 3 rerun)

| Suite | Command | Tests | Exit |
|-------|---------|-------|------|
| Unit | `npm test -- --testPathPattern=pricing-unit-applicability\|wave-d-lab-transitions` | 9 | 0 |
| PostgreSQL integration | `npm run test:integration -- --testPathPattern=wave-d` | 53 | 0 |
| Migration clean validator | `node scripts/validate-phase48-wave-d-clean.mjs` | — | 0 |
| Migration upgrade validator | `node scripts/validate-phase48-wave-d-upgrade.mjs` | — | 0 |
| Permission route validator | `node scripts/validate-phase48-wave-d-permission-routes.mjs` | — | 0 |

Wave D postgres suites (6): rls, dental-consume, dental, http, pricing-production-path, operatory.

## Prior-wave regression (Round 3 rerun)

| Suite | Command | Tests | Exit |
|-------|---------|-------|------|
| Wave A `clinical-price.unit` | `npm test -- --testPathPattern=clinical-price.unit` | 11 | 0 |
| Wave B full postgres | `npm run test:integration -- --testPathPattern=wave-b-` | 268 (12 suites) | 0 |
| Wave C full postgres | `npm run test:integration -- --testPathPattern=wave-c-` | 206 (13 suites) | 0 |
| `packages/permissions` | `npm test --workspace=packages/permissions` | 6 | 0 |

## API build

```
cd apps/api && npm run build
exit 2 — TS6059 permission-seeds.ts only (allowed baseline)
new diagnostics: none
```

## Round 3 production code change

**None.** QA-only test + evidence updates.

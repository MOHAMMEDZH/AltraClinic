# Wave D Checkpoint Final Gates

Date: 2026-08-20
cwd base: `apps/api` unless noted
Env for postgres: `RUN_PLATFORM_DB_SECURITY=true`, `ALLOW_TEST_DATABASE_RESET=true`

| Gate | Command | Suites | Tests | Exit | Result |
|------|---------|--------|-------|------|--------|
| Wave D unit | `npm test -- --testPathPattern=pricing-unit-applicability\|wave-d-lab-transitions` | 2 | 9 | 0 | PASS |
| Wave D postgres | `npm run test:integration -- --testPathPattern=wave-d` | 6 | 53 | 0 | PASS |
| Wave D RLS | `npm run test:integration -- --testPathPattern=wave-d-rls` | 1 | 16 | 0 | PASS |
| Wave A clinical-price.unit | `npm test -- --testPathPattern=clinical-price.unit` | 1 | 11 | 0 | PASS |
| Full Wave B | `npm run test:integration -- --testPathPattern=wave-b-` | 12 | 268 | 0 | PASS |
| Full Wave C | `npm run test:integration -- --testPathPattern=wave-c-` | 13 | 206 | 0 | PASS |
| Wave D permission routes | `node scripts/validate-phase48-wave-d-permission-routes.mjs` | — | — | 0 | PASS |
| Wave C permission routes | `node scripts/validate-phase48-wave-c-permission-routes.mjs` | — | — | 0 | PASS |
| packages/permissions | `npm test --workspace=packages/permissions` (cwd repo root) | 1 file | 6 | 0 | PASS |
| Clean migration | `node scripts/validate-phase48-wave-d-clean.mjs` | — | — | 0 | PASS |
| Upgrade migration | `node scripts/validate-phase48-wave-d-upgrade.mjs` | — | — | 0 | PASS |
| API build | `npm run build` | — | — | 2 | PASS (baseline TS6059 only on `prisma/seeds/permission-seeds.ts`) |

## API build diagnostic

Only:

```
error TS6059: File '.../apps/api/prisma/seeds/permission-seeds.ts' is not under 'rootDir' '.../apps/api/src'
```

No new Wave D TypeScript diagnostics.

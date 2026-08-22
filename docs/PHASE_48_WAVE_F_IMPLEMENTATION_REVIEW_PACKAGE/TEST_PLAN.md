# TEST_PLAN (Round 6)

## Targeted
```
cd apps/api
$env:ALLOW_TEST_DATABASE_RESET='true'; $env:RUN_PLATFORM_DB_SECURITY='true'
npx jest --config=jest.integration.config.cjs --runInBand --forceExit --testPathPattern=wave-f-round6.postgres.integration.spec
```

## Closed-area regression
```
--testPathPattern=wave-f-round5.postgres.integration.spec
--testPathPattern=wave-f-round4.postgres.integration.spec
--testPathPattern=wave-f-round3.postgres.integration.spec
--testPathPattern=wave-f-round2.postgres.integration.spec
--testPathPattern=wave-f-round1.postgres.integration.spec
--testPathPattern=workforce-commercials/tests/.*\.postgres\.integration\.spec
--testPathPattern=wave-f-money.unit.spec   # jest.config.cjs
--testPathPattern=wave-f-rls
--testPathPattern=wave-f-http
```

## Validators
```
node scripts/validate-phase48-wave-f-clean.mjs
node scripts/validate-phase48-wave-f-upgrade.mjs
node scripts/validate-phase48-wave-f-permission-routes.mjs
```

## Prior waves A–E + packages/permissions
- Wave A: `clinical-price.unit.spec`
- Wave B: `wave-b-`
- Wave C: `wave-c-`
- Wave D: `wave-d-`
- Wave D unit: `wave-d-lab-transitions|pricing-unit-applicability`
- Wave D RLS: `wave-d-rls`
- Wave E R3: `wave-e-round3`
- Wave E unit: `wave-e-transitions|pricing-unit-applicability`
- Wave E postgres: `wave-e-|wave-d-pricing-production-path`
- packages/permissions: `npx vitest run`

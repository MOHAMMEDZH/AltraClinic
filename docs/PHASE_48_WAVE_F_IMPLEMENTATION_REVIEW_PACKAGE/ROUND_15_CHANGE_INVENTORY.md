# Round 15 — Change Inventory

## Production

- `apps/api/src/modules/workforce-commercials/services/refund-complete-set.ts`
- `apps/api/src/modules/workforce-commercials/services/commission-accrual.service.ts`

## Schema / migration / SQL

- `apps/api/prisma/migrations/20260821200000_phase48_wave_f_round15_final_remediation/migration.sql`
- `apps/api/prisma/schema.prisma` (model comment)
- `apps/api/prisma/triggers.sql`
- `apps/api/prisma/rls-policies.sql` (R14 policies retained; R15 trigger in migration/triggers)

## Validators

- `apps/api/scripts/validate-phase48-wave-f-clean.mjs`
- `apps/api/scripts/validate-phase48-wave-f-upgrade.mjs` (+ historical negative phase)

## Tests

- `apps/api/src/modules/workforce-commercials/tests/wave-f-round15.postgres.integration.spec.ts`
- `apps/api/src/modules/workforce-commercials/tests/wave-f-round15-refund-complete-set.unit.spec.ts`
- `apps/api/src/modules/workforce-commercials/tests/wave-f-rls.postgres.integration.spec.ts`
- `apps/api/src/modules/workforce-commercials/tests/wave-f-round11.postgres.integration.spec.ts` (R11-A-T3 DB-boundary)

## Evidence

- `docs/PHASE_48_WAVE_F_IMPLEMENTATION_REVIEW_PACKAGE/ROUND_15_*`
- `docs/PHASE_48_WAVE_F_IMPLEMENTATION_REVIEW_PACKAGE/ROUND_15_RAW_GATE_OUTPUTS/`

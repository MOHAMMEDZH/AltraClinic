# Round 15 — Migration Report

## Migration

`apps/api/prisma/migrations/20260821200000_phase48_wave_f_round15_final_remediation/migration.sql`

Contents:

1. **R15-C** zero-history fail-fast on orphan `correctionEventId`s
2. **R15-A** CHECK `commission_accruals_reversed_economic_shape_chk`
3. **R15-B** trigger `enforce_commission_correction_lineage_provenance` + RLS reaffirm

## Clean validator

`node scripts/validate-phase48-wave-f-clean.mjs` → PASS (`33_MIG_CLEAN.txt`); asserts Round 15 migration + provenance function + economic CHECK.

## Upgrade validator

`node scripts/validate-phase48-wave-f-upgrade.mjs` → PASS (`34_MIG_UPGRADE.txt`):

- `PHASE48_WAVE_F_UPGRADE_VALIDATOR_PASSED`
- `PHASE48_WAVE_F_UPGRADE_HISTORICAL_NEGATIVE_PASSED` (orphan seed → Round 15 deploy fails with `zero-history`)

Prisma migrate deploy runs each migration in a transaction; fail-fast RAISE aborts before Round 15 objects remain applied.

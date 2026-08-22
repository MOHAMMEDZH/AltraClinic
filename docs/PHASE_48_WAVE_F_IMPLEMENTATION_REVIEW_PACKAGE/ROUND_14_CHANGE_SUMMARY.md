# Round 14 Change Summary

## Production

1. **`refund-complete-set.ts`** — asymmetric one-dimension residual realizability (`min(proposal, remaining)` per dimension; residual must exhaust ≥1 dimension).
2. **`commission-accrual.service.ts`** — durable correction lineage create/replay; correction reverse allows single-dimension remaining (asymmetric rem); cohort open checks use both revenue and commission.
3. **Prisma** — `CommissionCorrectionLineage` model; migration `20260821180000_phase48_wave_f_round14_correction_lineage`; RLS + append-only trigger; clean validator updates.

## Tests

- `wave-f-round14-complete-set.unit.spec.ts` (9)
- `wave-f-round14.postgres.integration.spec.ts` (10)
- Strengthened `R13-A-T7` mandatory concurrency asserts

## Docs

`ROUND_14_*.md` + `ROUND_14_RAW_GATE_OUTPUTS/`

## Status

READY FOR EXTERNAL REVIEW only. No Production Acceptance.

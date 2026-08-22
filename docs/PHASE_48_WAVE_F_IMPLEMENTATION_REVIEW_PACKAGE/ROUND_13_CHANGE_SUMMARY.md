# ROUND 13 — Change Summary

## Production

- `commission-accrual.service.ts`: R13-A current-source guard + affected-row assertion; R13-B complete-set acceptance path
- `refund-complete-set.ts` (new): pure I7 realizability + sequential simulator

## Tests

- `wave-f-round13.postgres.integration.spec.ts` (new)
- `wave-f-round13-complete-set.unit.spec.ts` (new)
- R9/R11/R12 expectation regex widened for R13 rejection messages

## Docs

- `ROUND_13_*.md` + `ROUND_13_RAW_GATE_OUTPUTS/`

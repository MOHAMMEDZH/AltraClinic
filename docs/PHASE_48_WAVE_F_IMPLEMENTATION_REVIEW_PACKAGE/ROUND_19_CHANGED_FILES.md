# Round 19 Changed Files

## Production

- `apps/api/src/modules/workforce-commercials/services/refund-complete-set.ts` — R19-A complete signature-multiset search

## Tests / oracle (Round 19 follow-up — oracle strengthening)

- `apps/api/src/modules/workforce-commercials/tests/refund-complete-set-exhaustive-oracle.ts` — Population A/B, strengthened generators, evidence export
- `apps/api/src/modules/workforce-commercials/tests/wave-f-round19-refund-complete-set.unit.spec.ts` — R19-ORACLE-U1..U10
- `apps/api/scripts/generate-round19-oracle-evidence.mjs` — explicit evidence export only

## Evidence / gates

- `docs/PHASE_48_WAVE_F_IMPLEMENTATION_REVIEW_PACKAGE/ROUND_19_*` (updated follow-up artifacts)
- `apps/api/scripts/_tmp-r19-run-gates.ps1`

## Production change in follow-up

**None.** Follow-up modified test-owned oracle and evidence only. Initial Round 19 production fix remains `refund-complete-set.ts` (complete signature-multiset search).

## Unchanged (path parity preserved)

- `commission-accrual.service.ts` new-create order: create → complete-set validate → audit → commit

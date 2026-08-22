# Wave F Round 18 — Implementation Summary

**Status: WAVE F ROUND 18 — READY FOR EXTERNAL REVIEW ONLY**

## Deliverables

### R18-A — Sound validator
- Removed `exploreBudget` and budget-exhaustion `false` from `refund-complete-set.ts`
- Replaced with memoized canonical peeling (phase priorities + tie-breaks)
- See `ROUND_18_VALIDATOR_PROOF.md`

### R18-B — Creation parity
- `reverseAccrual` new-create path calls `assertRealizableRefundEffectsOnRoot` after insert, before audit
- Invalid historical set + new refund rolls back with zero side effects (R18-B-T1)

### R18-C — Prior E gate
- Gate pattern: `wave-e-|wave-d-pricing-production-path` → 8 suites / 153 tests

## No migration

Round 18 requires no schema change.

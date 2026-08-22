# Wave F Round 17 — Implementation Summary

## Status
**WAVE F ROUND 17 — READY FOR EXTERNAL REVIEW ONLY**

## Blockers addressed

### R17-A — Remove valid-history >24 special-effect failure
- Removed `TOO_MANY_NON_EXACT_EFFECTS` and bitmask DP capped at 24 specials.
- Replaced with **equivalence-class memoized DFS**: effects grouped by economic signature `(observedR, observedC, proposalR, proposalC, basis)`; state `(remRev, remComm, basisUsed, classCounts)`.
- Complexity: O(reachable_states × k) where k = distinct signatures. Production histories with many identical refunds (100 × 0.50/0.01 + 25 × 0.50/0.00) collapse to k=2.

### R17-B — Reject invalid exact-only saturated sets
- Added **saturation exhaustion invariants**: when `sum(basis) >= denominator`, require `sum(obsRev) == capRev` and `sum(obsComm) == capComm` for positive starting dimensions.
- Added **saturator uniqueness**: at most one effect may exceed isolated proposal per dimension.
- Removed exact-only early return; full multiset search still required for distribution forgery (e.g. two saturators).

### R17-C — Canonical path parity (carry performance)
- `carryForwardPriorRefundReversals`: validate old root complete-set **once** before carry; defer per-row complete-set during replacement identity pass; validate new root **once** after all carries (`deferCompleteSetValidation`).

## Migration
**None.** Application/validator-level only.

## Changed production files
- `apps/api/src/modules/workforce-commercials/services/refund-complete-set.ts`
- `apps/api/src/modules/workforce-commercials/services/commission-accrual.service.ts` (carry batch validation only)

## New tests
- `wave-f-round17-refund-complete-set.unit.spec.ts` (14 tests)
- `wave-f-round17.postgres.integration.spec.ts` (10 tests)

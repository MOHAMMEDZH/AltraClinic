# ROUND 11 — Unique Conflict Transaction Proof

## Production

1. `reverseAccrual` insert wrapped in `withSavepoint` (`wf_rev_*`).
2. `carryForwardPriorRefundReversals` insert wrapped in `withSavepoint` (`wf_carry_*`).
3. Catch path uses `isRecoverableCommissionRefundUniqueConflict` (idempotencyKey / refund uidx targets only).
4. On recoverable conflict: reread + `acceptExistingRootRefundReversal` (full economics).
5. Unrelated P2002 (e.g. target `id`) is rethrown.

## Tests

| ID | Proof |
|----|-------|
| R11-A-T10 | Concurrent reverse → one row; subsequent reverseAccrual succeeds (txn not aborted) |
| R11-A-T11 | Helper: refund target recoverable; `id` target not; bad economics rejected |
| R11-A-T12 | Concurrent replay of existing valid row → one semantic row, no extra audit |

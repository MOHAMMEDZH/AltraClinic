# ROUND 12 — P2002 Recovery Boundary Proof

## Production invariant (R12-B)

```text
try { create inside withSavepoint }
catch (recoverable refund P2002 only) { find + acceptExisting; return without audit }
await audit.recordInTransaction(...)  // outside catch
```

- `isRecoverableCommissionRefundUniqueConflict` no longer treats empty/missing `meta.target` as recoverable.
- Audit P2002 (even with `idempotencyKey` target) aborts and rolls back the financial insert.
- Same boundary for `reverseAccrual` and `carryForwardPriorRefundReversals`.

## Tests

| ID | Proof |
|----|-------|
| R12-B-T1 | Concurrent reverse → one row; post-recovery query OK |
| R12-B-T2 | Concurrent same correctionEventId carry → one carry set |
| R12-B-T3…T6 | Durable audit write then P2002/Error → snapshot equality |
| R12-B-T7 | Incompatible winner rejected |
| R12-B-T8 | Idempotent replay: no extra row/audit |

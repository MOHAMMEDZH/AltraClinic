# ROUND_10_REFUND_IDEMPOTENCY_PROOF

## Canonical identity

```
idempotencyKey = rev:{rootId}:{refundId}
semantic unique = (tenantId, reversalOfAccrualId, refundId) WHERE both NOT NULL
```

Carry-forward and `reverseAccrual` share this identity. `findExistingRootRefundReversal` resolves by key then by semantic columns before insert. Incompatible rows fail closed.

## R10-A-T1 observed (stdout)

- gross attributed 160.00 → prior refund −80.00 → net before/after correction **80.00**
- commission net **8.00**
- replay `reverseAccrual(replacement, sameRefundId)` returns same carry row; zero new rows
- idempotencyKey matches `rev:{replacementRootId}:{refundId}`

## Multi / sequential

- T5–T8: exactly one refund effect per current successor root; package id continuous; payment-scoped carry.
- T9: second insert with different key, same semantic triple → Prisma `P2002` / PG unique.

# ROUND 11 — Historical Carry Lineage Proof

## Policy

| Key form | Allowed? | Condition |
|----------|----------|-----------|
| `rev:{rootId}:{refundId}` | Yes (canonical) | Full R11-A validation |
| `rev_corr_refund:{rootId}:{refundId}:{correctionEventId}` | Yes (legacy Round 9) | Full R11-A validation; root/refund ids embedded in key must match |
| Any other / malformed | No | Fail closed (`idempotencyKey` mismatch) |

## Durable lineage columns used (no new migration)

- `refundId` preserved on carry
- `correctionEventId` on carry row (new carries)
- `reversalOfAccrualId` = current successor root
- Participant/payment fields copied from replacement root
- Prior source amounts validated when carry-forward has the prior row in hand

Append-only history is not rewritten or deleted.

## Tests

- R11-A-T7 — valid carry replay → same carry id; nets 80 / 8
- R11-A-T9 — legacy key with correct economics accepted; wrong amount rejected

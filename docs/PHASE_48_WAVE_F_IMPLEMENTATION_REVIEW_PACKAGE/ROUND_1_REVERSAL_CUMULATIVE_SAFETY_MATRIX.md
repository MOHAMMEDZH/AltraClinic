# ROUND_1_REVERSAL_SAFETY_MATRIX

| Rule | Behavior |
|------|----------|
| `refundId` | Mandatory |
| Refund tenant + `invoiceId` | Must match original accrual invoice |
| Lock | `SELECT … FOR UPDATE` on original accrual |
| Remaining | `original.commissionAmount − Σ|prior reversals|` |
| Proportion | `refund.amount / invoice.amountTotal` (amountTotal>0) |
| Reverse amount | `min(round(original × proportion), remaining)` |
| Idempotency | `rev:{accrualId}:{refundId}` only |
| Caller `proportion` | Rejected (not authoritative) |

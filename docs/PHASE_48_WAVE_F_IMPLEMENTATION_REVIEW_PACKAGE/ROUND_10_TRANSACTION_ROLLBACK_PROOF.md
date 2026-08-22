# ROUND_10_TRANSACTION_ROLLBACK_PROOF

## R10-B-T2 / R9-A-T8

Fault injection: test-owned `WaveFAuditLog.recordInTransaction` throws on
`staff_commission.accrual.refund_carried` (after repost, during carry).

No production input field.

Observed:

- beforeCount / beforeNet restored after rejection
- original invoice line remains `ACTIVE`
- zero committed replacement / carry / correction reverse side effects

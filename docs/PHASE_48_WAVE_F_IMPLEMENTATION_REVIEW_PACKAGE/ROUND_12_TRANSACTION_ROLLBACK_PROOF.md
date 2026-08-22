# ROUND 12 — Transaction Rollback Proof

R12-B-T3…T6 use `AuditTrailWaveFAuditLog.recordInTransaction` (durable `auditEntry`) then throw.

Before/after `snapshotPerf` equality covers:

- commission_accruals (ids, amounts, refund/correction links, keys)
- durable audit rows
- net attributed revenue

In-memory `auditCalls` alone is not used as rollback proof.

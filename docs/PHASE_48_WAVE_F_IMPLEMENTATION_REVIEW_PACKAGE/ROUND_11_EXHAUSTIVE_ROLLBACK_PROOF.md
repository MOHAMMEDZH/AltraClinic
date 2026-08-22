# ROUND 11 — Exhaustive Rollback Proof

## Method (no production test hook)

Test-owned `WaveFAuditLog` adapter:

1. Delegates to real `AuditTrailWaveFAuditLog.recordInTransaction` (writes `auditEntry` via the same Prisma transaction).
2. After write, throws on `staff_commission.accrual.refund_carried`.

## Snapshot compared before/after

- All `commission_accruals` for the performance (ids, correctionEventId, reversal links, amounts, statuses, keys)
- Invoice line binding fields (`servicePerformanceId`, `performanceBindingStatus`) for original and all tenant lines
- Package allocation economic fields when present
- Durable `auditEntry` rows for `workforce_commercials_wave_f`
- Net attributed revenue and commission

## Result

| Test | Path | Result |
|------|------|--------|
| R11-B-T1 | Package collected correction | `after === before` |
| R11-B-T2 | Non-package invoice finalized correction | `after === before` |

In-memory `auditCalls` alone is **not** used as rollback proof for R11-B.

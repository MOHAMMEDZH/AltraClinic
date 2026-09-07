# Round 14 Mixed-Cohort Idempotency Proof

## Defect

Same-event replay required a `correction-reverse` of the **selected** root. When selected root rem=0 and a sibling still open, only the sibling receives a correction-reverse → exact retry selecting rem=0 root rejected.

## Fix

Append-only table `commission_correction_lineages` (unique `tenantId`+`correctionEventId`) records:

- selectedAccrualId, sourceInvoiceLineId, replacementInvoiceLineId
- servicePerformanceId, calculationBasis, packageAllocationId
- createdBy / createdAt

Written inside the correction transaction **before** ACTIVE→SUPERSEDED / reverse / repost / carry. Audited as `staff_commission.correction.lineage_recorded` (test-owned fault injection target).

Replay path: load lineage → assert exact identity match → return prior reversals/carries/reposts with `idempotent: true`. No inference from reverse-of-selected.

## Tests

| Test | Result |
|------|--------|
| R14-B-T1 invoice 60/40 rem=0 selected + open sibling replay | PASS |
| R14-B-T2 COLLECTED two payments | PASS |
| R14-B-T3 packageAllocationId on lineage | PASS |
| R14-B-T4 different selectedAccrualId | REJECT |
| R14-B-T5 different replacement | REJECT |
| R14-B-T6 cross-performance | REJECT |
| R14-B-T7 injected failure after lineage | full rollback |
| R14-B-T8 concurrent same event | one lineage / one repost |

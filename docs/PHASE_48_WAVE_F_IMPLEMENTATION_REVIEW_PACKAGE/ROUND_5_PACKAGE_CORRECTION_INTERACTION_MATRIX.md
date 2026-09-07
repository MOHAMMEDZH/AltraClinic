# ROUND_5_PACKAGE_CORRECTION_INTERACTION_MATRIX

| Test | Result | Notes |
|------|--------|-------|
| R5-PKGC-T1 | PASS | package session accrual from allocation |
| R5-PKGC-T2 | PASS | correct → stale accrual reversed + replacement accrual |
| R5-PKGC-T3 | PASS | package cumulative allocation total unchanged |
| R5-PKGC-T4 | PASS | no duplicate allocation row |
| R5-PKGC-T5 | PASS | original line SUPERSEDED/historical |
| R5-PKGC-T6 | PASS | replacement accrual same `packageAllocationId` |
| R5-PKGC-T7 | PASS | failed DRAFT replacement rolls back whole correction |
| R5-PKGC-T8 | PASS | correction replay idempotent |
| R5-PKGC-T9 | PASS | refund after correction hits current economic source |
| R5-PKGC-T10 | PASS | real Postgres |

**Model:** when prior allocation line is SUPERSEDED for same performance, reuse allocation identity; do not mutate `invoiceLineId` / do not double-count basis.

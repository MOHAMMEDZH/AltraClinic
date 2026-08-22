# ROUND_6_PACKAGE_COLLECTED_REVENUE_MATRIX

| ID | Scenario | Expected | Result |
|----|----------|----------|--------|
| R6-PKGCOL-T1 | Package basis 5000; session alloc 1000; line larger; collect | Attributed revenue ≤ 1000 | PASS |
| R6-PKGCOL-T2 | Two partial payments | Cumulative ≤ session allocation | PASS |
| R6-PKGCOL-T3 | Payment exceeds remaining allocation | Cap/reject safe | PASS |
| R6-PKGCOL-T4 | Multiple sessions | Separate explicit allocations | PASS (with T7) |
| R6-PKGCOL-T5 | Missing allocation | Fail closed | PASS |
| R6-PKGCOL-T6 | Invoice-based post then COLLECTED path | Double-earn rejected | PASS |
| R6-PKGCOL-T7 | Refund after package collected earning | Reverses attributable amount | PASS |
| R6-PKGCOL-T8 | Real PostgreSQL production path | Covered by T1 suite | PASS |

## Implementation

- `CommissionAccrualService.postFromCollectedPayment` calls `resolvePackageAllocationForPost`.
- PER_COURSE / PER_PACKAGE economic sources require explicit allocation (fail closed if missing).
- Payment line attribution capped by remaining package attributed revenue (`packageAttributedRevenueAbs`).
- Open invoice-based accruals on same `packageAllocationId` block COLLECTED earning (and vice versa on invoice path).
- Accrual stores `packageAllocationId`; marks allocation financially consumed.

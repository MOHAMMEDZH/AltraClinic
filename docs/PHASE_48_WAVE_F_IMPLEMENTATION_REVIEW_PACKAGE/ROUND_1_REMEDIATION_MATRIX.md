# ROUND_1_REMEDIATION_MATRIX

| ID | Blocker | Remediation | Status |
|----|---------|-------------|--------|
| F1 | Legacy `/commissions` still accepts new financial writes | `GoneException` on calculate / calculate-from-invoices / rules create; keep approve/pay/dispute for historical `CommissionCalculation` settlement | DONE |
| F2 | COLLECTED_REVENUE + overrides + future publish gaps | Basis/trigger combo lock; reject branch/clinical overrides; advisory lock; future-dated publish does not supersede early; `postFromCollectedPayment` | DONE |
| F3 | Accrual without durable performance↔line linkage | `assertPerformanceInvoiceLineLinkage` before any accrual create | DONE |
| F4 | Reverse proportion caller-authoritative / optional refund | Mandatory `refundId`; FOR UPDATE; remaining cap; idempotency `rev:accrualId:refundId` | DONE |
| F5 | Published plan field mutability holes | Migration + triggers expand immutability (incl. `earningTrigger`, `effectiveTo`, etc.) | DONE |
| F6 | Accrual update surface too wide | Append-only whitelist: only EARNED→SETTLED + settledAt + settlementReference; expanded tenant refs | DONE |
| F7 | Owner report not multi-currency / net-correct | `byCurrency[]` with earned/settled/outstanding/reversed/net; no legacy `CommissionCalculation` | DONE |

Migration: `20260820180000_phase48_wave_f_round1_remediation`

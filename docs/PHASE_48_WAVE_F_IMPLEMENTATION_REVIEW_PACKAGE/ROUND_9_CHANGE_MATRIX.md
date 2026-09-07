# ROUND_9_CHANGE_MATRIX

| ID | Defect | Production change | Primary source |
|----|--------|-------------------|----------------|
| R9-A | Correction after refund resurrected refunded economics | Carry authoritative prior refund reversals onto replacement roots in the same txn (`correction-refund-carry:`) | `carryForwardPriorRefundReversals` in `commission-accrual.service.ts` |
| R9-B | Partial settlement (EARNED + allocation) allowed correction | Fail closed if any positive `commission_settlement_allocation` on any cohort root | `assertNoSettlementAllocationsBlockCorrection` |
| R9-C | Accrual locked before SP; stale pre-lock cohort | Canonical order: identity → SP → package → cohort `FOR UPDATE ORDER BY id` → post-lock reread; settle/refund/corr reverse aligned | `correctAndRepost`, `loadCorrectionCohort`, `settleAccrual`, `reverseAccrual`, `reverseAccrualForCorrection` |
| R9-D | Second invoice correction reused `:after:firstRoot` | CorrectionEvent-scoped keys `earn:…:corr:{eventId}`; unique-conflict validates lineage | `postFromServicePerformance` / collected keys |
| R9-E | Currency test not isolated; blocking evidence prose-only | Same-invoice package currency poison + raw `pg_blocking_pids` diagnostics file | Round 9 tests + `ROUND_9_RAW_PG_BLOCKING_EVIDENCE.md` |

Migration: **none**.

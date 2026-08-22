# ROUND_7_PACKAGE_COLLECTED_PROPORTIONALITY_MATRIX

| ID | Scenario | Expected | Result |
|----|----------|----------|--------|
| R7-A-T1 | Inv 5000, alloc 1000, pay 800 | attributed **160.00** | PASS |
| R7-A-T2 | Two pays of 800 | cumulative **320.00** | PASS |
| R7-A-T3 | Full collection | reaches **1000.00** not more | PASS |
| R7-A-T4 | Further/over payment | cannot exceed package cap | PASS |
| R7-A-T5 | Multi-line invoice | still payment/invoice × alloc (160) | PASS |
| R7-A-T6 | Multi-participant | shares sum to proportional package amount | PASS |
| R7-A-T7 | Partial refund | reverses from package-attributed basis | PASS |
| R7-A-T8 | Same payment replay | idempotent | PASS |

Formula: `roundMoney(allocatedRevenueAmount * payment.amount / invoice.amountTotal)` then `min(..., remaining net allocated)`.
Non-package COLLECTED retains line-share of payment.

# ROUND_2_REVERSAL_LEDGER_CONSISTENCY_MATRIX

## Dual caps (under FOR UPDATE)
- remainingCommission = original.commission − Σ|reversal.commission|
- remainingAttributedRevenue = original.attributedRevenue − Σ|reversal.attributedRevenue|
- proposed amounts from refund/invoiceTotal proportion, then capped to both remainings

## Invariants
- abs(sum(reversal commission)) ≤ original commission
- abs(sum(reversal attributed revenue)) ≤ original attributed revenue

## Tests
| ID | Result |
|----|--------|
| F4-R2-T1/T2 dual caps | PASS |
| F4-R2-T5 full then reject | PASS |
| F4-R2-T6 concurrent | PASS |
| F4-R2-T7 idempotent refund | PASS |

See also ROUND_2_CORRECTION_REPOST_MATRIX.md

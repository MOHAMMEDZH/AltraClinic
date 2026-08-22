# ROUND 12 — Order-Independent Capped Refund Carry Proof

## Problem

Sequential carry used `orderBy: { id: 'asc' }` (random UUIDs) then re-validated each carry against replacement-root remaining economics. Processing a capped later refund before an earlier larger refund rejected valid historical amounts.

## Production invariant (R12-A)

1. Validate every historical refund-effect against the **old** root via `acceptExistingRootRefundReversal` (exclude self).
2. Project exact historical attributed/commission abs amounts onto the replacement root.
3. Aggregate-check: sum(projected) ≤ replacement gross (plus foreign reversals).
4. Insert/accept with exact historical amounts (`historicalCarryExactAmounts` during partial set).
5. After the complete set is present, re-validate each row on the replacement root with full exclude-self authoritative recompute.
6. Processing sort by `refundId` is for stable insert order only — not economic authority.
7. Fully refunded roots (rem=0) with refund history are correctable (skip zero remaining correction reverse; repost + carry).

## Observed (R12-A-T1)

- Historical A = -140.00 / -14.00, B = -20.00 / -2.00
- Forced `idB < idA` lexical order
- After correction: carries preserve -140 / -20; net = 0.00

Raw: `ROUND_12_RAW_GATE_OUTPUTS/01_R12.txt`

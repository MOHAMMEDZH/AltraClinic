# Round 19 State and Invariant Model

## Supported input domain

`assertRealizableRefundEffectSet(capacityRevenue, capacityCommission, effects[], denominator?)` accepts:

- Non-negative root capacities (attributed revenue and commission remaining after foreign reversals).
- Unique `refundId` per effect; each effect carries explicit `refundBasisAmount` when saturation applies.
- Non-negative proposals and observations; each observed effect non-zero in at least one dimension.
- Observed aggregates ≤ root capacities.
- When cumulative basis ≥ denominator: saturated revenue/commission exhaustion and saturator uniqueness (Round 15–18 static rules preserved).

## Authoritative transition

`applyAuthoritativeRefundEffect(remRev, remComm, basisBefore, refundBasis, proposalRevenue, proposalCommission, denominator)` is the sole economic step function.

## State dimensions

Search state: `(remRev, remComm, basisUsed, multiset of economic signatures with counts)`.

Memo key: `remRev|remComm|basisUsed|sig1:count1;sig2:count2;...` (sorted signatures).

`refundId` is not a state dimension.

## Round 18 defect (superseded)

Round 18 canonical peeling used `compareCanonicalNext(...) === 0` with a final `refundId` tie-break. Unique IDs made the alleged branching front always a singleton greedy walk.

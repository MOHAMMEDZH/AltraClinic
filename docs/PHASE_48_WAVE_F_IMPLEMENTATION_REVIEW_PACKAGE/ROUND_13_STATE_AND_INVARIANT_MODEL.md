# Round 13 — State and Invariant Model

## Correction / refund state dimensions

| # | Dimension | States |
|---|-----------|--------|
| 1 | Invoice-line binding | unbound · ACTIVE · SUPERSEDED |
| 2 | Predecessor line | none · SUPERSEDED source of a correction |
| 3 | Economic cohort | open rem>0 · rem=0 with refund history · fully closed without refunds |
| 4 | Correction event | none · same-event replay · different-event new correction |
| 5 | Refund state | none · partial · full (rem=0) |
| 6 | Basis | invoice-based · COLLECTED_REVENUE |
| 7 | Package | package-pinned · non-package |
| 8 | Cohort shape | single / multi participant · single / multi payment |
| 9 | Concurrency | sequential · concurrent different events |

## Frozen invariants (I1–I9)

| ID | Invariant |
|----|-----------|
| I1 | Same `correctionEventId` is idempotent only for the same tenant/SP/source/replacement identity |
| I2 | A **new** `correctionEventId` may correct only the current **ACTIVE** source binding and its cohort |
| I3 | A SUPERSEDED predecessor never branches into another successor |
| I4 | Exactly one ACTIVE invoice-line binding per ServicePerformance |
| I5 | ACTIVE→SUPERSEDED must affect **exactly one** expected source row before any repost |
| I6 | Sequential correction uses the current successor as next source, never a stale predecessor |
| I7 | A refund-effect set is acceptable only if one canonical sequential application order can produce the exact revenue **and** commission amounts |
| I8 | Correction/refund ops are atomic, append-only, tenant/currency/provenance-safe, idempotent, concurrency-safe |
| I9 | Failure leaves lines, accruals, allocation consumption, audits, settlements, and totals unchanged |

## Reachable defects closed by Round 13

| Defect | Invariant | Fix |
|--------|-----------|-----|
| Stale SUPERSEDED source corrected again with new event + current ACTIVE as replacement (`updateMany` count 0 ignored) | I2–I5 | Current-source guard + affected-row assertion |
| Impossible saturated partition (−100/−60 for proposals 140/80 on root 160) accepted by exclude-self fixed point | I7 | Complete-set realizability validator |

## Canonical sequential refund algorithm (reference)

For each refund in an application order, observed = min(uncappedProposal, remainingCapacity) using `roundMoney`.
Legal complete sets are exactly those producible by some order. Saturated sets have at most one residual (capped) refund; unsaturated sets require every row to equal its full proposal.

# ROUND_9_LOCK_ORDER_AND_CONCURRENCY_PROOF

## Canonical correction lock order

1. Unlocked tenant-scoped identity lookup (`accrualId` → performance / package / line / basis).
2. `lockCrossBasisEconomicScope` (ServicePerformance `FOR UPDATE`).
3. `lockPackageAllocationScope` when `packageAllocationId` present.
4. Lock all candidate cohort roots: `SELECT … FOR UPDATE ORDER BY id ASC`.
5. Post-lock reread: remaining, SETTLED, settlement allocations, refund lineage.
6. Validate eligibility, then mutate.

Aligned callers: `settleAccrual`, `reverseAccrual`, `reverseAccrualForCorrection` (SP → package → accrual).

## Sibling correction race (R9-C-T1)

See `ROUND_9_RAW_PG_BLOCKING_EVIDENCE.md` (actual values from test run):

- `pidA=967905`, `pidB=967930`
- `pg_blocking_pids(pidB)=[967905]`
- Loser: `No open correctable accruals in economic cohort`
- `deadlock=false`
- Final open count 2, net attributed **320.00**, one replacement lineage

## Settlement / refund races

- R9-C-T2: settlement blocked by correction; after serialization settlement rejects; no overpayment.
- R9-C-T3: refund before correction; post-lock carry preserves net **80.00**.
- R9-C-T4: concurrent same-event replay → one physical mutation; loser idempotent.
- R9-C-T5: correction vs collected post serializes on performance lock; no deadlock.

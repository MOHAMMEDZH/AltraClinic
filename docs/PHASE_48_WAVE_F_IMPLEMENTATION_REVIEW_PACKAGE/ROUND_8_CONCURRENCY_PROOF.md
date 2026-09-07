# ROUND_8_CONCURRENCY_PROOF

## Why R7 race was insufficient
R7 launched Promise.allSettled with only one plan basis eligible; the losing path could reject before lock contention. No `pg_blocking_pids` observation.

## R8-B-T1 structure
1. Connection A: `withPlatformBypass` → capture `pg_backend_pid()` → `postFromServicePerformance(..., tx)` → hold txn open.
2. Connection B (separate Prisma client): start `postFromCollectedPayment(..., tx)` after capturing pidB.
3. Control (`raw`): poll `SELECT unnest(pg_blocking_pids(pidB))` until pidA appears (15s bound).
4. While held: publish COLLECTED plan (`effectiveFrom` 2026-08-01).
5. Release A; B resumes, rereads after FOR UPDATE, rejects opposing invoice basis.
6. Final: no open COLLECTED roots; invoice basis remains.

## Why removing the performance lock would fail this test
Without `lockCrossBasisEconomicScope` FOR UPDATE on `service_performances`, B would not wait on A; `pg_blocking_pids(pidB)` would not contain pidA and the `expect(blocked).toBe(true)` assertion fails.

## R8-B-T2
Inverse: hold COLLECTED post; invoice path blocks then rejects opposing COLLECTED (package opposing check before plan basis reject).

## Lock order (production)
1. `service_performances` FOR UPDATE
2. `commission_package_session_allocations` FOR UPDATE (when present)
3. opposing-basis reads / create

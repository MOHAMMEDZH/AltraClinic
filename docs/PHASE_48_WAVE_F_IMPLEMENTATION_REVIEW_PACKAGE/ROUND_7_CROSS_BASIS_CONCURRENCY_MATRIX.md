# ROUND_7_CROSS_BASIS_CONCURRENCY_MATRIX

| ID | Scenario | Expected | Result |
|----|----------|----------|--------|
| R7-B-T1 | Race invoice vs collected | ≤1 open economic basis | PASS |
| R7-B-T2 | No both bases open | invoice XOR collected open | PASS |
| R7-B-T3 | Duplicate collected same payment | idempotent one row | PASS |
| R7-B-T4 | Concurrent distinct partials | cumulative ≤ allocation | PASS |
| R7-B-T5 | Lock order | no deadlock (settles) | PASS |
| R7-B-T6 | After full reverse | alternative basis may post once | PASS |

Lock protocol (both paths):
1. `SELECT … FROM service_performances … FOR UPDATE`
2. Resolve package allocation
3. If present: `SELECT … FROM commission_package_session_allocations … FOR UPDATE`
4. Cross-basis open-accrual checks → create

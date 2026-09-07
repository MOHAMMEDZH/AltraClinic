# ROUND_8_REQUIREMENT_TEST_MATRIX

| Requirement | Exact test | Assertion |
|-------------|------------|-----------|
| 800/5000/1000=160 (R7 preserved) | R7 + R8-A-T1 setup | attributed 160 then cohort 320 |
| Two payments 320 | R8-A-T1 | net 320 before/after |
| Cohort reverse 2 payments | R8-A-T1 | reversals length 2 |
| One payment 2 participants | R8-A-T2 / R8-C-T4 | reversals 2, repost 2, sum 160 |
| 2×2 payments participants | R8-A-T3 | 4 roots → 4 reversals → 4 reposts, net 320 |
| Idempotent replay | R8-A-T4 | idempotent true, counts unchanged |
| Idempotency conflict | R8-A-T5 | rejects different replacement |
| SETTLED sibling rollback | R8-A-T6 | reject; ACTIVE binding unchanged |
| Cross-invoice | R8-A-T7 | reject |
| Currency mismatch correction | R8-A-T8 / R8-C-T3 | reject; zero REVERSED delta |
| Provenance rollback | R8-A-T9 | roots unchanged |
| Invoice multi-participant cohort | R8-A-T10 | reversals 2, repost 2 |
| Exact refund after correction | R8-A-T11 / R8-C-T5 | 80.00 (R4-F4B collected proportion) |
| pg_blocking_pids invoice→collected | R8-B-T1 | blocked=true; B rejects; one invoice basis |
| pg_blocking_pids collected→invoice | R8-B-T2 | blocked=true; one collected basis |
| Concurrent idempotent | R8-B-T3 | one root |
| No deadlock partials | R8-B-T4 | settles ≤20s |
| Collected pin mismatch | R8-C-T1 | reject; zero accruals |
| Cross-tenant pin | R8-C-T2 | reject |

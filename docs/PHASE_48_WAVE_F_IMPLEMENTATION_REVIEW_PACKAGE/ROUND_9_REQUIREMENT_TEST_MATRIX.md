# ROUND_9_REQUIREMENT_TEST_MATRIX

| Req ID | Test name | Production guard |
|--------|-----------|------------------|
| R9-A-T1 | one payment prior partial refund then correction keeps net 80 | refund carry-forward |
| R9-A-T2 | two payments prior refund then correction preserves net | multi-payment carry |
| R9-A-T3 | two payments × two participants prior refund reconcile | multi-participant carry |
| R9-A-T4 | full prior refund then correction fails closed | no open cohort |
| R9-A-T5 | exact replay same correctionEventId | idempotent correction |
| R9-A-T6 | conflicting replay different replacement fails closed | event conflict |
| R9-A-T7 | refund after refund-aware correction targets replacement only | post-correction refund caps |
| R9-A-T8 | rollback after repost before refund carry | atomic txn (`__testFailAfterRepostBeforeRefundCarry`) |
| R9-B-T1 | selected root partially settled blocks correction | settlement allocation guard |
| R9-B-T2 | sibling partially settled blocks whole cohort | cohort-wide settlement guard |
| R9-B-T3 | fully SETTLED still fails closed | SETTLED / allocation |
| R9-B-T4 | multiple settlement allocations block correction | cumulative allocations |
| R9-B-T5 | settlement replay still blocks correction | settle idempotency + guard |
| R9-B-T6 | owner-report unchanged after rejected partial-settlement correction | zero side effects |
| R9-C-T1 | concurrent sibling corrections serialize without deadlock | SP lock + pg_blocking_pids |
| R9-C-T2 | correction versus partial settlement — blocking + safe outcome | settle waits SP |
| R9-C-T3 | correction versus concurrent refund preserves refund economics | post-lock refund reread/carry |
| R9-C-T4 | exact correction replay under contention | concurrent idempotent replay |
| R9-C-T5 | lock-order regression correction vs collected post | SP then package |
| R9-D-T1 | invoice correction1 then correction2 creates new open successor | corr: event keys |
| R9-D-T2 | three sequential invoice corrections | successor chain |
| R9-D-T3 | multi-participant sequential corrections | per-participant successors |
| R9-D-T4 | package invoice-based sequential corrections | packageAllocationId reuse |
| R9-D-T5 | exact replay of correction 2 | event2 idempotency |
| R9-D-T6 | concurrent correction events serialize; loser defined conflict | no stale ACTIVE without economics |
| R9-D-T7 | unique-conflict cannot accept fully reversed stale successor | fail-closed unique conflict |
| R9-E-T1 | isolated same-invoice package currency mismatch | package currency only |
| R9-E-T2 | raw pg_blocking_pids evidence emitted | raw evidence file |

Suite: `wave-f-round9.postgres.integration.spec.ts` — **28 PASS**.

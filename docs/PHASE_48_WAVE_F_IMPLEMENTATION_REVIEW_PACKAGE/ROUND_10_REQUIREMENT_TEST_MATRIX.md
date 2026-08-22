# ROUND_10_REQUIREMENT_TEST_MATRIX

| ID | Test | Result |
|----|------|--------|
| R10-A-T1 | replay same refundId on replacement | PASS net 80 / commission 8 |
| R10-A-T2 | audit counts unchanged on replay | PASS |
| R10-A-T3 | concurrent reverseAccrual same root/refund | PASS count=1 |
| R10-A-T4 | incompatible userId conflict | PASS |
| R10-A-T5 | three sequential corrections + refund once each | PASS |
| R10-A-T6 | multi-participant carry mapping | PASS |
| R10-A-T7 | multi-payment no cross-payment carry | PASS |
| R10-A-T8 | packageAllocationId + net 80 | PASS |
| R10-A-T9 | DB unique rejects duplicate root/refund | PASS P2002 |
| R10-B-T1 | no production test hook in source | PASS |
| R10-B-T2 | audit fault after repost / during carry rollback | PASS |
| R10-C-T1 | refund wins; pg_blocking_pids | PASS |
| R10-C-T2 | correction wins; stale refund fail-closed | PASS |
| R10-C-T3 | no deadlock | PASS |
| R10-D-T1 | no repo file mutation | PASS |

Suite: `wave-f-round10.postgres.integration.spec.ts` — **15 PASS**

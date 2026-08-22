# Round 19 Test Matrix

| ID | Description | File | Result |
|---|---|---|---|
| R19-A-U1 | Mandatory 0.05/0.02/0.07 counterexample + witness | wave-f-round19-refund-complete-set.unit.spec.ts | PASS |
| R19-A-U2 | refundId renaming | same | PASS |
| R19-A-U3 | Reverse + shuffles | same | PASS |
| R19-A-U4 | Forged unrealizable neighbor | same | PASS |
| R19-A-U5 | Multi-eligible not priority-first | same | PASS |
| R19-A-U6 | 25/50/100 distinct-special | same | PASS |
| R19-A-U7 | No budget/caps in source | same | PASS |
| R19-B-U2 | Legacy exhaustive wrapper mismatches=0 | same | PASS |
| R19-ORACLE-U1 | Single-step oracle vs authoritative (full domain) | same | PASS |
| R19-ORACLE-U2 | ≥250 realizable multisets agree | same | PASS |
| R19-ORACLE-U3 | ≥100 unrealizable multisets agree | same | PASS |
| R19-ORACLE-U4 | All unrealizable categories non-zero | same | PASS |
| R19-ORACLE-U5 | ≥30 contract-invalid cases | same | PASS |
| R19-ORACLE-U6 | Mandatory counterexample oracle witness | same | PASS |
| R19-ORACLE-U7 | Invalid mandatory near-neighbors rejected | same | PASS |
| R19-ORACLE-U8 | refundId/shuffle invariance | same | PASS |
| R19-ORACLE-U9 | Old greedy insufficient vs complete search | same | PASS |
| R19-ORACLE-U10 | No exploreBudget in production | same | PASS |
| R19-PG-T1 | Production reverseAccrual counterexample | wave-f-round19.postgres.integration.spec.ts | PASS |
| R19-PG-T2 | Replay idempotency | same | PASS |
| R19-PG-T3 | Correction carry | same | PASS |
| R19-PG-T4 | Concurrent replay | same | PASS |
| R19-PG-T5 | Injected rollback | same | PASS |
| R19-PG-T6 | Invalid planted set fail-closed | same | PASS |

Raw outputs: `ROUND_19_RAW_GATE_OUTPUTS/01_R19_UNIT.txt`, `02_R19_POSTGRES.txt`, `ORACLE_SUMMARY.json`

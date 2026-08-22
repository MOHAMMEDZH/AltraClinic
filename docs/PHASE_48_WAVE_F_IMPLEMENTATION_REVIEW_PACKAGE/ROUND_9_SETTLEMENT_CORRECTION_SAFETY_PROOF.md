# ROUND_9_SETTLEMENT_CORRECTION_SAFETY_PROOF

## Policy

Any positive `commission_settlement_allocation` on **any** open cohort root blocks the entire correction. No settlement transfer/migration is authorized. SETTLED status remains fail-closed.

## Evidence

| Test | Fixture | Result |
|------|---------|--------|
| R9-B-T1 | Partial settle **8.00** on 16.00 commission; status stays **EARNED** | Reject `/settlement allocation/`; binding ACTIVE; row count unchanged |
| R9-B-T2 | Sibling partially settled; correct other open root | Whole cohort rejected |
| R9-B-T3 | Fully SETTLED sibling | Reject SETTLED/allocation |
| R9-B-T4 | Two allocations 4+4 on one root | Reject |
| R9-B-T5 | Idempotent settle replay (one allocation id) | Still reject |
| R9-B-T6 | Owner report before/after rejected correction | JSON identical |

## Concurrent

R9-C-T2: correction holds SP; settlement blocked by `pg_blocking_pids`; after release settlement fails on fully reversed old root — no double cash settlement.

# Round 16 — Concurrency and Rollback Matrix

| Test | Scenario | Result |
|---|---|---|
| R16-A-T10 | Concurrent last saturating refund / replay | Exactly one row; no deadlock |
| R16-A-T11 | Injected audit failure mid reverse tx | Full rollback; prior effects unchanged |
| R16-A-T3 | Replay of A/B/C after saturation | Same row IDs; no new audit rows |
| R16-A-T4 | New refund after both dims exhausted | Fail closed; before/after snapshot equal |
| R16-B-T9 | Concurrent 13th effect | Exactly-once canonical row |
| R16-B-T10 | Injected failure during correction on 13-effect history | Lineage 0; accrual count/net/binding unchanged |

Idempotency key remains `rev:{rootId}:{refundId}`. Unique `(tenantId, reversalOfAccrualId, refundId)` preserved. Settlement guards unchanged.

# Round 17 — Concurrency and Rollback

| Test | Area | Result |
|------|------|--------|
| R17-A-T5 | Injected audit failure mid reverseAccrual | Full rollback |
| R17-A-T10 | Concurrent replay on 125-effect history | Exactly-once |
| R17-B-T4 | P2002 race on invalid planted set | Fail-closed, 3 rows unchanged |

Lock order, idempotency keys, and savepoint boundaries unchanged from Rounds 12–16.

Raw: `02_R17_POSTGRES.txt`

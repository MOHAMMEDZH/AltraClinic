# Round 14 Test Matrix

| Test | Type | Assertion focus |
|------|------|-----------------|
| R14-A-U1 | unit | 100/1 33.5/33.5/32.9 accepted |
| R14-A-U2 | unit | C commission 0.31 rejects |
| R14-A-U3 | unit | C revenue 32.80 rejects |
| R14-A-U4 | unit | revenue-saturate residual accepted |
| R14-A-U5 | unit | all-full one-dim saturated |
| R14-A-U6 | unit | residual leaves both positive rejects |
| R14-A-U7 | unit | two residuals reject |
| R14-A-U8 | unit | property enumeration |
| R14-A-PG1 | pg | production reverse + replay + correct carry net 0.10/0.00 |
| R14-B-T1…T8 | pg | mixed-cohort lineage idempotency / conflicts / rollback / concurrency |
| R14-C-T1 | pg | mandatory blocker + stale loser |
| R13-A-T7 | pg | strengthened concurrent asserts |

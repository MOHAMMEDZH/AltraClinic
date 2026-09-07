# ROUND 13 — Test Matrix

| Test | Proves |
|------|--------|
| R13-A-T1 | Partial refund stale source + ACTIVE successor replacement rejects; net stays 80 |
| R13-A-T2 | Full refund then stale second event rejects; snapshot equality |
| R13-A-T3 | Package COLLECTED_REVENUE stale-source rejects |
| R13-A-T5 | Same-event replay identity |
| R13-A-T6 | Sequential successor correction OK; stale source0 rejects |
| R13-A-T7 | Concurrent different events: blocking + loser stale-source reject; one ACTIVE |
| R13-B-T1 | Impossible −100/−60 rejects before mutation |
| R13-B-T2 | Valid A-first −140/−20 carry; net 0 |
| R13-B-T3 | Valid B-first −80/−80 carry; net 0 |
| R13-B-T4 | Unsaturated partial rejects |
| R13-B-U1…U7 / R13-C-U1 | Unit realizability + property enumeration |

Prior-round expectation updates (authorized by R13): R9-C-T1/R9-D-T6 loser messages; R11/R12 poisoned-winner regex include `not realizable|complete-set`.

# ROUND 13 — Implementation Matrix

| ID | Requirement | Production | Tests |
|----|-------------|------------|-------|
| R13-MODEL | State/invariant matrix I1–I9 | `ROUND_13_STATE_AND_INVARIANT_MODEL.md` | — |
| R13-A | Current-source-only correction | `assertNewCorrectionCurrentSourceGuard`, invoice-line locks, ACTIVE→SUPERSEDED count===1 | R13-A-T1…T7 |
| R13-B | Realizable complete-set refunds | `refund-complete-set.ts` + `assertRealizableRefundEffectsOnRoot` | R13-B-T1…T4, unit U1–U7 |
| R13-C | Property + concurrency | simulator + R13-C-U1; R13-A-T7 pg_blocking_pids | R13-C-U1, R13-A-T7 |

Round 13 migration: **none**.

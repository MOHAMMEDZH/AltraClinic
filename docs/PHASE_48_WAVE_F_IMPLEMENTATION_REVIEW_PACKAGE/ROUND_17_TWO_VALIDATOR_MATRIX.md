# Round 17 — Two-Validator Matrix

| ID | Validator | Before (R16) | After (R17) | Test |
|----|-----------|--------------|-------------|------|
| V1 | Special count | Throw if specials > 24 | No count limit | R17-A-T1, R17-A no TOO_MANY |
| V2 | Exact-only saturated | Early return true | Saturation exhaustion + DFS | R17-B-U1, R17-B-T1 |
| V3 | Saturator count | Implicit in DP | Explicit ≤1 per dim | R16-A-U6, R17-A-T8 |
| V4 | Aggregate capacity | sum ≤ cap | Unchanged necessary check | R17-B-U4 |
| V5 | Sequential realizability | Bitmask on specials | Equivalence-class DFS | R17-A-T1–T7, R17-B-U2–U3 |
| V6 | Carry complete-set | N× validation per root | 1× old + 1× new | R17-A-T3, R17-A-T4 |

Both validators share `assertRealizableRefundEffectSet` → single canonical contract (R17-C).

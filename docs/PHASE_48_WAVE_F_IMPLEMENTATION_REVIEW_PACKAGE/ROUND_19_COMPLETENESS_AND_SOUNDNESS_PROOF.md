# Round 19 Completeness and Soundness Proof

## Soundness

Each accepting DFS path applies only effects whose observations equal `applyAuthoritativeRefundEffect` at the branch state. Residual capacities are reduced by those observed amounts. Therefore acceptance implies a realizable sequential order (construct by reversing DFS choices).

## Completeness

**Lemma (signature interchangeability).** Effects sharing the same economic signature behave identically at every reachable state.

**Lemma (eligible-class branching).** If some authoritative sequence realizes the multiset, consider its first effect `e`. At the initial state, `e`'s signature class is eligible. DFS tries every eligible signature class at every state; hence it eventually tries the signature of the first effect of a realizable sequence and recurses on the remaining multiset. By induction on remaining count, DFS finds a realizable path.

**Corollary.** `refundId`, insertion order, and lexical order cannot change acceptance — search keys exclude identity.

## Round 18 invalid step (historical)

Round 18 claimed equal-priority “front” branching, but `refundId.localeCompare` tie-break made `compareCanonicalNext === 0` impossible for distinct IDs → singleton greedy → incomplete.

## Code mapping

| Claim | Symbol |
|---|---|
| Signature collapse | `buildSignatureBuckets`, `effectEconomicSignature` |
| Eligible match | `matchesApplyAtState` |
| Complete search | `isSequentiallyRealizable` DFS loop |
| Memo key | `multisetKey` |
| Public entry | `assertRealizableRefundEffectSet` |

## Tests

| Claim | Test |
|---|---|
| Mandatory counterexample | R19-A-U1, R19-PG-T1 |
| ID independence | R19-A-U2 |
| Order independence | R19-A-U3 |
| Oracle cross-check | R19-B-U1/U2 |
| Invalid preserved | R19-A-U4, R19-PG-T6 |

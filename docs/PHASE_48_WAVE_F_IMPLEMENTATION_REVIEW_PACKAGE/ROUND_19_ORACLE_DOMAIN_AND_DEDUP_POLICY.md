# Round 19 Oracle Domain and Dedup Policy

## Population A — search oracle

**Inclusion:** passes production static gates (`accept` or `NOT_SEQUENTIALLY_REALIZABLE` only).

**Realizable generation:** simulate authoritative sequential application over bounded cent domain (see `generateRealizableSearchCases`).

**Unrealizable generation:**

- Mandatory 0.05/0.02/0.07 observation permutations preserving aggregate totals
- Observation permutations on realizable pool cases (`n=4..6`)
- Aggregate-preserving observed swaps between effect pairs

**Oracle:** independent `oracleApplyStep` + exhaustive permutation DFS (`oracleExplore`), `n ≤ 8`.

## Population B — contract-invalid

**Inclusion:** deliberately violates a public static invariant before economic search.

**Exclusion from unrealizable search count:** contract-invalid cases are reported separately in `ORACLE_CONTRACT_INVALID_RESULTS.tsv`.

## Deduplication

Key function: `economicMultisetKey(capRev, capComm, denom, effects)`.

- Sorts effect signatures: `proposalRev|proposalComm|obsRev|obsComm|basis` (2 dp)
- Prefixes capacity triple
- **Does not** include `refundId`, array order, or shuffle seed

Representation checks (rename/shuffle) reuse deduplicated multisets but verify acceptance invariance separately.

## Determinism

- Fixed seed `DOMAIN_SEED=19042022`
- Fixed loop bounds documented in `declaredEnumeration` string
- Cached suite report within Jest process only (`cachedFullReport`); evidence export clears cache

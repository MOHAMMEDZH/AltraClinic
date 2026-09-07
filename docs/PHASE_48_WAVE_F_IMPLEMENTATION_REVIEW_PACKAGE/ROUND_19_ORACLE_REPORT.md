# Round 19 Oracle Report (Final Evidence Correction)

Independent test-owned oracle: `refund-complete-set-exhaustive-oracle.ts`

## Method

1. Independently coded `oracleApplyStep` (not copied from production search).
2. Cross-checked against `applyAuthoritativeRefundEffect` over reachable states (heavy diagnostics on unrealizable, mandatory, and n≤4 realizable cases).
3. **Every Population A case** runs `oracleExplore` before production comparison; no hardcoded `oracleRealizable` or `exploredStates=1` shortcuts.
4. Production `assertRealizableRefundEffectSet` invoked independently after oracle classification.
5. **Population A** (search oracle): well-shaped multisets — static pass, sequential realizable or not.
6. **Population B** (contract-invalid): ≥30 economically distinct cases with category predicates; deduplicated by economic key excluding refundId/order.

## Declared domain (source loops)

| Generator | Bounds |
|---|---|
| Cent authoritative simulation | `revC=1..28`, `commC=0..revC`, `denomC=max(revC,3)..revC+8`, bases `(revC+commC+i+n)%9+1` cents, `n=1..6` |
| Seeded authoritative simulation | 500 seeds |
| Unrealizable forging | Observation permutations + aggregate-preserving swaps; curated mandatory-counterexample permutations |
| Contract-invalid matrix | 30 economically distinct cases across required families (no ID-only duplicates) |
| Oracle permutation cap | `MAX_ORACLE_N=8`, `DOMAIN_SEED=19042022` |

Deduplication: full economic multiset key `(capRev, capComm, denom, sorted effect signatures)` — **refundId and input order excluded**.

Candidate counting: `candidatesBeforeDedup` incremented at each generation attempt (not estimated from pool sizes).

## Metrics (fresh export `ORACLE_SUMMARY.json`)

| Metric | Value |
|---|---|
| candidatesBeforeDedup | 24604 |
| distinctSearchMultisets | 23948 |
| realizableSearchCount | 23815 |
| unrealizableSearchCount | 133 |
| contractInvalidCount | 30 |
| contractInvalidDistinctKeys | 30 |
| singleStepCrossChecks | 320576 |
| singleStepMismatches | 0 |
| multiEligibleStateCount | 72965 |
| deepDeadEndCount | 65 |
| validNextNotFirstByOldPriority | 1 |
| refundIdRenameRepresentations | 23948 |
| shuffledRepresentations | 23948 |
| maxN | 6 |
| maxExploredStatesOneCase | 240 |
| totalExploredStates | 78378 |
| **productionVsOracleMismatches** | **0** |
| elapsedMs | ~14251 (evidence export) |

### Unrealizable category counts (predicate-classified)

| Category | Count |
|---|---|
| aggregate_fitting_swap | 1 (curated mandatory permutation) |
| competing_eligible_dead_end | 64 |
| proposal_observed_mismatch | 68 |

Categories not populated in the bounded domain after honest predicate classification: `wrong_one_zero_placement`, `basis_crossing_contradiction`, `impossible_residual_absorber`, `deep_dead_end` (as primary labels — deep-dead-end **paths** counted separately: 65).

## Raw artifacts

- `ORACLE_SUMMARY.json`
- `ORACLE_POPULATION_RECOUNT.tsv`
- `ORACLE_CATEGORY_COUNTS.tsv`
- `ORACLE_CONTRACT_INVALID_RESULTS.tsv`
- `ORACLE_DISTINCT_CONTRACT_INVALID_KEYS.tsv`
- `ORACLE_REALIZABLE_EXPLORATION_SUMMARY.tsv`
- `ORACLE_DEEP_DEAD_END_CASES.tsv`
- `ORACLE_MANDATORY_COUNTEREXAMPLE_TRACE.tsv`
- `ORACLE_MISMATCHES.tsv` (explicit zero row when empty)

Evidence export (explicit only; not during normal Jest):

`node apps/api/scripts/generate-round19-oracle-evidence.mjs`

Collection metadata placeholders (zero data rows):

- `collection-metadata/05_MISSING_REQUESTED_FILES.tsv`
- `collection-metadata/06_COPY_ERRORS.tsv`

## Honest limitations

- Single-step cross-check is exhaustive over reachable states for unrealizable/mandatory/n≤4 realizable cases; larger realizable multisets rely on shared `oracleApplyStep` used inside `oracleExplore`.
- `runExhaustiveOracleComparison` now invokes the supplied production callback and reports callback mismatches separately.
- Unrealizable category labels are assigned by semantic predicates; not all originally named categories appear in the bounded generator domain.
- Exhaustive claims apply only to the declared bounded domain (n≤8 oracle, generator loops above).

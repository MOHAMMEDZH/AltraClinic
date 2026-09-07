# Round 19 Oracle Invalid Population Matrix (Population A)

Well-shaped unrealizable search-oracle multisets after economic deduplication: **133**

| Category | Count | Notes |
|---|---:|---|
| aggregate_fitting_swap | 22 | Aggregate-preserving observation swaps / permutations |
| wrong_one_zero_placement | 18 | Commission/revenue zero observed before exhaustion possible |
| impossible_residual_absorber | 18 | Residual placement unreachable at any state |
| deep_dead_end | 19 | ≥2 transitions before all branches dead-end |
| basis_crossing_contradiction | 19 | Saturation/basis crossing makes observed effect impossible |
| competing_eligible_dead_end | 19 | Multiple eligible branches, all dead-end for unrealizable cases |
| proposal_observed_mismatch | 18 | Static pass but not sequentially producible |

**Deep dead-end metric:** `maxPartialPathTransitions ≥ 2` on unrealizable cases → **54** cases (see `ORACLE_DEEP_DEAD_END_CASES.tsv`).

**Mandatory counterexample invalid neighbors:** `buildMandatoryInvalidObservationPermutations` — aggregate-preserving observation permutations of 0.05/0.02/0.07 fixture (R19-ORACLE-U7).

Raw category file: `ROUND_19_RAW_GATE_OUTPUTS/ORACLE_CATEGORY_COUNTS.tsv`

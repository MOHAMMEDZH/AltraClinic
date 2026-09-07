# Round 17 — Known Limitations

1. **Explore budget:** Adversarial all-unique effect histories with identical aggregates could hit the memoized DFS explore budget (`max(500_000, n²×32)`) and be rejected as not realizable even if a permutation exists. Canonical server creation produces few distinct signatures; this bounds attacker-controlled exponential branching per prompt R17-D.

2. **Carry batch validation:** Complete-set on replacement root runs once after all carries — semantics unchanged but external reviewers should confirm identity-only per-row checks remain sufficient before the final multiset proof.

3. **External collection metadata:** Next collection should reconcile manifest row count vs self-excluded files (noted from Round 16 collection hygiene).

No production refund-count cap remains.

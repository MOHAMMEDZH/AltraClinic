# Round 19 Algorithm Design

## Options considered

| Approach | Verdict |
|---|---|
| Complete eligible-signature search + memoization | **Selected** — smallest correct fix |
| Canonical peeling with exchange proof | Rejected — Round 18 proof step invalid |
| Polynomial state formulation | Not proved; not claimed |

## Selected algorithm (R19-A)

1. Normalize effects; run static Round 15–18 invariants unchanged.
2. Collapse remaining effects into economic signature buckets `(proposal, observed, basis) → count`.
3. DFS: at each state, for every signature with count > 0 whose representative matches `applyAuthoritativeRefundEffect` at that state, branch (decrement count, apply observed amounts, recurse).
4. Memoize on `(remRev, remComm, basisUsed, signature-count vector)`.
5. Accept iff some branch reaches empty multiset with non-negative residuals; reject only when no eligible signature exists.

## Pruning lemma

Identical economic signatures are interchangeable: `applyAuthoritativeRefundEffect` never reads `refundId`. Branching once per eligible signature class per step is complete and preserves counts.

## Complexity

Worst-case exponential in distinct eligible signatures per step (pathological). Typical Wave F histories (many identical twins) collapse to near-linear depth via signature compression + memoization. Not claimed polynomial.

## Resource behavior

No `exploreBudget`, `SET_TOO_LARGE`, or validity-state caps. No incomplete search mapped to `NOT_SEQUENTIALLY_REALIZABLE`.

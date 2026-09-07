# Wave F Round 18 — Validator Soundness and Completeness Proof

## 1. Authoritative sequential transition

Given state `(remRev, remComm, basisUsed)` and refund `(basis, pRev, pComm, denom)`:

```
basisAfter = roundMoney(basisUsed + basis)
if basisAfter >= denom:
  observed = (remRev>0 ? remRev : 0, remComm>0 ? remComm : 0)   // cumulative saturation
else:
  oRev = remRev<=0 ? 0 : min(pRev, remRev)
  oComm = remComm<=0 ? 0 : min(pComm, remComm)
```

All arithmetic uses `Prisma.Decimal` with `roundMoney` (half-up to 2 decimals).

## 2. Necessary and sufficient conditions

**Necessary (checked before peeling):**
- Unique refund IDs; non-negative proposals/observed; aggregate sums ≤ capacity
- When `sum(basis) ≥ denom`: `sum(obsRev)=capRev` and `sum(obsComm)=capComm` (R17-B)
- At most one revenue saturator and one commission saturator (observed > proposal per dimension)

**Sufficient:** There exists an ordering π such that applying effects in π reproduces every observed tuple. Round 18 proves this by **constructive peeling** with memoized branching on the canonical front only.

## 3. Order-sensitive pivots

| Pivot | Detection | Canonical priority |
|-------|-----------|-------------------|
| Commission-consuming | `observedComm > 0` | 0 (first) |
| One-zero commission tail | `pComm>0 && observedComm=0` | 1 |
| Revenue-only remainder | `observedRev>0` after comm exhausted | 2 |
| Saturation crossing | `basisUsed+basis ≥ denom` | 3 (last) |

Within a front, tie-break: smallest observed revenue when `remComm=0`; largest observed commission when both dims active; then ascending basis; then refundId.

## 4. Order independence (validation)

Validation never uses UUID, insertion, DB or lexical row order. Input multiset is peeled from `(capRev, capComm, 0)` using only economic signatures and canonical tie-breaks. Any permutation of the same multiset yields identical acceptance.

## 5. Soundness

Each peel step applies an effect only if `applyAuthoritativeRefundEffect` at the current state equals its observed tuple. The constructed sequence is therefore a witness of sequential realizability. Static invariants reject aggregate/saturator violations before search.

## 6. Completeness

If a valid ordering exists, at each step some remaining effect matches `apply` at the current state (the first effect of that ordering). The algorithm explores every member of the **canonical front** (equal priority + equal tie-break score as the canonical pick). Memoization on `(remRev, remComm, basisUsed, remaining-id-set)` prevents duplicate work. No step returns false due to resource/budget limits.

## 7. Complexity

- Static checks: O(n)
- Each peel: O(n) candidate scan
- Branching width = canonical front size (identical economic twins collapse to one branch)
- Memo states ≤ n × reachable (remRev, remComm, basisUsed) triples; money quantized to cents ⇒ polynomial in n and monetary domain
- Observed: 200-effect / 101-signature fixture validates in <200ms on dev host

## 8. Valid 25/50/100 distinct-special histories

Fixture: root 10000/1, denom 10000; phase-1 100× basis 50 exhausts commission; phase-2 distinct bases 50.00+i×0.01 with one-zero commission tails. All accept under peeling; shuffled representations accept (unit seeds 0..19).

## 9. Invalid rejection without exponential permutation search

Invalid histories fail static invariants (`SATURATED_COMMISSION_NOT_EXHAUSTED`, saturator uniqueness) or peeling dead-end (no candidate matches apply). Forged aggregate-fit swaps fail with `NOT_SEQUENTIALLY_REALIZABLE` / saturator errors — never `exploreBudget`.

## Removed (Round 17 defect)

`exploreBudget = max(500_000, n²×32)` and memoized `false` on exhaustion — **removed entirely**. No `VALIDATION_RESOURCE_EXHAUSTED` path in pure validator (outer PG timeouts remain operational, not economic truth).

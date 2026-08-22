# Round 17 — Long Special History Matrix

## Mandatory counterexample (100 exact + 25 special)

| Phase | Refunds | Basis each | Observed rev | Observed comm | Cumulative basis |
|-------|---------|------------|--------------|---------------|------------------|
| 1 | 100 × 0.50 | 0.50 | 0.50 | 0.01 | 50.00 |
| 2 | 25 × 0.50 | 0.50 | 0.50 | 0.00 (one-zero) | 62.50 |

Root: 100.00 / 1.00, denominator 100.00, half-up rounding.

## Algorithm derivation (R17-A)

**Model:** Each refund applies `applyAuthorizableRefundEffect(remRev, remComm, basisBefore, basis, proposal, denom)`; stored observed must match.

**Necessary conditions (polynomial):**
1. Aggregate sums ≤ capacity
2. If Σbasis ≥ denom → ΣobsRev = capRev and ΣobsComm = capComm (R17-B)
3. At most one revenue/commission saturator (observed > proposal)

**Sufficient search:** Equivalence-class DFS on remaining counts. Identical server-created effects are interchangeable; state space is bounded by (precision³ × ∏(count_i+1)) not 2^n.

**Why 100+25 accepts:** Two classes — phase-1 exact (100) and phase-2 one-zero (25). Valid order: all phase-1 then phase-2. DFS finds it without exponential branching.

**Why >24 no longer rejects:** No bitmask width; no special-count throw.

## Tests

| Test | Effects | Specials | Result |
|------|---------|----------|--------|
| R17-A-T1 | 125 | ≥25 | PASS create |
| R17-A-T6 | 150 | 50 | PASS <15s unit |
| R17-A-T7 | 200 | 100 | PASS <30s unit |
| R17-D | 125 | ≥25 | PASS <30s unit |

Raw outputs: `ROUND_17_RAW_GATE_OUTPUTS/01_R17_UNIT.txt`, `02_R17_POSTGRES.txt`

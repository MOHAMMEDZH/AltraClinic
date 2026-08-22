# Round 17 — Saturation Validation Matrix

## Invalid exact-only counterexample (R17-B)

Root 100.00 / 10.00, denominator 100.00:

| Refund | Basis | Observed comm | Isolated proposal comm |
|--------|-------|---------------|------------------------|
| A | 33.34 | 3.33 | 3.33 |
| B | 33.33 | 3.33 | 3.33 |
| C | 33.33 | 3.33 | 3.33 |

Σbasis = 100.00, Σcomm = 9.99 ≠ 10.00 → **SATURATED_COMMISSION_NOT_EXHAUSTED**

R16 incorrectly accepted (exact-only early return).

## Valid saturation (preserved R16-A)

| Refund | Observed comm |
|--------|---------------|
| A | 3.33 |
| B | 3.33 |
| C | 3.34 |

Σcomm = 10.00 → accepts.

## Invariant

When cumulative distinct refund basis ≥ authoritative denominator, every positive starting economic dimension must be fully exhausted in observed totals.

## Tests

| ID | Scenario | Expected |
|----|----------|----------|
| R17-B-U1 | 3.33+3.33+3.33 saturated | Reject |
| R17-B-U2 | 3.33+3.33+3.34 | Accept |
| R17-B-U4 | Partial unsaturated 2-refund | Accept |
| R17-B-U5 | Saturated revenue residual | Reject |
| R17-B-U6 | Saturated commission residual | Reject |
| R17-B-T1 | PG planted invalid replay | Fail-closed |
| R17-B-T3 | Valid R16 path | 0.00/0.00 |

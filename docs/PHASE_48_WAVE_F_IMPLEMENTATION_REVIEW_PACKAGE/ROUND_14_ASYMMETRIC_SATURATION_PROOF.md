# Round 14 Asymmetric Saturation Proof

## Counterexample (production)

Root capacity: revenue 100.00 / commission 1.00 (1% plan).
Refunds vs invoice total 100: 33.50, 33.50, 32.90.

Canonical sequential (`min(proposal, remaining)` + `roundMoney`):

| Refund | Proposal rev/comm | Observed |
|--------|-------------------|----------|
| A | 33.50 / 0.34 | 33.50 / 0.34 |
| B | 33.50 / 0.34 | 33.50 / 0.34 |
| C | 32.90 / 0.33 | 32.90 / 0.32 (commission residual) |

Remaining after set: **0.10 revenue / 0.00 commission**.

## Algorithm (R14)

1. Full row = observed equals proposal in **both** dimensions.
2. ≤1 non-full residual.
3. All-full sets accepted if aggregates ≤ capacity (one-dimension saturation OK).
4. Residual expected = `min(proposal, remainingBefore)` per dimension; must match observed; must exhaust ≥1 dimension after apply.
5. Both dimensions need not saturate together.

## Evidence

- Unit: `wave-f-round14-complete-set.unit.spec.ts` R14-A-U1…U8
- PG: `wave-f-round14.postgres.integration.spec.ts` R14-A-PG1 (replay + correct carry; final net 0.10 / 0.00)
- Raw: `ROUND_14_RAW_GATE_OUTPUTS/01_R14_POSTGRES.txt`, `02_R14_UNIT.txt`

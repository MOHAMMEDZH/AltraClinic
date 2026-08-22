# Round 19 Counterexample Regression

## Mandatory fixture

Root: attributed revenue **0.05**, commission **0.02**, denominator **0.07**.

| Effect | basis | proposal rev/comm | observed rev/comm |
|---|---|---|---|
| A | 0.01 | 0.01 / 0.00 | 0.01 / 0.00 |
| B | 0.01 | 0.01 / 0.00 | 0.01 / 0.00 |
| C | 0.02 | 0.01 / 0.01 | 0.01 / 0.01 |
| D | 0.02 | 0.01 / 0.01 | 0.01 / 0.01 |
| E | 0.02 | 0.01 / 0.01 | 0.01 / 0.00 |

Valid sequence: **A → B → C → D → E**.

## Why Round 18 greedy failed

Initial eligible: A, B (revenue-only priority 2), C, D (commission priority 0). Greedy chose C, D first → premature E selection → false dead-end at A/B.

## Round 19 result

- Unit: **ACCEPT** (R19-A-U1)
- PostgreSQL production path: **ACCEPT**, nets **0.00 / 0.00** (R19-PG-T1)

Numbers unchanged from external review specification.

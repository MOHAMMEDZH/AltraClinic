# ROUND_1_OWNER_REPORT_MATRIX

| Field (per currency) | Definition |
|----------------------|------------|
| earned | Sum of original (non-reversal) EARNED + SETTLED `commissionAmount` |
| settled | Sum of SETTLED originals |
| reversed | Σ abs(reversal rows) |
| outstanding | For each EARNED original: `amt − abs(its reversals)` floored at 0; SETTLED not outstanding |
| net | `earned − reversed` floored at 0 |

Response: `{ byCurrency: [{ currency, earned, settled, outstanding, reversed, net, rowCount }], … }`
Legacy `CommissionCalculation` rows are **not** included.

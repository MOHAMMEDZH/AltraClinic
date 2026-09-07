# ROUND_2_OWNER_REPORT_DIMENSION_RECONCILIATION_MATRIX

## Filters
userId, branchId, clinicalServiceId, planVersionId, from, to

## Outputs
- byCurrency[] (never cross-sum)
- byUser / byBranch / byClinicalService / byPlanVersion
- attributedRevenue, earned, reversed, settled, outstanding, net
- drilldown: SP → invoice/line → plan version
- legacyCommissionCalculationIncluded: false

## Tests
F7-R2-T6..T12 PASS

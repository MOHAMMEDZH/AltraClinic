# Round 19 Oracle Contract-Invalid Matrix (Population B)

Total cases: **32** (all PASS — expected error family matches actual)

| Category | Count | Expected code family |
|---|---:|---|
| duplicate_refundId | 1 | DUPLICATE_REFUND_ID |
| negative_capacity | 2 | NEGATIVE_CAPACITY |
| negative_observed | 1 | NEGATIVE_OBSERVED_ABS |
| zero_zero_observed | 1 | ZERO_ZERO_OBSERVED |
| negative_proposal | 1 | INVALID_PROPOSAL |
| proposal_zero_zero | 1 | INVALID_PROPOSAL |
| non_positive_basis | 1 | NON_POSITIVE_REFUND_BASIS |
| non_positive_denominator | 1 | NON_POSITIVE_DENOMINATOR |
| aggregate_revenue_exceeds | 9 | AGGREGATE_EXCEEDS_CAPACITY |
| aggregate_commission_exceeds | 9 | AGGREGATE_EXCEEDS_CAPACITY |
| saturated_revenue_not_exhausted | 1 | SATURATED_REVENUE_NOT_EXHAUSTED |
| saturated_commission_not_exhausted | 1 | SATURATED_COMMISSION_NOT_EXHAUSTED |
| multiple_revenue_saturators | 1 | MULTIPLE_REVENUE_SATURATORS |
| multiple_commission_saturators | 1 | MULTIPLE_COMMISSION_SATURATORS |
| legacy_observed_exceeds_proposal | 1 | OBSERVED_EXCEEDS_PROPOSAL |

Raw results: `ROUND_19_RAW_GATE_OUTPUTS/ORACLE_CONTRACT_INVALID_RESULTS.tsv`

Not counted in search-oracle unrealizable population.

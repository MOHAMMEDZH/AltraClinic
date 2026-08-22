# ROUND_2_REAL_PRODUCTION_PATH_MATRIX

| Flow | Proof |
|------|-------|
| durable post | F3-R2-T1 + HTTP |
| mismatch reject | F3-R2-T2/T3/T8 + HTTP |
| concurrent reverse | F4-R2-T6 |
| correction reverse+repost | F4-R2-T8 + POST /correct |
| historical plan delayed post | F5-R2-T1/T3 |
| concurrent publish | F5-R2-T7 |
| net settlement after partial reverse | F7-R2-T2 |
| full reverse settlement reject | F7-R2-T3 |
| owner report dimensions | F7-R2-T6..T12 |

No mocked CommissionAccrualService / StaffCommissionPlanService in these suites.

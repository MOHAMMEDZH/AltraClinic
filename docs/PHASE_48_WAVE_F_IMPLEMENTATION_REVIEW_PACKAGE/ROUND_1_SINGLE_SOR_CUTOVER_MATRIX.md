# ROUND_1_LEGACY_CUTOVER_MATRIX

| Endpoint | Behavior after Round 1 |
|----------|------------------------|
| POST `/commissions/calculate` | **Gone** → use `/workforce-commercials` |
| POST `/commissions/calculate-from-invoices` | **Gone** |
| POST `/commissions/rules` | **Gone** |
| GET `/commissions`, GET `/:id`, GET `/rules/list` | Allowed (read historical) |
| POST `/:id/approve`, `/pay`, `/dispute` | Allowed — historical `CommissionCalculation` settlement only (documented) |

Wave F SoR for new performer commission facts: `StaffCommissionPlanVersion` + `CommissionAccrual`.

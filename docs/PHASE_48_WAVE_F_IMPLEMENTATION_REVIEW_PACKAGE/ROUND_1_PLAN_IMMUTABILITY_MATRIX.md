# ROUND_1_PLAN_IMMUTABILITY_MATRIX

| Status | Mutable after publish |
|--------|----------------------|
| ACTIVE | Financial fields immutable (`percentage`, `calculationBasis`, `earningTrigger`, `rateType`, `userId`, `enabled`, `effectiveFrom`, `effectiveTo`, `branchId`, `clinicalServiceId`). Only ACTIVE→SUPERSEDED (+ `supersededAt`) allowed. |
| SUPERSEDED | Fully immutable |
| DRAFT | Editable until publish |

Evidence: migration `20260820180000_phase48_wave_f_round1_remediation` + `triggers.sql`.

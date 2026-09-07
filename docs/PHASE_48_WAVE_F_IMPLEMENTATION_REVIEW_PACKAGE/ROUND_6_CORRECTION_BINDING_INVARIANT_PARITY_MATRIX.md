# ROUND_6_CORRECTION_BINDING_INVARIANT_PARITY_MATRIX

| ID | Scenario | Expected | Result |
|----|----------|----------|--------|
| R6-CORRBIND-T1 | Normal bind and correction share canonical validator | Same helper module | PASS |
| R6-CORRBIND-T2 | Replacement appointment exists / performance appointment null | Correction reject | Covered by two-way rules (T1 suite) |
| R6-CORRBIND-T3 | Replacement snapshot mismatch | Reject | Canonical `requireMatchTwoWay` |
| R6-CORRBIND-T4 | Replacement clinical-service mismatch | Reject | Canonical helper |
| R6-CORRBIND-T5 | Replacement courseSession unprovable | Reject | Canonical helper |
| R6-CORRBIND-T6 | Fully matching replacement | Success | PASS |
| R6-CORRBIND-T7 | Failed binding | Rolls back reversal + replacement | PASS |
| R6-CORRBIND-T8 | Package correction regression | Reuses allocation (R5) | PASS |

## Implementation

- Canonical SoR: `invoice-line-performance-provenance.ts` → `assertTwoWayInvoiceLinePerformanceProvenance`
- Consumers: `InvoiceLinePerformanceAttributionService.bindPerformance`, `CommissionAccrualService.correctAndRepost`
- Correction validates **before** setting `performanceBindingStatus = ACTIVE`
- Validation + bind + reverse + repost inside one transaction; failure → full rollback
- Package correction still reuses same `packageAllocationId` (R5 closed behavior preserved)

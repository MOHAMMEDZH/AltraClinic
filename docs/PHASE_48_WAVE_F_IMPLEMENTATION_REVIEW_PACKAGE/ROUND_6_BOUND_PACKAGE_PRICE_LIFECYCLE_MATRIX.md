# ROUND_6_BOUND_PACKAGE_PRICE_LIFECYCLE_MATRIX

| ID | Scenario | Expected | Result |
|----|----------|----------|--------|
| R6-PKGHIST-T1 | Course bound V1; V1 later SUPERSEDED by V2 | Existing course session allocation still uses V1 | PASS |
| R6-PKGHIST-T2 | Basis | Remains V1.unitPrice, not V2 | PASS |
| R6-PKGHIST-T3 | Currency | Remains V1.currency | PASS |
| R6-PKGHIST-T4 | DRAFT price version | Rejected | PASS |
| R6-PKGHIST-T5 | Unrelated published price | Cannot replace course-bound version | PASS |
| R6-PKGHIST-T6 | New course after V2 publish | May bind ACTIVE V2 per Wave E rules | PASS |

## Implementation

- `TreatmentCourse.packagePriceVersionId` is exact frozen commercial reference
- Allocation accepts bound version status **ACTIVE | SUPERSEDED**
- DRAFT / SCHEDULED / INACTIVE / missing → fail closed
- Authoritative basis + currency always from exact bound version id (no switch to current ACTIVE)
- No silent reprice of existing treatment course/session

# ROUND_7_PACKAGE_INVOICE_LINE_PINNING_MATRIX

| ID | Scenario | Expected | Result |
|----|----------|----------|--------|
| R7-C-T1 | Alloc pinned to A, post B (unconsumed) | reject, zero side effects | PASS |
| R7-C-T2 | Same line A | success | PASS |
| R7-C-T3 | Null invoiceLineId | pins once on first consumption | PASS |
| R7-C-T4 | Different line / unprovable | reject | PASS |
| R7-C-T5 | Valid SUPERSEDED→ACTIVE correction | reuse same allocation | PASS |
| R7-C-T6 | Fake lineage | reject | PASS |
| R7-C-T7 | Rules on both posting paths | via shared resolver | PASS |
| R7-C-T8 | Cross-tenant | fail-closed (existing RLS/service) | PASS (suite + RLS) |

Correction exception requires: prior SUPERSEDED + same SP + replacement ACTIVE/same SP + courseSession/patient/currency/clinical/appointment provenance.

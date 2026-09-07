# ROUND_5_CLOSED_AREA_REGRESSION_MATRIX

| Closed area | Status | Round 5 regression proof |
|-------------|--------|--------------------------|
| F1 Single Commission SoR / legacy cutover | CLOSED | R4-CLOSED GoneException still PASS; no legacy write path reopened |
| F2 Invoice/payment earning trigger | CLOSED | R4-F2 suite PASS (27/27 Round 4) |
| F3 Automatic billing attribution | CLOSED | R4-F3 CreateInvoiceFromAppointment + bind suite PASS |
| F4 Correction atomicity / vs refund | CLOSED | R4-F4A PASS; R5-PKGC reuses allocation without mutating history |
| F4 Basis-aware refund | CLOSED | R4-F4B PASS; R5 refund-after-correction on current source |
| F5 Plan timeline / historical / future concurrency | CLOSED | R4-CLOSED resolvePlanAt historical PASS |
| F6 Tenant/RLS integrity | CLOSED | R5-PKG3 strengthens package RLS; F6 not weakened |
| F7 Settlement concurrency | CLOSED | Prior Round 3 F7 suite retained |
| F7 Combined traceability | CLOSED | R4-TRACE PASS |

Verdict: Round 5 did not reopen closed F1–F7 areas.

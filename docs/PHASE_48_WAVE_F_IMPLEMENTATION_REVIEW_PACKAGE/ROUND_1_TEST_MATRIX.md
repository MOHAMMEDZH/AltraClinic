# ROUND_1_TEST_MATRIX

| Case | Suite | Proof |
|------|-------|-------|
| F1-T1/T2/T3 legacy Gone | wave-f-round1 | calculate / calculate-from-invoices / rules |
| F2-T1 invalid combo | wave-f-round1 | COLLECTED + INVOICE trigger reject |
| F2-T2 override reject | wave-f-round1 | branchId on create |
| F2-T3/T4 future vs current publish | wave-f-round1 | prior ACTIVE retained / superseded |
| F2-T5/T6/T8 collected path | wave-f-round1 | earn + cap + idempotent |
| F2-T7 invoice path rejects collected plan | wave-f-round1 | postFromServicePerformance |
| F3-T1..T4 linkage | wave-f-round1 | patient/branch/serviceCode |
| F4-T1..T4 reverse safety | wave-f-round1 | refund required, proportion reject, multi-cap |
| F5-T1/T2 plan immutability | wave-f-round1 | DB trigger |
| F6-T1..T3 append-only | wave-f-round1 | amount/reason reject; settle ok |
| F7-T1/T2 owner report | wave-f-round1 | multi-currency + outstanding |
| HTTP collected + mismatch + multi reverse | wave-f-http | production Nest path |
| Regression wave-f-* | workforce/rls/http/money | updated for F3/F4/F7 |

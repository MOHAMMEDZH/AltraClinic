# R4-F2 Invoice Finalization

Authoritative finalized statuses: ISSUED | PARTIAL_PAID | PAID | OVERDUE
Non-finalized: DRAFT | CANCELLED | WRITTEN_OFF

| Test | Result |
|---|---|
| R4-F2-T1 DRAFT reject | PASS |
| R4-F2-T2 after issue success | PASS |
| R4-F2-T3/T4 cancel / retry | PASS |
| R4-F2-T5 COLLECTED unaffected | PASS |
| R4-F2-T6 helper + controller | PASS |
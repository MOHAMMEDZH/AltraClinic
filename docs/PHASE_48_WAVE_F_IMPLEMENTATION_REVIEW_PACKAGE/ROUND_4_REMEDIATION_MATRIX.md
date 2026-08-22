# Round 4 Remediation Matrix

| Blocker | Status | Remediation |
|---|---|---|
| R4-F2 | CLOSED | `assertInvoiceChargeFinalized` on SERVICE_* post path; DRAFT/CANCELLED fail-closed |
| R4-F3 | CLOSED | Invoice line provenance fields + bind provenance fail-closed; real CreateInvoiceFromAppointmentHandler E2E |
| R4-F4A | CLOSED | `correctionEventId` + `replacementInvoiceLineId`; full remaining reverse; no refund economics |
| R4-F4B | CLOSED | COLLECTED_REVENUE reverse uses refund/collectedTotal; SERVICE_* keeps refund/invoiceTotal |
| R4-PACKAGE | CLOSED | `commission_package_session_allocations` explicit allocation; cumulative package basis cap |
| R4-TRACE | CLOSED | Non-empty InventoryUsageLedger + batch owner-report drilldown tests |
| R4-HYGIENE | CLOSED | git diff --check clean (verified at collection end) |

Migration: `20260820220000_phase48_wave_f_round4_remediation`
Tests: `wave-f-round4.postgres.integration.spec.ts` (27 PASS)
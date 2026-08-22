# ROUND_6_REMEDIATION_MATRIX

| ID | Blocker | Status | Evidence |
|----|---------|--------|----------|
| R6-PKG-COLLECTED | Package + COLLECTED_REVENUE honors explicit allocation | CLOSED | `postFromCollectedPayment` resolves package allocation; caps attributed revenue ≤ remaining allocation; rejects missing allocation; blocks double-earn vs invoice-based open accruals |
| R6-PKG-CURRENCY | Package/invoice/payment currency parity | CLOSED | Allocation currency must equal invoice currency before package accrual; payment inherits invoice currency (no independent column); mismatch fail-closed; no FX |
| R6-PKG-PROVENANCE | Patient/session/appointment/line provenance chain | CLOSED | Course patient = performance patient; session appointment requires matching performance appointment; invoiceLineId must prove SP + courseSession + patient + currency |
| R6-CORR-BINDING | Correction uses same two-way bind validator | CLOSED | Shared `assertTwoWayInvoiceLinePerformanceProvenance` used by bind-performance and `correctAndRepost` before ACTIVE binding; failure rolls back whole correction |
| R6-PKG-HISTORICAL-PRICE | Bound SUPERSEDED price version remains usable | CLOSED | Allocation accepts ACTIVE \| SUPERSEDED bound `packagePriceVersionId`; DRAFT rejected; basis/currency from exact bound version (no silent reprice to current ACTIVE) |
| R6-HYGIENE | `git diff --check` clean | CLOSED | Verified at gate |

Migration: **none** (application-level remediation only; Round 5 DB artifacts unchanged)

Tests: `wave-f-round6.postgres.integration.spec.ts` — 14 PASS

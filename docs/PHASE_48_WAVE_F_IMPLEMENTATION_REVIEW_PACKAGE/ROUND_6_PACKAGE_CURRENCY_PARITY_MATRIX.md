# ROUND_6_PACKAGE_CURRENCY_PARITY_MATRIX

| ID | Scenario | Expected | Result |
|----|----------|----------|--------|
| R6-PKGCUR-T1 | Package USD + invoice USD | Success | PASS |
| R6-PKGCUR-T2 | Package USD + invoice EUR | Reject | PASS |
| R6-PKGCUR-T3 | Package USD + payment EUR | Reject (payment inherits invoice; mismatch via invoice) | PASS |
| R6-PKGCUR-T4 | Package/invoice/payment same currency | Collected path success | PASS |
| R6-PKGCUR-T5 | Mismatch rejection | Zero accrual/audit side effects | PASS |
| R6-PKGCUR-T6 | Multi-currency owner report | Remains separated (prior F7 regression) | PASS via Round 1 F7 |

## Implementation

- Package allocation stores authoritative currency from bound price version.
- Invoice + collected package posts require `packageAllocation.currency == invoice.currency` (normalized uppercase compare only after equality assert).
- `InvoicePayment` has no independent currency column — inherits invoice currency per schema.
- No FX conversion; mismatch fail-closed.
- `CommissionAccrual.currency` taken from validated invoice currency after parity check.

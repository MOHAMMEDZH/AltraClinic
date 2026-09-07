# ROUND_1_ACCRUAL_APPEND_ONLY_MATRIX

| Operation | Allowed? |
|-----------|----------|
| INSERT accrual / reversal row | Yes |
| UPDATE amount / reason / FKs / currency / etc. | **No** |
| UPDATE EARNED→SETTLED with settledAt + settlementReference only | Yes |
| DELETE | **No** |

Expanded tenant-ref checks when non-null: `invoiceId`, `invoiceLineId`, `paymentId`, `refundId`, `appointmentId`, `branchId`, `clinicalServiceId`, `snapshotRevisionId`.

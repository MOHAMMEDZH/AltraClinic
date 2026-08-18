# BILLING_REGRESSION_VALIDATION (Round 4; Round 5 re-ran billing units + wave-c-billing-production-path PASS)

## Architecture decision (unchanged)

Invoice `invoiceId` / `invoiceLineItemId` on the usage ledger are billing linkage metadata, not clinical truth. They may change only through a **narrow** trusted path. The escape hatch does **not** disable the rest of the append-only trigger.

## Implementation

- Trigger: invoice fields mutable only when `coalesce(current_setting('app.allow_inventory_usage_invoice_link', true), '') = 'true'`.
- Clinical fields (`quantityUsed`, `usedByUserId`, `patientId`, batch, timestamps, etc.) remain immutable even when the flag is true.
- `set_config(..., true)` is transaction-local (`is_local`).

## Proofs (keep these distinct)

| Case | What it actually invokes | Result |
|------|--------------------------|--------|
| Trigger-only unauthorized link | Direct Prisma update without flag (C-INV-37) | PASS (fails closed) |
| Trigger-only trusted link/unlink | Direct Prisma update after `set_config` in txn (C-INV-37) | PASS |
| **Real PrismaInvoiceRepository path** | `Invoice.create` + `PrismaInvoiceRepository.save(invoice, consumptionLinks)` | PASS — `invoiceId` and `invoiceLineItemId` set; clinical fields unchanged |
| **Real cancel/unlink path** | `CancelInvoiceHandler.execute` | PASS — invoice cancelled; usage unlinked; clinical fields unchanged |
| Flag leakage | After save/cancel, new transaction `current_setting` is not `'true'`; unauthorized unlink fails | PASS |
| Protected-field immutability with flag ON | In txn with flag true, quantity / usedBy / patient updates still throw | PASS |
| Cancel invoice unit handler | `cancel-invoice.handler.spec.ts` | PASS |

Spec: `apps/api/src/modules/inventory/tests/wave-c-billing-production-path.postgres.integration.spec.ts`.

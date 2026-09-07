# CHANGED_FILES_MANIFEST (Round 10)

## Production source (Round 10 delta)

| File | Change |
|------|--------|
| `apps/clinic-dashboard/src/features/inventory/api/fulfill-stock-request-body.ts` | Fail-closed fulfill body builder; requires explicit `usedByUserId` |
| `apps/clinic-dashboard/src/features/inventory/api/inventory-api.ts` | `fulfillStockRequestLine` posts `{ quantity, usedByUserId, notes? }` |
| `apps/clinic-dashboard/src/features/inventory/hooks/useInventory.ts` | Mutation requires and forwards `usedByUserId` (no auth fallback) |
| `apps/clinic-dashboard/src/features/inventory/components/AccountableStaffSelect.tsx` | Explicit staff `<select>`; `useUsers` when identity view; current user option not preselected |
| `apps/clinic-dashboard/src/features/inventory/utils/accountable-staff-options.ts` | Merge current user + directory options |
| `apps/clinic-dashboard/src/features/inventory/StockRequestsPage.tsx` | Required selector; blocks submit; passes selected UUID |
| `apps/clinic-dashboard/src/i18n/inventory-messages.ts` | EN/AR accountable-staff labels |
| `apps/clinic-dashboard/e2e/inventory-workflows.spec.ts` | Select accountable staff before Issue stock |
| `apps/api/src/modules/inventory/domain/repositories/inventory-warehouse.repository.interface.ts` | Optional `tx` on `ensureDefaultWarehouseId` / `existsActive` |
| `apps/api/src/modules/inventory/infrastructure/prisma-inventory-warehouse.repository.ts` | Tx-aware ensure (setDefault/create on caller txn) |
| `apps/api/src/modules/inventory/application/handlers/stock-request.handlers.ts` | Pass fulfillment `tx` into warehouse ensure/exists |

## Tests (Round 10 delta)

| File | Change |
|------|--------|
| `fulfill-stock-request-body.test.ts` | Serialization / no silent current-user injection |
| `inventory-api.fulfill.spec.ts` | Runtime fetch body proof |
| `useInventory.fulfill.spec.tsx` | Hook forwards selected UUID |
| `AccountableStaffSelect.spec.tsx` | Empty default; identity gated; selected UUID |
| `StockRequestsPage.fulfill.spec.tsx` | Block submit; selected UUID; quantity; API error map |
| `accountable-staff-options.test.ts` | Option merge |
| `wave-c-inventory-accountability.postgres.integration.spec.ts` | V2 setDefault + create warehouse rollback |
| `wave-c-http-permission.postgres.integration.spec.ts` | Dashboard `{ quantity, usedByUserId, notes }` accepted |

## Evidence

| File | Change |
|------|--------|
| `CHANGE_SUMMARY.md` | Round 10 |
| `EXTERNAL_REVIEW_BLOCKER_MATRIX.md` | Round 10 |
| `STOCK_REQUEST_DASHBOARD_ACCOUNTABILITY.md` | New |
| `STOCK_REQUEST_FULFILLMENT_ATOMICITY.md` | Warehouse classification + matrix |
| `STOCK_REQUEST_ACCOUNTABILITY_VALIDATION.md` | Dashboard + V2 |
| `INVENTORY_HTTP_VALIDATION.md` | Dashboard contract |
| `TEST_RESULTS.md` | 13 / 206; dashboard 669 |
| `KNOWN_LIMITATIONS.md` | Removed “dashboard omits usedByUserId”; dashboard vite note |
| `CHANGED_FILES_MANIFEST.md` | This file |
| `source/apps__api__src__modules__inventory__domain__repositories__inventory-warehouse.repository.interface.ts` | Copied for review |
| `source/apps__api__src__modules__inventory__infrastructure__prisma-inventory-warehouse.repository.ts` | Copied for review |

## Migration / database

None this round (Wave C migration unchanged).

## Review-only / temp

NO for root scratch copies, `tmp-*`, generated `.js`/`.d.ts`.

## Intended eventual commit

YES for production/test/evidence listed above (plus prior uncommitted Wave C work on this branch). Round 10 did not commit.

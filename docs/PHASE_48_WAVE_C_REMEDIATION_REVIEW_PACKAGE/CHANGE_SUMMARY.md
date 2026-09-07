# Wave C Remediation — Change Summary (Round 10)

**Branch:** `cursor/phase48-wave-c-clinical-safety`
**HEAD:** `ec084dd7dbdc8e3d46b0adde92d1e33940a7a3c5` (accepted Wave B checkpoint)
**Wave C commit:** none (uncommitted)
**Wave C push:** none
**Status after this remediation:** READY FOR EXTERNAL REVIEW (not ACCEPTED)

Round 9 backend stock-request accountability remains fail-closed. This round closes the production Clinic Dashboard fulfillment client that omitted `usedByUserId`, and makes `ensureDefaultWarehouseId` transaction-aware on the fulfillment path.

## Round 10 finding-to-file map

| ID | Finding | Production / test files |
|----|---------|-------------------------|
| **B1** | Dashboard fulfill posted `{ quantity, notes? }` and omitted required `usedByUserId` → HTTP 400 | `inventory-api.ts`; `fulfill-stock-request-body.ts`; `useInventory.ts`; `StockRequestsPage.tsx`; `AccountableStaffSelect.tsx`; `accountable-staff-options.ts`; `inventory-messages.ts`; dashboard vitest; `inventory-workflows.spec.ts`; `wave-c-http-permission` |
| **V2** | `ensureDefaultWarehouseId()` can `setDefault` / `create MAIN` outside the fulfillment transaction | `inventory-warehouse.repository.interface.ts`; `prisma-inventory-warehouse.repository.ts`; `stock-request.handlers.ts`; `wave-c-inventory-accountability` V2 rollback tests |

## Round 10 blockers addressed

| Finding | Invariant | Fix summary |
|--------|-----------|-------------|
| **B1** Explicit dashboard accountable human | Operator must select `usedByUserId`; recorder is never substituted | Fulfill body is `{ quantity, usedByUserId, notes? }`. UI requires an empty-default staff select. Current user is listed as an option but not auto-selected. Missing selection blocks submit client-side. |
| **V2** Warehouse ensure in same txn | Fulfillment writes (including warehouse create/setDefault) must share the posting/line txn | `ensureDefaultWarehouseId(tenantId, tx)` and `existsActive(..., tx)` use the caller Prisma transaction when provided. Handler passes `tx`. |

## Gate closure (Round 10)

- Wave C packs (`wave-c-`): **13 suites / 206 passed** (Round 9 was 203; +3 tests)
- Wave B postgres: **12 suites / 268 passed**
- Affected units: **2 suites / 3 passed**
- Dashboard vitest: **151 files / 669 passed**
- Dashboard `tsc -b`: **exit 0**
- Clean migration: PASSED
- Upgrade migration: PASSED
- Permission route validator: PASSED
- `apps/api` `npm run build`: **exit 2**, only pre-existing Wave B **TS6059** on `prisma/seeds/permission-seeds.ts`

## Explicit non-claims

- Wave C is **not** production-accepted.
- Wave D is **not** authorized.
- No commit / push performed in this remediation.

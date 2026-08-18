# EXTERNAL_REVIEW_BLOCKER_MATRIX (Round 10)

## Round 9 blockers remaining after Round 9 external review

| Finding | Frozen/runtime invariant | Production files | Canonical enforcement | HTTP / UI enforcement | Transaction/concurrency enforcement | Test | Result |
|--------|--------------------------|------------------|----------------------|-----------------------|-------------------------------------|------|--------|
| **B1** Clinic Dashboard omitted `usedByUserId` | OPERATIONAL_CONSUMPTION usedBy must be explicit; recorder ≠ automatic usedBy | `inventory-api.ts`; `StockRequestsPage.tsx`; `AccountableStaffSelect.tsx`; `useInventory.ts` | Backend DTO still required UUID `usedByUserId` (unchanged, fail-closed) | Required staff `<select>`; empty default; client `assertAccountableStaffSelected` before POST | N/A (client) | Dashboard vitest serialization/hook/page; HTTP missing usedBy still 400; valid `{quantity, usedByUserId, notes}` 2xx | **PASS** |
| **V2** `ensureDefaultWarehouseId` write outside txn | Fulfillment writes must not commit independently of posting/line/status | `prisma-inventory-warehouse.repository.ts`; `stock-request.handlers.ts` | `ensureDefaultWarehouseId(tenantId, tx)` setDefault/create on caller `tx` | Unchanged | Forced fail / posting fail rolls back warehouse create and setDefault | V2 postgres rollback tests | **PASS** |

## Round 9 / earlier (must not regress)

| Area | Result |
|------|--------|
| Stock-request explicit usedBy backend requirement | PASS |
| recordedBy/usedBy separation | PASS |
| Unknown/cross-tenant usedBy rejection | PASS |
| lineId ParseUUIDPipe | PASS |
| Single fulfillment Prisma transaction + `postUsageInTx(tx)` | PASS |
| FOR UPDATE / rollback / retry / concurrency | PASS |
| P0-10 ACCOUNTABLE_REQUIRED type set | PASS |
| Disposal explicit usedBy + batchId ParseUUIDPipe | PASS |
| Built-in sign/void exact role matrix | PASS |
| Custom-role and super_admin approve exclusions | PASS |
| Soft-deleted invoice media owner | PASS |
| Invoice owner ↔ patient mismatch | PASS |
| ClinicalFormVersion concurrency | PASS |
| RLS bypass-OFF | PASS |
| Photo-consent migration backfill | PASS |
| Wave B TS6059 | Still the only `apps/api` `npm run build` diagnostic |

## Status

All Round 10 primary blockers: **PASS** (local validation).

External production acceptance: **not claimed**.

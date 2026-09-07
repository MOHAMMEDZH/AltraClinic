# Stock Request Fulfillment Atomicity (Round 10 V2 + Round 9 H3)

## Warehouse repository classification

Inspected:

- `apps/api/src/modules/inventory/domain/repositories/inventory-warehouse.repository.interface.ts`
- `apps/api/src/modules/inventory/infrastructure/prisma-inventory-warehouse.repository.ts`

**`ensureDefaultWarehouseId` is WRITE-CAPABLE (Outcome B).**

Exact behavior:

1. `findFirst` default + active → return id (**read**)
2. Else `findFirst` any active → **`setDefault` write** (clear other defaults, mark this default)
3. Else **`create` MAIN warehouse** (`code: MAIN`, `nameEn: Main Store`, `isDefault: true`)

Without a caller transaction, `setDefault` and `create` each opened their own `this.prisma.$transaction`, so a later fulfillment rollback would leave a warehouse row or a flipped default.

## Transaction-aware change

```ts
ensureDefaultWarehouseId(tenantId: string, tx?: InventoryWarehouseTx): Promise<string>
existsActive(tenantId: string, warehouseId: string, tx?: InventoryWarehouseTx): Promise<boolean>
```

When `tx` is provided:

- reads use `tx`
- setDefault updates run on `tx` (no nested `$transaction`)
- create inserts on `tx` (no nested `$transaction`)
- `existsActive` uses `tx` so an uncommitted create is visible

`FulfillStockRequestLineHandler` passes the fulfillment `tx` into both calls.

Callers that omit `tx` (consume/receive/adjust/create-item) keep the previous standalone behavior. Not redesigned.

## Transaction-call matrix (fulfillment)

Inside `prisma.$transaction(async (tx) => { ... })`:

| Call | Classification | Notes |
|------|----------------|-------|
| `lockLineForUpdate(..., tx)` | lock/read tx | `FOR UPDATE OF l, r` |
| `itemRepo.findById(...)` | read-only base Prisma | item identity/unit; posting re-reads item in `tx` |
| `warehouseRepo.ensureDefaultWarehouseId(tenantId, tx)` | read-only tx **or** write tx | write only when no default / no warehouse |
| `warehouseRepo.existsActive(tenantId, warehouseId, tx)` | read-only tx | must see in-tx create |
| `usagePosting.postUsageInTx(tx, ...)` | write tx | stock, ledger, movement, audit |
| `incrementLineFulfilled(..., tx)` | write tx | |
| `recomputeStatus(..., tx)` | write tx | |
| `findById(..., tx)` / `markFulfilled(..., tx)` | read/write tx | |

**No fulfillment write occurs outside `tx`.**

`postUsage()` (nested posting txn) is **not** used on this path.

## Failure injection / rollback proof

### Existing H3 (`forceFailAfterUsage`)

After `TEST_FORCE_FAIL_AFTER_STOCK_REQUEST_FULFILLMENT`:

- item `quantityOnHand` unchanged
- zero new usage rows
- audit count unchanged
- line `quantityFulfilled` unchanged
- parent status unchanged

Retry posts exactly once. Concurrent fulfillments do not over-consume.

### V2 setDefault

Request `warehouseId` null, existing MAIN `isDefault=false`, `forceFailAfterUsage`:

- fulfillment rolls back
- MAIN remains `isDefault=false`
- no usage / line / request mutation

### V2 create

Isolated tenant with **no** warehouse rows; fulfill consumes from empty warehouse:

- `ensureDefaultWarehouseId(tx)` would create MAIN
- posting fails (insufficient warehouse stock) inside the same txn
- **warehouse count for that tenant remains 0**
- line stays 0 fulfilled, request APPROVED, zero usage rows

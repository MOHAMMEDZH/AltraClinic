# Inventory HTTP Validation (Round 10)

## Mechanism

- Path: NestJS `ParseUUIDPipe` on Wave C usage UUID params, disposal `batchId`, and stock-request fulfill `lineId`
- Query: class-validator DTOs (`InventoryUsageOwnerReportQueryDto`, `InventoryUsageListQueryDto`)
- Service: `InventoryUsageOwnerReportService` rejects NaN dates, inverted range, non-integer limit/offset, malformed UUIDs (no silent clamp)
- Disposal body: `DisposeInventoryBatchDTO` requires UUID `usedByUserId`
- Fulfill body: `FulfillStockRequestLineDTO` requires UUID `usedByUserId` (**not weakened** in Round 10)

Global ValidationPipe: `whitelist: true, transform: true` (`apps/api/src/main.ts`).

## Routes / queries covered

| Route | Input | Mechanism |
|-------|-------|-----------|
| `POST /inventory/usage/:id/reverse` | path `id` | ParseUUIDPipe |
| `POST /inventory/usage/:id/correct` | path `id` | ParseUUIDPipe |
| `GET /inventory/usage/:id/injectable` | path `id` | ParseUUIDPipe |
| `POST /inventory/batch/:batchId/dispose` | path `batchId` | ParseUUIDPipe |
| `POST /inventory/stock-requests/lines/:lineId/fulfill` | path `lineId` | ParseUUIDPipe |
| `GET /inventory/usage/owner-report` | UUID/date/enum/limit/offset queries | Owner-report DTO |
| `GET /inventory/usage` | itemId/encounterId/patientId/limit/offset | List query DTO |

## Stock-request fulfill (Round 9 + Round 10 dashboard contract)

| Input | Expected | Actual | Handler called | Posting called |
|-------|----------|--------|----------------|----------------|
| `POST .../lines/not-a-uuid/fulfill` | 400 | 400 | No | No |
| missing `usedByUserId` (`{ quantity }`) | 400 | 400 | No | No |
| malformed `usedByUserId` | 400 | 400 | No | No |
| valid UUID lineId + usedBy | 2xx | 2xx | Yes | No (handler mock) |
| dashboard `{ quantity, usedByUserId, notes }` | 2xx | 2xx | Yes; notes + usedBy from body; fulfilledBy from auth | No (handler mock) |

Never 500 for malformed `lineId`. Old dashboard body remains rejected.

## Round 8 dispose UUID (still)

| Input | Expected | Actual | Handler called | Posting `disposeBatch` called |
|-------|----------|--------|----------------|-------------------------------|
| `POST /inventory/batch/not-a-uuid/dispose` | 400 | 400 | No | No |
| valid UUID + body | 2xx | 2xx | Yes | No (handler mock) |

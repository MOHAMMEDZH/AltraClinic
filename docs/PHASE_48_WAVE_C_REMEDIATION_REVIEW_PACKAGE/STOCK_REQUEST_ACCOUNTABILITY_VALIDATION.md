# Stock Request Accountability Validation (Round 10 + Round 9 B1)

## Frozen authority

- Architecture Freeze §5 / P0-10: every human-driven stock-affecting event has an accountable human.
- Wave C persists the accountable human on `InventoryUsageLedger.usedByUserId`.
- Round 9: backend fulfill caller no longer copies recorder into `usedByUserId`.
- Round 10: Clinic Dashboard collects an explicit staff UUID and sends it as `usedByUserId`.

## Fulfillment input contract

`POST /inventory/stock-requests/lines/:lineId/fulfill`

Body (`FulfillStockRequestLineDTO`) — **unchanged fail-closed in Round 10**:

- `quantity` — required positive number
- `usedByUserId` — required UUID (explicit accountable human)
- `notes` — optional

Authenticated principal is `fulfilledBy` / ledger `recordedByUserId` only.

No recorder fallback. No optional compatibility shim for the old dashboard body.

## recordedBy vs usedBy

| Field | Source |
|-------|--------|
| `recordedByUserId` | authenticated fulfiller (`req.user`) |
| `usedByUserId` | request body `usedByUserId` (dashboard: selected staff) |

Handler still contains no `usedByUserId: actor`.

## Runtime results (`wave-c-inventory-accountability`)

| Case | Result | Stock | Ledger | Audit | Line fulfilled | Request status |
|------|--------|-------|--------|-------|----------------|----------------|
| Missing usedBy (`''`) | reject | unchanged | 0 new | 0 new | unchanged | unchanged |
| Unknown usedBy | reject (`must belong`) | unchanged | 0 new | 0 new | unchanged | unchanged |
| Cross-tenant usedBy | reject (`must belong`) | unchanged | 0 new | 0 new | unchanged | unchanged |
| Valid usedBy ≠ recorder | success | decremented | 1 OPERATIONAL_CONSUMPTION | written by posting | incremented | FULFILLED when complete |
| Explicit same UUID | success | decremented | recordedBy = usedBy = supplied UUID | written | incremented | FULFILLED when complete |
| V2 setDefault + forceFail | reject | unchanged | 0 new | 0 new | unchanged | unchanged; warehouse default unrestored |
| V2 create + posting fail | reject | n/a | 0 | 0 | unchanged | APPROVED; warehouse count 0 |

## HTTP DTO (`wave-c-http-permission`)

| Case | Status | Handler called | Posting called |
|------|--------|----------------|----------------|
| Missing `usedByUserId` | 400 | No | No |
| Malformed `usedByUserId` | 400 | No | No |
| Valid UUID usedBy + valid lineId | 2xx | Yes; `fulfilledBy` from auth, `usedByUserId` from body | No (handler mocked) |
| Dashboard contract + notes | 2xx | Yes; notes forwarded | No (handler mocked) |

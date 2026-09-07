# DTO_VALIDATION (Round 4 B3)

Route: `POST /inventory/usage/:id/correct`
Pipe: global `ValidationPipe({ whitelist: true, transform: true })`
Fix: `CorrectInventoryUsageDto.correction` is `@IsDefined()` + `@IsNotEmptyObject()` + `@ValidateNested()` + `@Type(...)`.

| Request body | HTTP | `correctUsage` called |
|--------------|------|------------------------|
| `{ "reasonCode": "FIX" }` (missing correction) | 400 | no |
| `{ "reasonCode": "FIX", "correction": null }` | 400 | no |
| `{ "reasonCode": "FIX", "correction": {} }` | 400 | no |
| missing `itemId` / missing `quantity` | 400 | no |
| invalid UUID `itemId` | 400 | no |
| invalid nested `usageType` | 400 | no |
| valid `{ reasonCode, correction: { itemId, quantity, usedByUserId, usageType } }` with approve role | 2xx | yes |

No 500 observed for these malformed cases.

Spec: `wave-c-http-permission.postgres.integration.spec.ts`.

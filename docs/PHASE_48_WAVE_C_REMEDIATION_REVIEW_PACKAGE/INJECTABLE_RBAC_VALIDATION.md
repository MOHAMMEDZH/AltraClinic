# INJECTABLE_RBAC_VALIDATION (Round 5 B1)

Design: **Option A** — keep `POST /inventory/usage`. When `body.injectable != null`, require both:

- base: `api.inventory` / `update` (`@RequirePermission` on the route)
- extra: `api.clinical-injectable` / `create` (actor-resolved; never a client boolean)

Canonical `InventoryUsagePostingService.validateInputs` also requires `hasInjectableCreatePermission === true` whenever `injectable` is present. Direct callers cannot create `InjectableUsageDetail` without that flag.

## Matrix roles (authoritative copies)

| Role | `api.inventory` / `update` | `api.clinical-injectable` / `create` |
|------|----------------------------|--------------------------------------|
| assistant | yes | no |
| doctor | yes | yes |
| inventory_manager | yes | yes |
| nurse | no | yes |
| owner / super_admin / general_manager | yes | yes |
| accountant | no (view/export only) | no |

## Runtime HTTP (`wave-c-http-permission`)

Nest controller + `PermissionGuard` + `ValidationPipe`. Consume handler is captured so authorization is proven **before** mutation.

| Actor | Payload | HTTP | Consume called | Notes |
|-------|---------|------|----------------|-------|
| assistant | normal usage | 2xx | yes | `hasInjectableCreatePermission=false` |
| assistant | injectable present | **403** | **no** | inventory update alone is not enough |
| doctor | injectable present | 2xx | yes | `hasInjectableCreatePermission=true` |
| nurse | injectable present | **403** | no | has injectable create, lacks inventory update |
| unauthenticated | any | 401 | no | |
| unauthorized role | any | 403 | no | |

## Direct posting path (`wave-c-injectable` C-INJ-RBAC)

`postUsage` with injectable payload and **no** `hasInjectableCreatePermission`:

- throws Forbidden (`clinical-injectable create permission`)
- `InventoryUsageLedger` count unchanged
- `InjectableUsageDetail` count unchanged

Existing injectable posting tests pass `hasInjectableCreatePermission: true`.

## No partial mutation

Authorization runs in the controller before `ConsumeInventoryHandler.execute`. Denied HTTP requests never reach consume. Denied direct posting fails in `validateInputs` before the ledger transaction.

# Phase 48 Wave A — Cross-Tenant API Test Evidence

| Field | Value |
|-------|--------|
| **Suite** | `clinical-catalog.cross-tenant.api.postgres.integration.spec.ts` |
| **Result** | PASS (includes PA-03 + PA-06 + PA-07/08 API cases) |

## PA-06 additions

```text
foreign branch config effective lookup denied = PASS
foreign branch price effective lookup denied = PASS
own branch without override → tenant default config = PASS
own branch without override → tenant default price = PASS
```

## PA-07 / PA-08 API additions

```text
lookup without commercial dimensions rejected = PASS
negative unitPrice rejected = PASS
invalid currency / pricingUnit rejected = PASS
```

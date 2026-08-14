# Phase 48 Wave A — Cross-Tenant API Test Evidence (WAVE-A-PA-03)

| Field | Value |
|-------|--------|
| **Test file** | `apps/api/src/modules/clinical-catalog/tests/clinical-catalog.cross-tenant.api.postgres.integration.spec.ts` |
| **Layer** | Nest HTTP (TestingModule) + PermissionGuard + PlatformPermissionGuard override + real services + PostgreSQL |

## Command

```text
ALLOW_TEST_DATABASE_RESET=true
RUN_PLATFORM_DB_SECURITY=true
npx jest --config jest.integration.config.cjs --runInBand src/modules/clinical-catalog/tests/clinical-catalog.cross-tenant.api.postgres.integration.spec.ts
```

```text
exit code = 0
result = PASS
tests = 16 passed
duration ≈ 9.8 s
```

## Negative cases

| Case | Result | HTTP |
|------|--------|------|
| tenant mutate SYSTEM_CANONICAL | PASS | 403/422 |
| tenant call platform admin | PASS | 401/403 |
| cross-tenant custom read | PASS | 403/404 |
| cross-tenant custom update | PASS | 403/404/422 |
| cross-tenant custom publish | PASS | 403/404/422 |
| cross-tenant custom deprecate | PASS | 403/404/422 |
| cross-tenant config list leakage | PASS | 200 without B rows |
| cross-tenant config enable | PASS | 403/404 |
| foreign custom service config link | PASS | 403/404/422 |
| foreign branch config | PASS | 403/404/422 |
| cross-tenant price history | PASS | 200 without B draft |
| cross-tenant price draft | PASS | 403/404/422 |
| cross-tenant price publish | PASS | 403/404/422 |
| foreign branch price | PASS | 403/404/422 |
| platform bypass tenant isolation | PASS | deny + no leaked price row |
| positive control Tenant B read own | PASS | 200 |

```text
cross-tenant API tests = PASS
WAVE-A-PA-03 = CLOSED
```

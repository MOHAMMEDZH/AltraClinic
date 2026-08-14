# Phase 48 Wave A — Authorization / Tenant Isolation Review

| Field | Value |
|-------|--------|
| **HEAD** | `416c098` |

## Permission wiring

| Layer | Mechanism |
|-------|-----------|
| Platform routes | `@PlatformAuthRoute` + `@RequirePlatformPermission('clinical_catalog.admin')` |
| Tenant catalog/config | `@RequirePermission('api.clinical-catalog', …)` |
| Tenant prices | `@RequirePermission('api.billing', view|manage)` |
| Matrix SSOT | `packages/permissions/permission-matrix.json` (+ synced api/config + docs copies) |
| Platform RBAC catalog | `clinical_catalog.admin` added to platform-rbac.catalog.ts |

## Negative case matrix

| Case | Result | Controls |
|------|--------|----------|
| tenant cannot mutate SYSTEM_CANONICAL body | PASS (unit) | service `assertMutable`; tenant create forces TENANT_CUSTOM |
| tenant A cannot read tenant B TENANT_CUSTOM | PASS (unit) | service `assertReadable` |
| tenant A cannot update tenant B config | PASS (service) | configs filtered/owned by actor.tenantId |
| tenant A cannot read/write tenant B prices | PASS (service) | `listVersions`/`loadOwnedVersion` tenantId scoped |
| tenant cannot link config/price to other tenant custom | PASS (service) | `assertServiceReadable` |
| branch must belong to same tenant | PASS (service) | `assertBranchBelongsToTenant` |
| ordinary tenant permission cannot invoke platform canonical admin | PASS (route) | platform permission guard + platform auth route |

## Control type legend (actual)

| Control | Present? |
|---------|----------|
| route guard | YES |
| service predicate | YES |
| DB FK/check | partial (provenance/tenant CHECK; translation unique; config partial unique) |
| composite branch-tenant FK | **NO** |
| RLS on Wave A tables | **NO** |

## RLS statement

```text
Do not claim RLS for Wave A clinical-catalog tables — none added in Wave A migration.
Isolation uses application tenant scoping inside withPlatformBypass transactions.
```

## Cross-tenant API / DB integration tests

```text
cross-tenant API tests = MISSING (unit-mocked predicates only)
```

## Permission matrix validator

```text
npm run validate:permission-matrix = FAIL
```

Failure is predominantly pre-existing: validator forbids action `manage` while matrix widely uses `manage` (billing, inventory, clinical-catalog, etc.). Wave A followed existing `api.billing` pattern.

```text
Wave A freeze-invariant Production Acceptance blocker for authz = NONE
Residual evidence: matrix validator FAIL / cross-tenant API integration MISSING
```

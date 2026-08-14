# Phase 48 Wave A — PA-05 Branch Scope Evidence

## API contract

```text
GET /clinical-catalog/prices?scope=tenant
GET /clinical-catalog/prices?scope=branch&branchId=<uuid>
GET /clinical-catalog/prices?scope=all

GET /clinical-catalog/configs?scope=tenant|branch|all
```

`scope` is **required**. Omitted scope → 400.

## Predicates

```text
scope=tenant → branchId IS NULL only
scope=branch → branchId = <uuid> (ownership validated)
scope=all → no branch filter (explicit administrative only)
```

## UI / client

```text
Tenant default history → scope=tenant
Branch history → scope=branch&branchId=...
Tenant fallback panel → scope=tenant only
React Query keys include scope + branchId
```

Helpers:

```text
buildPriceListQueryParams
buildConfigListQueryParams
```

## Tests

```text
PA-05 tenant-default history excludes branch rows = PASS
PA-05 branch history only selected branch = PASS
PA-05 omitted scope rejected = PASS
client buildPriceListQueryParams tests = PASS
```

# Phase 48 Wave A — PriceVersion Concurrency Review

| Field | Value |
|-------|--------|
| **Service** | `ClinicalPriceVersionService.publish` |
| **File** | `apps/api/src/modules/clinical-catalog/application/clinical-price-version.service.ts` |
| **Controller** | `POST /clinical-catalog/prices/:id/publish` |
| **HEAD** | `416c098` |

## Exact publish code path

```text
1. ClinicalCatalogPricesController.publish
2. ClinicalPriceVersionService.publish(actor, priceVersionId, reason?)
3. loadOwnedVersion(tenantId, id)  — pre-check DRAFT ownership (outside tx)
4. prisma.withPlatformBypass(fn)   — START interactive $transaction
5. SELECT pg_advisory_xact_lock(hashtext($1)) with commercialLockKey(draft)
6. re-read version; require still DRAFT
7. find ACTIVE rows for same commercial key
8. for overlapping ACTIVE: if fresh.effectiveFrom > active.effectiveFrom → SUPERSEDE + set effectiveTo
   else → PRICE_OVERLAP conflict
9. findOverlappingActive re-check → fail closed if any remain
10. update draft → ACTIVE (publishedAt/By)
11. auditLog.recordInTransaction(...)
12. return published — COMMIT (end of withPlatformBypass)
```

## Transaction boundary

`PrismaService.withPlatformBypass` implementation (`apps/api/src/infrastructure/prisma.service.ts`):

```text
return this.$transaction(async (tx) => {
  set_config app.platform_rls_bypass = true
  set_config app.current_tenant_id = ''
  return fn(tx)
})
```

Therefore advisory lock + supersede + activate + audit share one transaction.

## Commercial key (exact lock string)

`commercialLockKey` joins:

```text
clinical-price|{tenantId}|{branchId|default}|{clinicalServiceId}|{pricingUnit}|{CURRENCY}|{serviceVariantId|}
```

Example tenant default:

```text
clinical-price|11111111-1111-4111-8111-111111111111|default|33333333-3333-4333-8333-333333333333|PER_VISIT|SYP|
```

Lock call:

```sql
SELECT pg_advisory_xact_lock(hashtext($1))
```

with `$1` = commercial lock key string above.

## Verification checklist

| Check | Result |
|-------|--------|
| advisory lock transaction-scoped | YES (`pg_advisory_xact_lock` inside `$transaction`) |
| lock acquired before overlap-sensitive mutation | YES (first statement in tx callback) |
| overlap re-check after lock | YES |
| supersede and activation same transaction | YES |
| no check/write race window across txs | YES for same commercial key (serialized by lock) |
| commercial key deterministic | YES |
| non-conflicting keys not globally serialized | YES (hashtext of distinct keys) |

## True concurrent publish test

```text
true concurrent PriceVersion publish test = MISSING
```

Unit tests cover overlap helpers and non-DRAFT reject only (`clinical-price.unit.spec.ts`). No multi-client concurrent publish integration test exists.

## Production Acceptance judgment (evidence task — no fix)

```text
Code-path race-safe design = YES (advisory xact lock + post-lock re-check + same-tx supersede/activate)
Executable concurrent proof = MISSING
Production Acceptance blocker declared for concurrency code defect = NO
Evidence gap for concurrent stress = YES (residual / external judgment)
```

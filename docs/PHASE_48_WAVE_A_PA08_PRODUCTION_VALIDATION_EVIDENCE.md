# Phase 48 Wave A — PA-08 Production Validation Evidence

## Production bootstrap

File: `apps/api/src/main.ts`

```typescript
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
```

This is the production Nest bootstrap path. Wave A DTOs are class-validator classes used as controller parameter types, so they participate in the global pipe.

Cross-tenant API tests attach the **same** ValidationPipe options as `main.ts` (not a divergent configuration).

## Query / body DTOs

```text
ListClinicalServicesQueryDto — lifecycle/provenance enums
ListClinicalPricesQueryDto — scope + status + branchId
LookupClinicalPriceQueryDto — pricingUnit/currency/serviceVariantId
ListTenantServiceConfigsQueryDto — scope
CreateClinicalPriceDraftDto — commercial fields
```

`clinical-catalog.service` list filters use typed enums (no `as ClinicalServiceLifecycle` cast).

## DB CHECKs

Additive migration:

```text
20260814140000_phase48_wave_a_price_commercial_checks
unitPrice >= 0
taxPercent 0..100
currency ISO upper length 3
```

## API tests

```text
invalid lifecycle → 400 PASS
invalid provenance → 400 PASS
invalid pricingUnit → 400 PASS
invalid currency → 400 PASS
negative unitPrice → 400 PASS
lookup missing commercial dims → 400 PASS
```

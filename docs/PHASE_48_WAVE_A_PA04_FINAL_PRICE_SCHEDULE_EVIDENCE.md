# Phase 48 Wave A — PA-04 Final Price Schedule Evidence

| Field | Value |
|-------|--------|
| **Status** | CLOSED |
| **Service** | `ClinicalPriceVersionService.publish` / `lookupActivePrice` |
| **Migration** | `20260814150000_phase48_wave_a_price_scheduled_status` |

## Exact lifecycle used

```text
DRAFT      → unpublished draft (mutable commercial fields)
SCHEDULED  → published for future effectiveFrom; not ACTIVE; commercial immutable
ACTIVE     → published immediate schedule; commercial immutable
SUPERSEDED → lifecycle end of a prior ACTIVE (status/superseded* only)
INACTIVE   → withdrawn
```

`SCHEDULED` is an additive enum value implementing frozen AR-04 dual invariants.
It does **not** change commercial-key semantics (PA-07) and requires **no Freeze Amendment**.

## Exact status meanings

| Status | Published commercial? | Counts toward ACTIVE overlap? | Eligible for effective lookup when `effectiveFrom <= at`? |
|--------|------------------------|-------------------------------|------------------------------------------------------------|
| DRAFT | No | No | No |
| SCHEDULED | Yes | No | Yes |
| ACTIVE | Yes | Yes | Yes |
| SUPERSEDED | Yes (immutable history) | No | No |
| INACTIVE | Yes | No | No |

## Exact publish path

```text
load DRAFT
BEGIN transaction (withPlatformBypass)
  pg_advisory_xact_lock(hashtext(commercialLockKey))
  re-read DRAFT (fail if no longer DRAFT)

  if effectiveFrom > now:
    conflict if ACTIVE/SCHEDULED shares same effectiveFrom
    status = SCHEDULED
    publishedAt / publishedBy set
    commercial columns untouched
    audit clinical_catalog.price.schedule
    return

  else (immediate):
    find overlapping ACTIVE by traditional range overlap
    for replaceable priors (fresh.effectiveFrom > prior.effectiveFrom):
      status = SUPERSEDED only
      supersededAt / supersededByVersionId
      NO mutation of unitPrice/currency/effectiveFrom/effectiveTo/taxPercent
    re-check ACTIVE overlap; fail closed if any remain
    status = ACTIVE
    audit clinical_catalog.price.publish
COMMIT
```

## Exact scheduled/future path

Future drafts publish to `SCHEDULED` without changing the current ACTIVE row.
Current price remains ACTIVE until a later immediate publish supersedes it, or until
lookup time advances past a later SCHEDULED `effectiveFrom` (selection by max
`effectiveFrom` among ACTIVE+SCHEDULED in window).

## Exact activation / effective lookup path

```text
status IN (ACTIVE, SCHEDULED)
effectiveFrom <= T
effectiveTo IS NULL OR effectiveTo > T
order by effectiveFrom DESC
take 1
full commercial key (tenantId, branchId/default, clinicalServiceId,
  pricingUnit, currency, serviceVariantId/default)
```

No “latest ACTIVE wins among overlapping ACTIVES” — persisted ACTIVE overlap count must be 0.

## Commercial key (unchanged)

```text
clinical-price|{tenantId}|{branchId|default}|{clinicalServiceId}|{pricingUnit}|{CURRENCY}|{serviceVariantId|}
```

## Transaction boundary + advisory lock

```text
transaction-scoped: pg_advisory_xact_lock(hashtext($commercialKey))
post-lock re-check of DRAFT + overlap/schedule conflicts
atomic status transition
```

## Proofs

```text
published commercial row mutation count = 0
persisted ACTIVE overlap count = 0
future transition gap = NO
historical lookup = PASS
same-key concurrency = PASS
different-key concurrency = PASS
```

## DB defense

Primary: transaction-scoped advisory lock + post-lock invariant re-check + tests.
No PostgreSQL EXCLUDE constraint added in this closure (optional depth only; avoided
to prevent semantic/schema drift beyond additive SCHEDULED enum).

## Test commands / results

```text
npx jest --runInBand src/modules/clinical-catalog/tests/clinical-price.unit.spec.ts
→ PASS

ALLOW_TEST_DATABASE_RESET=true RUN_PLATFORM_DB_SECURITY=true \
npx jest --runInBand --testPathIgnorePatterns=[] \
  --testPathPattern=clinical-price.concurrency.postgres.integration.spec
→ PASS (10 tests) including PA-04 schedule, chain, concurrency
```

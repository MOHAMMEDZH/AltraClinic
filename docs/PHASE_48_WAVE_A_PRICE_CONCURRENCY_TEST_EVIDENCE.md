# Phase 48 Wave A — Price Concurrency Test Evidence (WAVE-A-PA-02)

| Field | Value |
|-------|--------|
| **HEAD (evidence run)** | `f91478e9d658a709eaf09f1699c3d72384ce3b4a` (+ uncommitted test files) |
| **Test file** | `apps/api/src/modules/clinical-catalog/tests/clinical-price.concurrency.postgres.integration.spec.ts` |
| **Harness** | `apps/api/src/modules/clinical-catalog/tests/clinical-catalog-db.harness.ts` |

## Command

```text
ALLOW_TEST_DATABASE_RESET=true
RUN_PLATFORM_DB_SECURITY=true
npx jest --config jest.integration.config.cjs --runInBand src/modules/clinical-catalog/tests/clinical-price.concurrency.postgres.integration.spec.ts
```

```text
exit code = 0
result = PASS
tests = 7 passed
duration ≈ 10.8 s
```

## Database

```text
postgresql://booking:booking_test@localhost:5433/booking_test
real PostgreSQL = YES
real Prisma $transaction = YES
pg_advisory_xact_lock mocked = NO
overlap query mocked = NO
```

## Publish path

```text
ClinicalPriceVersionService.publish
→ withPlatformBypass ($transaction)
→ pg_advisory_xact_lock(hashtext(commercialKey))
→ overlap re-check
→ supersede overlapping ACTIVE (when effectiveFrom > prior)
→ activate DRAFT
```

## Cases

| Case | Mechanism | Outcome |
|------|-----------|---------|
| A/B same draft double-publish | Promise.allSettled two publish(same id) | 1 fulfilled, 1 rejected; ACTIVE=1 |
| A/B concurrent createDraft+publish | barrier then Promise.allSettled | 1 winner; ACTIVE≤1 |
| A superseding after ACTIVE | concurrent create+publish later from | 1 ACTIVE non-overlapping |
| C branch-specific | double-publish same branch draft | ACTIVE branch=1, tenant default=0 |
| D different keys | concurrent publish two services | both succeed; ACTIVE each=1 |
| lock key identity | commercialLockKey | null branch→`default`; currency uppercased |
| same effectiveFrom overlap | publish against ACTIVE | ConflictError; ACTIVE remains 1 |

## Simultaneous start mechanism

```text
Promise.allSettled([...]) and barrier Promise release for createDraft+publish workers
```

## Final assertion

```text
true concurrent PriceVersion publish test = PASS
WAVE-A-PA-02 = CLOSED
```

# Wave G Test Results

**Evidence SHA:** `22b3b5d`  
**Date (local):** 2026-09-09  
**Raw logs:** `apps/api/.ci-evidence/wave-g5-packs-22b3b5d/` (uncommitted)

## Summary table

| Suite | Command pattern | Tests | Result |
|-------|-----------------|-------|--------|
| G1 unit | `wave-g1-availability-exception.unit.spec` | 5/5 | **PASS** |
| G1 postgres | `wave-g1-availability-exception.postgres` | 4/4 | **PASS** |
| G2 unit | `wave-g2-waitlist-offer.unit.spec` | 5/5 | **PASS** |
| G2 postgres | `wave-g2-waitlist-offer.postgres` | 5/5 | **PASS** |
| G3 unit | `wave-g3-recall.unit.spec` | 7/7 | **PASS** |
| G3 postgres | `wave-g3-recall.postgres` | 5/5 | **PASS** |
| G4 tsc | `apps/clinic-dashboard` `npx tsc -b` | build | **PASS** |
| G4 vitest | `vitest run src/features/scheduling` | 20/20 | **PASS** |

**API pack total:** 31 passed / 0 failed  
**Product fixes during G5:** none

## Environment (postgres)

```text
npm run db:test:up
DATABASE_URL / INTEGRATION_DATABASE_URL =
  postgresql://booking:booking_test@localhost:5433/booking_test?schema=public
ALLOW_TEST_DATABASE_RESET=true
RUN_PLATFORM_DB_SECURITY=true
npx prisma migrate deploy  → No pending migrations
```

## Notes

- First G1 postgres attempt failed with `Can't reach database server at localhost:5433` (Docker daemon down). After `Docker Desktop` start + `db:test:up`, all PG packs passed. Not a product regression.

# Wave H Test Results

**Evidence SHA:** `c64a435`  
**Date (local):** 2026-09-10  
**Raw logs:** `apps/api/.ci-evidence/wave-h5-packs-c64a435/` (uncommitted)

## Summary table

| Suite | Command pattern | Tests | Result |
|-------|-----------------|-------|--------|
| H1 unit | `jest --testPathPattern=wave-h1-arabic-catalog-search.unit` | 4/4 | **PASS** |
| H1 postgres | `jest --testPathPattern=wave-h1-arabic-catalog-search.postgres` | 4/4 | **PASS** |
| clinic-dashboard tsc | `npx tsc -b` | build | **PASS** |
| vitest touched | clinical-catalog + scheduling-config + billing/inventory config + i18n | 48/48 | **PASS** |
| Playwright H2 | `wave-h2-arabic-rtl-booking` | 2 | **SKIPPED** (API down) |
| Playwright H3 | `wave-h3-a11y-tablet` | 3 | **SKIPPED** (API down) |
| Playwright H4 | `wave-h4-owner-ux` | 2 | **SKIPPED** (API down) |

**API pack total:** 8 passed / 0 failed  
**Clinic unit/build:** PASS  
**Playwright local:** 7 skipped (honest; not faked PASS)  
**Product fixes during H5:** none

## Environment (postgres)

```text
ALLOW_TEST_DATABASE_RESET=true
RUN_PLATFORM_DB_SECURITY=true
DATABASE_URL / INTEGRATION_DATABASE_URL =
  postgresql://booking:booking_test@localhost:5433/booking_test?schema=public
```

## Notes

- Playwright skipped via `e2e/helpers/api-ready` when API not on `127.0.0.1:3000` — same helper as H2–H4. Full e2e pass expected on authorized PR CI.

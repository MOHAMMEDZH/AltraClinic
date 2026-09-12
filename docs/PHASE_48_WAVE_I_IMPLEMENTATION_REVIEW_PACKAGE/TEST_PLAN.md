# Wave I Test Plan

## Environment

- Real Postgres test DB: `postgresql://booking:booking_test@localhost:5433/booking_test`
- `ALLOW_TEST_DATABASE_RESET=true`
- `RUN_PLATFORM_DB_SECURITY=true` (where packs require it)
- Fail-closed: pg skip / 0 Jest passed / Playwright API-down skip = **FAIL**

## Commands

```bash
cd apps/api

# I5 regression baselines (Step 28 then Step 29)
npm run test:phase48-regression-baselines

# I5 Phase 48 onepass (P0 + P1 API + combined-traceability + migration-clean + migration-upgrade)
npm run test:phase48-onepass

# Optional: include clinic-dashboard I1 e2e scripts (API + webServer required)
npm run test:phase48-onepass:with-e2e

# Or run e2e separately (same I1 scripts)
cd ../clinic-dashboard
npm run test:phase48-p1-arabic-rtl-e2e
npm run test:phase48-p1-accessibility-tablet
npm run test:phase48-owner-ux
```

## Pack coverage

| Layer | Packs |
|-------|-------|
| P0 | catalog, snapshot-pricing, concurrency, eligibility, consent, injectable, plan-link, inventory-accountability |
| P1 API | operatory, course, device, derm, lab, pre-post-care, waitlist, availability, recall, commission, arabic-rtl |
| Cross | combined-traceability (R4-TRACE) |
| Migrations | clean A–G; upgrade A–G; H ABSENT |
| Regression | Step 28 security onepass; Step 29 release onepass |
| E2E | arabic-rtl-e2e, accessibility-tablet, owner-ux |

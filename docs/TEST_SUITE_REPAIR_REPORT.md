# Test Suite Repair Report

**Date:** 2026-07-11  
**Scope:** Critical blocker C6 — green backend + frontend unit tests

## Final status

| Suite | Before | After |
|-------|--------|-------|
| API Jest (`apps/api`) | 18 failed / 195 total | **195 passed** (unit) + **4 integration** (RLS) |
| Frontend Vitest (`apps/clinic-dashboard`) | 1 failed / 76 files | **76 passed / 266 tests** |

## Root causes fixed

1. **Stale Vitest imports** in 8 API specs → converted to Jest
2. **Incomplete `User.restore` mocks** — added `test-support/user-test.factory.ts` with full `UserProps`
3. **Wrong import paths** for `TenantPolicyService` (`../../settings/...`)
4. **TypeScript compile errors** in production code:
   - `dashboard.entity.ts` / `analytics-report.entity.ts` readonly rehydrate
   - `prisma-workflow.repository.ts` missing `FAILED`/`PAUSED` statuses
   - `prisma-notification.repository.ts` missing `DRAFT` status
   - `billing-financial.service.ts` invalid UUID `contains` filter
   - `prisma-patient.repository.ts` `line2` / `customerId` fixes
   - `settings.service.ts` `Prisma.InputJsonValue` cast
5. **Test mock gaps:** `getRootClient`, `TenantExecutionService`, `inventoryBatch`, Prisma invoice mocks
6. **Guard spec drift:** analytics/workflow permission guards expect `UnauthorizedException` / tenant headers

## Integration test harness

| File | Purpose |
|------|---------|
| `jest.integration.config.cjs` | Isolated integration runner |
| `tenant-isolation.postgres.integration.spec.ts` | Real PostgreSQL RLS proofs |
| `docker/postgres-test-init/01-app-role.sql` | `booking_app` role (NOBYPASSRLS) |

Run:

```bash
docker compose -f docker-compose.test.yml up -d
cd apps/api
DATABASE_URL=postgresql://booking:booking_test@localhost:5433/booking_test npx prisma migrate deploy
# apply RLS (psql or docker pipe)
INTEGRATION_DATABASE_URL=postgresql://booking_app:booking_app@localhost:5433/booking_test npm run test:integration
```

## CI structure recommendation

- **Unit:** `npm test` in `apps/api` and `apps/clinic-dashboard` on every PR
- **Integration:** `npm run test:integration` on merge queue with Docker PostgreSQL service
- Exclude `*.postgres.integration.spec.ts` from default Jest via `testPathIgnorePatterns`

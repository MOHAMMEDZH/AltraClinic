# Migration Baseline Guide

## Overview

Production deployments must use **Prisma Migrate** (`migrate deploy`), not `db push`. The baseline migration reproduces the full schema from an empty PostgreSQL database.

## Baseline migration

| Item | Value |
|------|-------|
| Migration | `apps/api/prisma/migrations/20260709000000_baseline/migration.sql` |
| Generated | `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` |
| Tables | Full schema including `analytics_metrics` |

The former incremental-only migration (`20260711000000_analytics_metrics`) was **removed** — analytics is included in the baseline.

## Fresh database workflow

```bash
cd apps/api
export DATABASE_URL=postgresql://user:pass@host:5432/booking

npx prisma migrate deploy
npm run db:triggers:apply   # if triggers are used
npm run db:rls:apply        # requires psql on PATH
npm run db:seed             # non-production only
```

## Verification (2026-07-11)

```powershell
docker compose -f docker-compose.test.yml up -d
$env:DATABASE_URL="postgresql://booking:booking_test@localhost:5433/booking_test"
cd apps/api
npx prisma migrate deploy
# Result: 1 migration applied (20260709000000_baseline)
npx prisma migrate status
# Result: Database schema is up to date!
```

## Regenerating baseline (schema-breaking changes only)

1. Create a **new incremental** migration for production (`prisma migrate dev --name descriptive_name`).
2. Do **not** regenerate baseline on live systems that already applied it.
3. For greenfield environments only, regenerate with `migrate diff --from-empty` and replace baseline after team review.

## CI recommendation

- Job 1: spin up PostgreSQL → `migrate deploy` → assert exit 0
- Job 2: `npm run test:integration` with `INTEGRATION_DATABASE_URL` pointing at migrated DB with RLS applied

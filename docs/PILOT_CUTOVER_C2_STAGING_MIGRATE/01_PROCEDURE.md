# C2 — Procedure

Working directory: `apps/api` unless noted.  
Reuse: [`PRODUCTION_MIGRATION_WORKFLOW.md`](../PRODUCTION_MIGRATION_WORKFLOW.md), C1 templates, `npm run test:phase49-tenant-isolation-check`.

---

## 0. Target selection

| Class | When | Honesty |
|-------|------|---------|
| Real staging/pilot Postgres | CTO/ops provisioned out-of-band | Full C2 for “staging” |
| Local disposable Docker | No staging host | **PARTIAL** — prove role model only; staging remains **EXTERNAL** |

This run used **local disposable** (`booking-system-pg-test` / new DB `pilot_c2`).

---

## 1. Apply substituted C1 SQL (out-of-band)

1. Copy [`02_CREATE_PROD_DB_ROLES.sql.template`](../PILOT_CUTOVER_C1_DB_ROLES/02_CREATE_PROD_DB_ROLES.sql.template) to a **non-committed** working file.
2. Substitute placeholders (never commit filled file / passwords).
3. As instance admin: create DB + roles + schema grants.
4. After first migrate as migrate-admin, apply post-migrate runtime grants: [`06_POST_MIGRATE_RUNTIME_GRANTS.sql.template`](../PILOT_CUTOVER_C1_DB_ROLES/06_POST_MIGRATE_RUNTIME_GRANTS.sql.template).

---

## 2. Verify roles

Run [`03_VERIFY_QUERIES.sql`](../PILOT_CUTOVER_C1_DB_ROLES/03_VERIFY_QUERIES.sql) (substituted).  
**Must show** `{{RUNTIME_ROLE}}.rolbypassrls = false`.

---

## 3. Migrate + RLS + triggers (migrate-admin URL)

```bash
# migrate-admin only
export DATABASE_URL='postgresql://{{MIGRATE_ROLE}}:…@host:port/{{DB_NAME}}?schema=public'
npm run db:migrate:deploy
npm run db:rls:apply      # requires host `psql` OR equivalent: pipe prisma/rls-policies.sql via docker exec as migrate role
npm run db:triggers:apply # same; see note below
```

**Host note (this run):** Windows host had no `psql` on PATH — applied `prisma/rls-policies.sql` / `prisma/triggers.sql` via `docker exec … psql -U {{MIGRATE_ROLE}}` (same SQL as npm scripts).

**Triggers note:** `prisma/triggers.sql` ends with bare `RAISE NOTICE …` which fails under `ON_ERROR_STOP=1`. Strip that line or wrap in `DO $$ … $$` before apply (C1 additive note). Do **not** silence real trigger DDL failures.

---

## 4. Runtime-app URL for API-style checks

Point clinic RLS app connection at **runtime-app** (NOBYPASSRLS):

```text
INTEGRATION_ADMIN_DATABASE_URL=<migrate-admin URL>   # fixture / bypass setup
INTEGRATION_DATABASE_URL=<runtime-app URL>           # assertions under RLS
```

---

## 5. Isolation check

**Preferred (C1 roles on migrated target):**

```bash
npx jest --config jest.integration.config.cjs --runInBand --forceExit \
  --testPathPattern "tenant-isolation.postgres.integration.spec"
```

**Named packaging wrapper** (standard `booking_test` / `booking_app` harness — complementary):

```bash
npm run test:phase49-tenant-isolation-check
```

Do **not** weaken assertions. If fixtures missing → **FAIL/PARTIAL** with reason.

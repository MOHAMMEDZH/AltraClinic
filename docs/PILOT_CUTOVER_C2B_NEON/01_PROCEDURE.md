# C2b — Procedure (Neon)

**Precondition:** Human-rotated Neon owner password; gitignored / session `PILOT_OWNER_DATABASE_URL` = **direct (non-pooler)** URL for `neondb`.  
Do not paste secrets into tickets, commits, or chat when avoidable.

Reuse: C1 templates, [`PRODUCTION_MIGRATION_WORKFLOW.md`](../PRODUCTION_MIGRATION_WORKFLOW.md), C2 procedure patterns.

---

## Steps

1. **Substitute C1 SQL out-of-band** (never commit filled file). Create migrate-admin + runtime-app (`NOBYPASSRLS`) on Neon `neondb`.
2. **Verify** [`03_VERIFY_QUERIES.sql`](../PILOT_CUTOVER_C1_DB_ROLES/03_VERIFY_QUERIES.sql) — runtime `rolbypassrls=false`.
3. **Migrate as migrate-admin:**
   ```bash
   export DATABASE_URL='<migrate-admin direct URL>'
   npm run db:migrate:deploy
   ```
4. **RLS / triggers as migrate-admin** (`prisma/rls-policies.sql`, `prisma/triggers.sql`). Host may use `docker run postgres:16-alpine psql "$DATABASE_URL" …` when local `psql` is missing. Strip bare trailing `RAISE NOTICE` on triggers under `ON_ERROR_STOP=1`.
5. **Post-migrate runtime grants** — [`06_POST_MIGRATE_RUNTIME_GRANTS.sql.template`](../PILOT_CUTOVER_C1_DB_ROLES/06_POST_MIGRATE_RUNTIME_GRANTS.sql.template).  
   **Neon note:** `ALTER DEFAULT PRIVILEGES FOR ROLE <migrate>` as owner may be denied; set default privileges **while connected as migrate**, and/or explicit post-migrate `GRANT`s.
6. **Isolation on runtime-app URL** (do not weaken):
   ```bash
   INTEGRATION_ADMIN_DATABASE_URL=<migrate-admin>
   INTEGRATION_DATABASE_URL=<runtime-app>
   npx jest --config jest.integration.config.cjs --runInBand --forceExit \
     --testPathPattern "tenant-isolation.postgres.integration.spec"
   ```
7. Do **not** run `ALLOW_TEST_DATABASE_RESET` / full Platform DB reset harness against Neon pilot (would wipe). Local `booking_test` K6 remains complementary only (C2).

```text
Neon branch label "production" ≠ product production cutover
```

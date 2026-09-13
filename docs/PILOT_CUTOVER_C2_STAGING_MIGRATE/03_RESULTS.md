# C2 — Results

| Field | Value |
|-------|--------|
| Date (UTC) | 2026-09-13 |
| HEAD at run | `54d9983` |
| Target | Local disposable Postgres `:5433` — DB `pilot_c2`; roles `pilot_c2_migrate` / `pilot_c2_app` |
| Real staging host | **NOT AVAILABLE** → overall **PARTIAL** |

## Results table

| # | Step | Result | Evidence |
|---|------|--------|----------|
| 1 | Create DB + C1 roles (out-of-band; uncommitted) | **PASS** | `01_create_db_roles.txt`, `01b_schema_grants.txt` |
| 2 | Verify `rolbypassrls=false` (pre/post) | **PASS** | `02_verify_roles_pre_migrate.txt`, `02_verify_roles_post.txt` |
| 3 | `prisma migrate deploy` as migrate-admin | **PASS** (63 migrations) | `03_migrate_deploy.txt` |
| 4 | RLS apply as migrate-admin (`rls-policies.sql`) | **PASS** (765 policies; 186 FORCE RLS tables) | `04_rls_apply.txt` |
| 5 | Triggers apply as migrate-admin | **PASS** (after stripping trailing bare `RAISE NOTICE`) | `05_triggers_apply.txt`, `05_triggers_apply_retry.txt` |
| 6 | Post-migrate runtime table grants | **PASS** | `01c_runtime_grants_post_migrate.txt` |
| 7 | `tenant-isolation.postgres.integration` on **C1 roles** / `pilot_c2` | **PASS** (4/4) | `06_tenant_isolation_c1_roles.txt` |
| 8 | `npm run test:phase49-tenant-isolation-check` on `booking_test` | **PASS** (ALL STEPS) | `07_phase49_tenant_isolation_check_booking_test.txt` |
| — | Real staging/pilot cloud Postgres | **SKIP / EXTERNAL** | No provisioned host |

```text
Overall C2 = PARTIAL
  local disposable migrate→RLS→triggers→C1-role isolation = PASS
  named K6 wrapper on booking_test = PASS
  real staging = EXTERNAL (not claimed)
Production cutover = NO
```

**Evidence dir (uncommitted):** `apps/api/.ci-evidence/pilot-c2-54d9983/`

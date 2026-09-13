# C2b — Results

| Field | Value |
|-------|--------|
| Date (UTC) | 2026-09-13 |
| HEAD at run | `224229e` |
| Target | Neon `neondb` @ `ep-raspy-silence-b29gwkc6.c-6.eu-central-1.aws.neon.tech` (Frankfurt) |
| Neon branch label | `production` (**≠ product production**) |
| Roles | `pilot_neon_migrate` / `pilot_neon_app` |

## Results table

| # | Step | Result | Evidence |
|---|------|--------|----------|
| 1 | Apply C1 roles out-of-band | **PASS** | `01_create_roles.txt` |
| 2 | Verify `rolbypassrls=false` | **PASS** | `02_verify_roles_pre.txt`, `02_verify_roles_post.txt` |
| 3 | `db:migrate:deploy` as migrate-admin | **PASS** | `03_migrate_deploy.txt` |
| 4 | RLS apply as migrate-admin | **PASS** (765 policies / 186 FORCE) | `04_rls_apply.txt` |
| 5 | Triggers apply as migrate-admin | **PASS** | `05_triggers_apply.txt` |
| 6 | Post-migrate runtime grants | **PASS** | `01c_runtime_grants.txt` |
| 7 | `tenant-isolation.postgres.integration` on runtime-app | **PASS** (4/4) | `06_tenant_isolation_neon.txt` |
| 8 | Full `test:phase49-tenant-isolation-check` on Neon | **SKIP** | Avoid reset/wipe; C2 local wrapper remains complementary |

```text
Overall C2b = PASS
Product production cutover = NO
Neon branch "production" ≠ product production
```

**Evidence dir (uncommitted):** `apps/api/.ci-evidence/pilot-c2b-224229e/`

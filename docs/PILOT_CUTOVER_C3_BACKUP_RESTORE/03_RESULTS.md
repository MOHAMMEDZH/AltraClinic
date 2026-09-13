# C3 — Results

| Field | Value |
|-------|--------|
| Date (UTC) | 2026-09-13 |
| HEAD at run | `b7bbf3a` |
| Source | Neon `neondb` @ Frankfurt; dump via **migrate-admin** (`pilot_neon_migrate`) |
| Owner URL in shell | Not found after rotation (migrate-admin used as authorized alternative) |
| Dump client | `postgres:18-alpine` (`pg_dump` 16 rejected server 18.6) |

## Results table

| # | Step | Result | Evidence |
|---|------|--------|----------|
| 1 | Full-data `pg_dump` as migrate-admin | **FAIL/blocked** (FORCE RLS / `COPY`) | `01_backup.txt` (first attempts) |
| 2 | Schema-only dump `--no-owner --no-acl` + sha256 + gzip -t | **PASS** | `01b_backup_noacl.txt`, `backups/booking-system-20260913t171723z-schema-noacl.sql.gz` |
| 3 | Verify checksum + gzip | **PASS** | `02_verify.txt` |
| 4 | Restore to disposable PG18 container `pilot-c3-restore-pg` | **PASS** | `04_restore.txt` |
| 5 | Smoke: 257 public tables; `tenants` present | **PASS** | `02_verify.txt` / restore smoke |
| 6 | Source roles `rolbypassrls=false` | **PASS** | `05_source_roles.txt` |
| 7 | Neon primary wiped | **NO** | — |
| 8 | Offsite / PITR | **EXTERNAL** / not claimed | — |

```text
Overall C3 = PARTIAL
  schema backup→verify→disposable restore = PASS
  full-data dump = blocked without owner/BYPASS-capable dump role
Product production cutover = NO
Offsite/PITR = EXTERNAL
```

**Evidence dir (uncommitted):** `apps/api/.ci-evidence/pilot-c3-b7bbf3a/`

# Pilot Cutover C3b / STOP S1 — Full-data backup restore

| Field | Value |
|-------|--------|
| **Result** | **PASS** |
| **Evidence** | `apps/api/.ci-evidence/pilot-c3b-s1-20260913t182037z/` (uncommitted) |
| **Source** | Neon `altraclinic-pilot` / `neondb` via local gitignored owner URL |
| **Dump** | Full-data `pg_dump --no-owner` (PG18 docker client) · ~95 KB · **257** `COPY` statements |
| **Verify** | `gzip -t` + sha256 **OK** |
| **Restore** | Disposable `postgres:18-alpine` container · stub roles for ACL refs · **257** public tables · `tenants` present |
| **Neon primary wiped** | **NO** |
| **Offsite / PITR** | **EXTERNAL** (not claimed) |

## Explicit

```text
STOP S1 full-data backup = PASS (this drill)
Product production cutover = NOT CLAIMED
Secrets not committed = YES
```

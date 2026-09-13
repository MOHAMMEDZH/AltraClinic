# C3 — Procedure

**SSOT reuse:** [`PHASE_49_K3_BACKUP_RESTORE/02_RESTORE_DRILL_PROCEDURE.md`](../PHASE_49_K3_BACKUP_RESTORE/02_RESTORE_DRILL_PROCEDURE.md) · `apps/api/scripts/backup-postgres.*` · `verify-backup.sh` · `restore-postgres.sh`

## Preconditions

- Rotated Neon credentials; **do not** use chat-leaked passwords
- Source URL: gitignored **owner** (preferred for full-data) **or** migrate-admin (authorized)
- Direct / non-pooler preferred for dump
- Dump client major version must match Neon (this pilot: **Postgres 18**)
- Restore target = **disposable** only — never the only working Neon primary

## Steps

1. **Backup** from Neon source (`pg_dump` → `.sql.gz` + SHA256), equivalent to `backup-postgres.ps1/.sh` (Windows often uses `docker run postgres:18-alpine` when host `pg_dump` missing / version skew).
2. **Verify** checksum + `gzip -t` (equivalent to `verify-backup.sh`).
3. **Restore** into disposable DB:
   - Preferred here: disposable `postgres:18-alpine` container (Neon is PG18; local `booking-system-pg-test` is PG16 and rejects Neon dump GUCs such as `transaction_timeout`).
   - Or Neon child branch created for drill (document; do not wipe primary).
4. **Smoke:** public table count > 0; `tenants` present if schema includes it.
5. **Source sanity:** confirm runtime/migrate roles still `rolbypassrls=false` on Neon source.
6. Stop/remove disposable restore container (or document kept child branch).

## Full-data vs schema-only

| Mode | When |
|------|------|
| **Full-data** | Dump role must not be blocked by **FORCE RLS** (owner / BYPASSRLS dump window) |
| **Schema-only** (`--schema-only --no-owner --no-acl`) | Honest **PARTIAL** when migrate-admin is NOBYPASSRLS and FORCE RLS blocks `COPY` — same class of honesty as K3 Path B fixture limits |

```text
Neon primary wipe = NOT AUTHORIZED without explicit CTO approve
Offsite / PITR = EXTERNAL
```

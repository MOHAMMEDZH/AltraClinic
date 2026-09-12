# K3 — Thin Restore Drill Procedure

## Goal

Prove ops backup → verify → restore → smoke on a **disposable** Postgres of the same class as CI test DB (`docker-compose.test.yml` / `booking-system-pg-test`).

## Preconditions

- Docker test Postgres up: `docker compose -f docker-compose.test.yml up -d`
- Source DB has schema (e.g. `booking_test` after migrate) — disposable test data only
- Restore target is a **new** database name (never overwrite shared prod / shared teammate DB)

## Path A — Native tools (Linux/macOS / ops hosts)

```bash
cd apps/api
export DATABASE_URL='postgresql://booking:booking_test@127.0.0.1:5433/booking_test?schema=public'
# 1) Backup
bash scripts/backup-postgres.sh
# 2) Verify (use newest booking-system-*.sql.gz)
bash scripts/verify-backup.sh backups/postgres/booking-system-<TIMESTAMP>.sql.gz
# 3) Create disposable restore DB (example via psql to postgres db)
psql 'postgresql://booking:booking_test@127.0.0.1:5433/postgres' \
  -c "DROP DATABASE IF EXISTS booking_restore_k3_drill;" \
  -c "CREATE DATABASE booking_restore_k3_drill;"
# 4) Restore
bash scripts/restore-postgres.sh backups/postgres/booking-system-<TIMESTAMP>.sql.gz \
  'postgresql://booking:booking_test@127.0.0.1:5433/booking_restore_k3_drill'
# 5) Smoke
psql 'postgresql://booking:booking_test@127.0.0.1:5433/booking_restore_k3_drill' \
  -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
# 6) Cleanup
psql 'postgresql://booking:booking_test@127.0.0.1:5433/postgres' \
  -c "DROP DATABASE IF EXISTS booking_restore_k3_drill;"
```

## Path B — Windows without pg_dump on PATH (documented helper)

When native `pg_dump`/`psql`/`gzip` are missing (common on Windows agent hosts), use the thin Docker helper that shells into `booking-system-pg-test` — **same pg_dump/psql/gzip semantics**, not a new backup engine:

```powershell
cd apps/api
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/phase49-k3-restore-drill.ps1
```

Path B defaults to **`--schema-only` dump** for the thin tooling drill because the long-lived local `booking_test` fixture currently contains orphan FK rows (`commission_package_session_allocations` → missing `invoice_line_items`) that fail a full-data `ON_ERROR_STOP` restore. That is **fixture debt**, not a replacement for production full dumps.

| Setting | Default |
|---------|---------|
| Container | `booking-system-pg-test` |
| Source DB | `booking_test` |
| Restore DB | `booking_restore_k3_<utc>` (created then dropped) |
| Dump mode | schema-only (thin drill) |
| Artifact dir | `apps/api/backups/postgres/` + evidence under `.ci-evidence/phase49-k3-<sha>/` |
| Helper scripts | `phase49-k3-restore-drill.ps1` + `phase49-k3-restore-in-container.sh` |

## Pass criteria

| Check | Required |
|-------|----------|
| Backup `.sql.gz` written | YES |
| Checksum verify + gzip test | YES |
| Restore into **new** DB with `ON_ERROR_STOP` | YES |
| Smoke: public table count > 0 (or `tenants` if present) | YES |
| Restore DB dropped after drill | YES (unless `--KeepRestoreDb`) |
| No restore into production / shared non-disposable URL | YES |

**Disposable fixture note:** Path B uses **schema-only** dumps for the thin drill because full-data restore of the long-lived `booking_test` fixture fails on orphan FK rows. Production cutover restores use `restore-postgres.sh` against **full** dumps from healthy ops databases.

## Fail criteria

- Checksum mismatch, gzip corrupt, restore errors, empty schema after restore, or accidental target of non-disposable DB.

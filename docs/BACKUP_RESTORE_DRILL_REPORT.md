# Backup / Restore Drill Report

**Date:** 2026-07-11  
**Environment:** Docker `booking-system-pg-test` (PostgreSQL 16)  
**Script:** `apps/api/scripts/backup-postgres.sh` (concept validated via `pg_dump`/`psql`)

## Procedure executed

1. Started test PostgreSQL: `docker compose -f docker-compose.test.yml up -d`
2. Applied baseline migration + RLS policies
3. **Backup:** `pg_dump -U booking booking_test --no-owner --format=plain`
4. **Restore:** created `booking_restore_test`, replayed dump via `psql`
5. **Integrity check:** `SELECT COUNT(*) FROM tenants` on restored DB

## Results

| Step | Result |
|------|--------|
| Backup file written | ✅ `apps/api/backups/postgres/booking-system-<timestamp>.sql` (~531 KB) |
| Restore to new database | ✅ Completed without `ON_ERROR_STOP` errors |
| Schema present on restore DB | ✅ Verified (`tenants` table query succeeded) |
| Native `pg_dump` on Windows PATH | ⚠️ Not available — drill used Docker exec |

## Production notes

- Set `DATABASE_URL` before running `scripts/backup-postgres.sh`
- Schedule via cron / Task Scheduler; default retention 30 days
- Store checksum sidecar (`.sha256`) off-host
- Restore drill should be repeated quarterly; document RTO/RPO in `docs/DISASTER_RECOVERY.md`

## Gaps

- Windows hosts without Docker require PostgreSQL client tools on PATH for native script execution
- Point-in-time recovery (WAL archiving) not covered in this drill

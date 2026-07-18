#!/usr/bin/env bash
# PostgreSQL backup script — run on a schedule via cron / Task Scheduler.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"

mkdir -p "$BACKUP_DIR"
OUT_FILE="$BACKUP_DIR/booking-system-$TIMESTAMP.sql.gz"

echo "[backup] Writing $OUT_FILE"
pg_dump "$DATABASE_URL" --no-owner --format=plain | gzip -9 > "$OUT_FILE"

sha256sum "$OUT_FILE" > "$OUT_FILE.sha256"
echo "[backup] Checksum written"

find "$BACKUP_DIR" -name 'booking-system-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "[backup] Retention applied ($RETENTION_DAYS days)"

echo "[backup] Complete"

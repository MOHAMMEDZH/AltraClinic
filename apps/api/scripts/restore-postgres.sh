#!/usr/bin/env bash
# Restore PostgreSQL from a gzipped pg_dump produced by backup-postgres.sh
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup.sql.gz> [target_database_url]"
  exit 1
fi

BACKUP_FILE="$1"
DATABASE_URL="${2:-${DATABASE_URL:?DATABASE_URL or second argument required}}"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

SHA_FILE="${BACKUP_FILE}.sha256"
if [[ -f "$SHA_FILE" ]]; then
  echo "[restore] Verifying checksum"
  sha256sum -c "$SHA_FILE"
fi

echo "[restore] Restoring from $BACKUP_FILE"
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" --set ON_ERROR_STOP=1
echo "[restore] Complete"

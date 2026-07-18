#!/usr/bin/env bash
# Verify backup integrity (checksum + gzip test)
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
SHA_FILE="${BACKUP_FILE}.sha256"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Missing backup: $BACKUP_FILE"
  exit 1
fi

if [[ -f "$SHA_FILE" ]]; then
  sha256sum -c "$SHA_FILE"
else
  echo "Warning: no checksum file at $SHA_FILE"
fi

gzip -t "$BACKUP_FILE"
echo "[verify] Backup archive is valid"

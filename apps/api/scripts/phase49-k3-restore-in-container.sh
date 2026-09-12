#!/bin/bash
# Phase 49 K3 — disposable restore helper (inside pg container). Not a new backup engine.
set -euo pipefail
USER_NAME="${1:?user}"
RESTORE_DB="${2:?restore db}"
DUMP_GZ="${3:?dump.gz}"

psql -U "$USER_NAME" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${RESTORE_DB};"
psql -U "$USER_NAME" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${RESTORE_DB};"

gunzip -c "$DUMP_GZ" | psql -U "$USER_NAME" -d "$RESTORE_DB" -v ON_ERROR_STOP=1

COUNT="$(psql -U "$USER_NAME" -d "$RESTORE_DB" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")"
echo "SMOKE_PUBLIC_TABLES=${COUNT}"
if [[ "${COUNT}" -le 0 ]]; then
  echo "SMOKE_FAIL"
  exit 1
fi
echo "RESTORE_OK"

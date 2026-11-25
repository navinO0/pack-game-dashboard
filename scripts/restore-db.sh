#!/usr/bin/env bash
set -euo pipefail

# SQLite restore script for PackScore Pro
# Usage: ./scripts/restore-db.sh ./backups/packscore_YYYYMMDD_HHMMSS.db

DB_PATH="${SQLITE_DB_PATH:-./prisma/pack_score_calc.db}"

if [ $# -lt 1 ] || [ ! -f "$1" ]; then
  echo "Usage: $0 <path-to-backup.db>" >&2
  exit 1
fi

BACKUP_FILE="$1"
echo "WARNING: Restoring ${BACKUP_FILE} -> ${DB_PATH}..."
cp "${BACKUP_FILE}" "${DB_PATH}"
echo "Restore complete."

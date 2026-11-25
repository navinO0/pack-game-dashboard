#!/usr/bin/env bash
set -euo pipefail

# SQLite automated backup script for PackScore Pro
# Usage: ./scripts/backup-db.sh

DB_PATH="${SQLITE_DB_PATH:-./prisma/pack_score_calc.db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +"%Y%m%d_%H%M%S")"
OUT_FILE="${BACKUP_DIR}/packscore_${TIMESTAMP}.db"

if [ ! -f "${DB_PATH}" ]; then
  echo "ERROR: SQLite database not found at ${DB_PATH}" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting SQLite backup -> ${OUT_FILE}"
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "${DB_PATH}" ".backup '${OUT_FILE}'"
else
  cp "${DB_PATH}" "${OUT_FILE}"
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup completed ($(du -h "${OUT_FILE}" | cut -f1))."

find "${BACKUP_DIR}" -type f -name "packscore_*.db" -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Pruned backups older than ${RETENTION_DAYS} days."

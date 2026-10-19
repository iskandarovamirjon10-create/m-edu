#!/usr/bin/env bash
# ==============================================================================
# M-EDU Database Backup Script
# Usage: ./scripts/backup-db.sh [backup_dir]
# Creates compressed PostgreSQL backup and retains the last 14 days of backups.
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/medu_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=14

mkdir -p "${BACKUP_DIR}"

echo "[M-EDU] Starting database backup at $(date)..."

# Detect whether running via Docker Compose or native PostgreSQL
if docker compose ps db >/dev/null 2>&1; then
  echo "[M-EDU] Backing up via Docker Compose..."
  docker compose exec -T db sh -c 'pg_dump -U "${POSTGRES_USER:-medu}" "${POSTGRES_DB:-medu}"' | gzip > "${BACKUP_FILE}"
elif command -v pg_dump >/dev/null 2>&1; then
  echo "[M-EDU] Backing up via local pg_dump..."
  pg_dump -U "${POSTGRES_USER:-medu}" -d "${POSTGRES_DB:-medu}" | gzip > "${BACKUP_FILE}"
else
  echo "[M-EDU ERROR] Neither docker compose nor pg_dump was found." >&2
  exit 1
fi

FILESIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[M-EDU SUCCESS] Backup saved: ${BACKUP_FILE} (${FILESIZE})"

# Prune old backups older than RETENTION_DAYS
echo "[M-EDU] Cleaning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "medu_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -delete || true

echo "[M-EDU] Backup routine completed."

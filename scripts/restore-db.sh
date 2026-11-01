#!/usr/bin/env bash
# ==============================================================================
# M-EDU Database Disaster Recovery Restore Script
# Usage: ./scripts/restore-db.sh <backup_file.sql.gz>
# Restores compressed PostgreSQL backup into the designated database safely.
# ==============================================================================

set -euo pipefail

BACKUP_FILE="${1:-}"

if [[ -z "${BACKUP_FILE}" || ! -f "${BACKUP_FILE}" ]]; then
  echo "[M-EDU ERROR] Usage: $0 <path_to_backup_file.sql.gz>" >&2
  exit 1
fi

echo "[M-EDU] Verifying archive integrity for: ${BACKUP_FILE}..."
gzip -t "${BACKUP_FILE}"
echo "[M-EDU] Archive integrity verified (CRC valid)."

echo "[M-EDU CAUTION] You are about to restore into PostgreSQL database '${POSTGRES_DB:-medu}'."
read -p "Type 'RESTORE' to confirm: " -r CONFIRM
if [[ "${CONFIRM}" != "RESTORE" ]]; then
  echo "[M-EDU] Aborted by user."
  exit 0
fi

if docker compose ps db >/dev/null 2>&1; then
  echo "[M-EDU] Restoring via Docker Compose..."
  gunzip -c "${BACKUP_FILE}" | docker compose exec -T db sh -c 'psql -U "${POSTGRES_USER:-medu}" -d "${POSTGRES_DB:-medu}"'
elif command -v psql >/dev/null 2>&1; then
  echo "[M-EDU] Restoring via local psql..."
  gunzip -c "${BACKUP_FILE}" | psql -U "${POSTGRES_USER:-medu}" -d "${POSTGRES_DB:-medu}"
else
  echo "[M-EDU ERROR] Neither docker compose nor psql was found on PATH." >&2
  exit 1
fi

echo "[M-EDU SUCCESS] Database restored successfully from ${BACKUP_FILE}."

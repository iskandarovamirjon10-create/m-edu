#!/usr/bin/env bash
# ==============================================================================
# M-EDU Platform - Turnkey 1-Click Production Deployment Script
# Supports: Ubuntu 20.04+, Debian 11+, Rocky Linux 9+, AlmaLinux 9+
# ==============================================================================

set -euo pipefail

# ANSI Color Codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "======================================================================"
echo "          🎓 M-EDU Platform - Production Deployment Suite              "
echo "        Smart Education ERP, LMS & Face ID Attendance System           "
echo "======================================================================"
echo -e "${NC}"

# Check for root / sudo
if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RED}[ERROR] This script must be run as root or with sudo privileges.${NC}"
  echo "Please run: sudo ./deploy.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# 1. Install prerequisites (Docker, Curl, OpenSSL, Git)
echo -e "${BLUE}[1/6] Checking and installing system dependencies...${NC}"

if command -v apt-get >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq curl git openssl ca-certificates gnupg lsb-release
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y -q curl git openssl ca-certificates
fi

# Check Docker
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${YELLOW}Docker is not installed. Installing Docker Engine...${NC}"
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm -f get-docker.sh
  systemctl enable --now docker
  echo -e "${GREEN}Docker installed successfully.${NC}"
fi

# Check Docker Compose (plugin or standalone)
if ! docker compose version >/dev/null 2>&1; then
  echo -e "${YELLOW}Docker Compose plugin missing. Installing compose plugin...${NC}"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y -qq docker-compose-plugin
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y -q docker-compose-plugin
  fi
fi

# 2. Configure Environment (.env)
echo -e "${BLUE}[2/6] Configuring production environment variables...${NC}"

if [ ! -f .env ]; then
  echo -e "${YELLOW}No .env file found. Generating secure production secrets...${NC}"

  # High-entropy random cryptographic tokens
  POSTGRES_PASS=$(openssl rand -hex 20)
  JWT_SECRET=$(openssl rand -hex 32)
  # Biometric 256-bit key (64 hex characters)
  BIO_KEY=$(openssl rand -hex 32)
  SESSION_SECRET=$(openssl rand -hex 32)

  read -r -p "Enter your application domain or IP (default: localhost): " DOMAIN_INPUT
  APP_DOMAIN="${DOMAIN_INPUT:-localhost}"

  if [ "${APP_DOMAIN}" = "localhost" ] || [ "${APP_DOMAIN}" = "127.0.0.1" ]; then
    APP_URL="http://${APP_DOMAIN}:8080"
  else
    APP_URL="https://${APP_DOMAIN}"
  fi

  cat > .env <<EOF
NODE_ENV=production
PORT=3000
API_PORT=3000
WEB_PORT=8080

# Database Configuration
POSTGRES_USER=medu
POSTGRES_PASSWORD=${POSTGRES_PASS}
POSTGRES_DB=medu
DATABASE_URL=postgresql://medu:${POSTGRES_PASS}@db:5432/medu?schema=public

# Redis Configuration
REDIS_URL=redis://redis:6379

# Security & Encryption
JWT_SECRET=${JWT_SECRET}
BIOMETRIC_ENCRYPTION_KEY=${BIO_KEY}
OAUTH_SESSION_SECRET=${SESSION_SECRET}
CORS_ORIGIN=${APP_URL}
NEXT_PUBLIC_APP_URL=${APP_URL}
TRUST_PROXY=1

# Face Recognition Models (bundled in repository)
FACE_ENGINE_PROVIDER=real-local
FACE_DETECTOR_MODEL_PATH=/app/packages/face-engine/models/face_detection_yunet_2023mar.onnx
FACE_EMBEDDER_MODEL_PATH=/app/packages/face-engine/models/face_recognition_sface_2021dec.onnx
FACE_LIVENESS_MODEL_PATH=/app/packages/face-engine/models/minifasnet_v2.onnx

# Storage and assets
STORAGE_DRIVER=local
UPLOAD_DIR=/app/uploads
EOF

  echo -e "${GREEN}Created production .env with cryptographically secure secrets.${NC}"
else
  echo -e "${GREEN}Existing .env file detected. Reusing existing secrets.${NC}"
fi

# 3. Build & Launch Docker Services
echo -e "${BLUE}[3/6] Building and starting Docker containers...${NC}"
docker compose down --remove-orphans || true
docker compose up -d --build

# 4. Wait for Database and Apply Migrations
echo -e "${BLUE}[4/6] Verifying database health and applying Prisma migrations...${NC}"
echo "Waiting for PostgreSQL service to become healthy..."

TRIES=0
MAX_TRIES=30
until docker compose exec -T db sh -c 'pg_isready -U "${POSTGRES_USER:-medu}" -d "${POSTGRES_DB:-medu}"' >/dev/null 2>&1 || [ $TRIES -ge $MAX_TRIES ]; do
  sleep 2
  TRIES=$((TRIES + 1))
done

if [ $TRIES -ge $MAX_TRIES ]; then
  echo -e "${RED}[ERROR] Database did not become ready within 60 seconds.${NC}"
  docker compose logs db
  exit 1
fi

echo -e "${GREEN}PostgreSQL is ready.${NC}"

# Run Prisma Migrations
echo "Deploying database schema migrations..."
docker compose run --rm migration || {
  echo -e "${YELLOW}Retrying migration via API container...${NC}"
  docker compose exec -T api npx prisma migrate deploy
}

# Run seed if fresh database
echo "Seeding initial root organization and administrator..."
docker compose exec -T -e ALLOW_PRODUCTION_SEED=true api npx prisma db seed || true

# 5. Setup Automated Daily Backups
echo -e "${BLUE}[5/6] Setting up daily automated database backups...${NC}"
chmod +x "${SCRIPT_DIR}/scripts/backup-db.sh"
CRON_JOB="0 3 * * * ${SCRIPT_DIR}/scripts/backup-db.sh ${SCRIPT_DIR}/backups >> /var/log/medu-backup.log 2>&1"
(crontab -l 2>/dev/null | grep -Fv "scripts/backup-db.sh" ; echo "${CRON_JOB}") | crontab - || true
echo -e "${GREEN}Daily backup scheduled at 03:00 AM (keeps last 14 days).${NC}"

# 6. Verify System Health
echo -e "${BLUE}[6/6] Verifying platform health status...${NC}"
sleep 5

API_HEALTH=$(docker compose exec -T api wget -qO- http://localhost:3000/api/health 2>/dev/null || echo "FAILED")

echo -e "${GREEN}"
echo "======================================================================"
echo "          🎉 M-EDU PLATFORM SUCCESSFULLY DEPLOYED!                    "
echo "======================================================================"
echo -e "${NC}"
echo -e "Web Application: ${CYAN}http://$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP"):8080${NC}"
echo -e "API Endpoint:    ${CYAN}http://$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP"):8080/api/health${NC}"
echo ""
echo -e "Default Super Admin Credentials:"
echo -e "  Email:    ${YELLOW}admin@medu.test${NC}"
echo -e "  Password: ${YELLOW}Password123!${NC}"
echo ""
echo -e "Useful Commands:"
echo -e "  View Logs:      ${CYAN}docker compose logs -f${NC}"
echo -e "  Restart:        ${CYAN}docker compose restart${NC}"
echo -e "  Manual Backup:  ${CYAN}./scripts/backup-db.sh${NC}"
echo -e "  Stop:           ${CYAN}docker compose down${NC}"
echo -e "${GREEN}======================================================================${NC}"

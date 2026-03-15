#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step() { echo -e "\n${YELLOW}[$1/8]${NC} $2"; }

echo ""
echo "=============================="
echo "  BLE\$P Local Setup"
echo "=============================="

cd "$(dirname "$0")/.."
ROOT_DIR=$(pwd)
echo "Working directory: $ROOT_DIR"

# -----------------------------------------------
step 1 "Generating JWT RS256 keys..."
# -----------------------------------------------
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -outform PEM -out /tmp/blessp_private.pem 2>/dev/null
openssl pkey -in /tmp/blessp_private.pem -pubout -out /tmp/blessp_public.pem 2>/dev/null
JWT_PRIVATE=$(cat /tmp/blessp_private.pem | base64 -w0)
JWT_PUBLIC=$(cat /tmp/blessp_public.pem | base64 -w0)
rm -f /tmp/blessp_private.pem /tmp/blessp_public.pem
log "RS256 keypair generated."

# -----------------------------------------------
step 2 "Configuring environment files..."
# -----------------------------------------------

# Root .env (used by docker-compose for variable interpolation)
if [ -f .env ]; then
  warn ".env (root) already exists, overwriting with fresh keys."
fi
cat > .env <<ENVEOF
JWT_PRIVATE_KEY_BASE64=${JWT_PRIVATE}
JWT_PUBLIC_KEY_BASE64=${JWT_PUBLIC}
ENVEOF
log ".env (root) written."

# server/.env (used when running server outside Docker)
if [ -f server/.env ]; then
  warn "server/.env already exists, overwriting with fresh keys."
fi
cat > server/.env <<ENVEOF
# Database
DATABASE_URL=postgresql://blessp:blessp_dev_password@localhost:5433/blessp?schema=public

# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# JWT (RS256)
JWT_PRIVATE_KEY_BASE64=${JWT_PRIVATE}
JWT_PUBLIC_KEY_BASE64=${JWT_PUBLIC}
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Stripe
STRIPE_SECRET_KEY=sk_test_changeme
STRIPE_WEBHOOK_SECRET=whsec_changeme
STRIPE_PUBLISHABLE_KEY=pk_test_changeme

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Service info
SERVICE_NAME=blessp-api
SERVICE_VERSION=3.0.0

# OpenTelemetry
OTEL_ENABLED=false
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
ENVEOF
log "server/.env written."

# -----------------------------------------------
step 3 "Starting PostgreSQL and Redis via Docker..."
# -----------------------------------------------
echo "    Stopping any existing containers..."
docker compose -f docker-compose.dev.yml stop db redis 2>/dev/null || true

echo "    Starting db and redis..."
docker compose -f docker-compose.dev.yml up db redis -d 2>&1

echo "    Waiting for PostgreSQL..."
RETRIES=0
until docker compose -f docker-compose.dev.yml exec -T db pg_isready -U blessp -d blessp -q 2>/dev/null; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -gt 30 ]; then
    fail "PostgreSQL did not become ready in 30 seconds."
  fi
  echo -n "."
  sleep 1
done
echo ""
log "PostgreSQL ready on port 5433."

echo "    Waiting for Redis..."
RETRIES=0
until docker compose -f docker-compose.dev.yml exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -gt 30 ]; then
    fail "Redis did not become ready in 30 seconds."
  fi
  echo -n "."
  sleep 1
done
echo ""
log "Redis ready on port 6379."

# -----------------------------------------------
step 4 "Installing dependencies..."
# -----------------------------------------------
echo "    Root dependencies..."
npm install --silent 2>&1 | tail -1
echo "    Server dependencies..."
cd server && npm install --silent 2>&1 | tail -1 && cd ..
echo "    Client dependencies..."
cd client && npm install --silent 2>&1 | tail -1 && cd ..
log "All dependencies installed."

# -----------------------------------------------
step 5 "Setting up database schema..."
# -----------------------------------------------
cd server
npx prisma generate --no-hints 2>&1 | tail -1
npx prisma db push --skip-generate --accept-data-loss 2>&1 | tail -3
cd ..
log "Database schema synced."

# -----------------------------------------------
step 6 "Seeding database..."
# -----------------------------------------------
cd server
npx tsx prisma/seed.ts 2>&1
cd ..
log "Database seeded."

# -----------------------------------------------
step 7 "Running tests..."
# -----------------------------------------------
cd server
echo ""
echo "  --- Unit Tests ---"
npx jest --testPathPattern=tests/unit --verbose 2>&1 | tail -25
echo ""
echo "  --- Integration Tests ---"
npx jest --testPathPattern=tests/integration --verbose 2>&1 | tail -15
cd ..

# -----------------------------------------------
step 8 "Lint and typecheck..."
# -----------------------------------------------
cd server
npx eslint src/ --max-warnings 0 2>&1 && log "Lint passed." || warn "Lint has warnings."
npx tsc --noEmit 2>&1 && log "Typecheck passed." || warn "Typecheck has errors."
cd ..

echo ""
echo -e "${GREEN}==============================${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}==============================${NC}"
echo ""
echo "  Start development:"
echo "    npm run dev"
echo ""
echo "  API:      http://localhost:3000"
echo "  Frontend: http://localhost:5173"
echo "  DB UI:    npm run db:studio"
echo ""
echo "  Test account:"
echo "    admin@blessp.com / Admin123456!"
echo ""

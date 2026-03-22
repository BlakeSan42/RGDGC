#!/usr/bin/env bash
# Start everything: Docker + Backend + Mobile Web
# Then verify all services are healthy

set -e
DIR="$(dirname "$0")"

echo "=== RGDGC Full Stack Start ==="
echo ""

# 1. Docker
echo "[1/4] Starting Docker (PostgreSQL 5433, Redis 6381)..."
docker compose -f "$DIR/../docker-compose.yml" up -d 2>/dev/null
sleep 2

# 2. Kill stale processes
echo "[2/4] Cleaning stale processes..."
lsof -ti:8001 | xargs kill -9 2>/dev/null || true
lsof -ti:8082 | xargs kill -9 2>/dev/null || true
sleep 1

# 3. Backend
echo "[3/4] Starting backend (port 8001)..."
cd "$DIR/../backend"
if [ -f venv/bin/activate ]; then
  source venv/bin/activate
elif [ -f .venv/bin/activate ]; then
  source .venv/bin/activate
fi
uvicorn app.main:app --reload --port 8001 &
BACKEND_PID=$!
cd "$DIR/.."

# 4. Frontend
echo "[4/4] Starting mobile web (port 8082)..."
cd "$DIR/../mobile"
rm -rf /tmp/metro-* .expo node_modules/.cache 2>/dev/null
npx expo start --web --port 8082 --clear &
FRONTEND_PID=$!
cd "$DIR/.."

# Wait for services to come up
echo ""
echo "Waiting for services..."
sleep 10

# Verify
echo ""
echo "=== Health Check ==="

PASS=0
FAIL=0

check() {
  if curl -sf "$2" > /dev/null 2>&1; then
    echo "  [OK]   $1 — $2"
    PASS=$((PASS+1))
  else
    echo "  [FAIL] $1 — $2"
    FAIL=$((FAIL+1))
  fi
}

check "PostgreSQL" "localhost:5433" 2>/dev/null || true
pg_isready -h localhost -p 5433 -U rgdgc -q 2>/dev/null && echo "  [OK]   PostgreSQL — localhost:5433" && PASS=$((PASS+1)) || echo "  [FAIL] PostgreSQL — localhost:5433" && FAIL=$((FAIL+1))
redis-cli -p 6381 ping 2>/dev/null | grep -q PONG && echo "  [OK]   Redis — localhost:6381" && PASS=$((PASS+1)) || echo "  [FAIL] Redis — localhost:6381"
check "Backend API" "http://localhost:8001/health"
check "Swagger Docs" "http://localhost:8001/docs"
check "Mobile Web" "http://localhost:8082"

echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "=== Open http://localhost:8082 in your browser ==="
echo ""

# Keep running (Ctrl+C to stop both)
wait

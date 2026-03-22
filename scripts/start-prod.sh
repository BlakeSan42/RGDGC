#!/usr/bin/env bash
# Start RGDGC production preview — clean, isolated, for Blake to test on.
#
# Backend: http://localhost:9000
# Frontend: http://localhost:9001
#
# This script OWNS ports 9000 and 9001. No other process should use them.
# Dev work happens on 8001/8082 separately.

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$DIR/.."

echo "============================================"
echo "  RGDGC Production Preview"
echo "============================================"
echo ""

# 1. Kill anything on our ports
echo "[1/5] Clearing ports 9000 and 9001..."
lsof -ti:9000 | xargs kill -9 2>/dev/null || true
lsof -ti:9001 | xargs kill -9 2>/dev/null || true
sleep 1

# 2. Ensure Docker
echo "[2/5] Docker services..."
docker compose -f "$ROOT/docker-compose.yml" up -d 2>/dev/null
sleep 2

# 3. Start backend on 9000
echo "[3/5] Starting backend on port 9000..."
cd "$ROOT/backend"
if [ -f venv/bin/activate ]; then
  source venv/bin/activate
elif [ -f .venv/bin/activate ]; then
  source .venv/bin/activate
else
  echo "ERROR: No venv. Run: cd backend && python3 -m venv venv && pip install -r requirements.txt"
  exit 1
fi
# Override CORS for prod preview ports
export CORS_ORIGINS="http://localhost:9000,http://localhost:9001"
uvicorn app.main:app --port 9000 --host 0.0.0.0 &
BACKEND_PID=$!

# 4. Wait for backend
echo "    Waiting for backend..."
for i in {1..15}; do
  curl -sf http://localhost:9000/health > /dev/null 2>&1 && break
  sleep 1
done

if ! curl -sf http://localhost:9000/health > /dev/null 2>&1; then
  echo "ERROR: Backend failed to start on port 9000"
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi
echo "    Backend ready."

# 5. Build and serve static frontend on 9001
echo "[4/5] Building static web export..."
cd "$ROOT/mobile"

# Set env vars for production preview build
export EXPO_PUBLIC_API_URL=http://localhost:9000
# Google OAuth client ID is read from mobile/.env (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)

# Export static build
npx expo export --platform web 2>/dev/null

if [ ! -f dist/index.html ]; then
  echo "ERROR: Web export failed"
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi

echo "[5/5] Serving frontend on port 9001..."
npx serve dist -l 9001 -s &
FRONTEND_PID=$!
sleep 3

# Verify
echo ""
echo "============================================"
echo "  Verification"
echo "============================================"
echo ""

PASS=0
FAIL=0
check() {
  if curl -sf "$2" > /dev/null 2>&1; then
    echo "  [OK]   $1"
    PASS=$((PASS+1))
  else
    echo "  [FAIL] $1"
    FAIL=$((FAIL+1))
  fi
}

check "Backend API      http://localhost:9000/health" "http://localhost:9000/health"
check "Backend Docs     http://localhost:9000/docs" "http://localhost:9000/docs"
check "Frontend App     http://localhost:9001" "http://localhost:9001"

echo ""
echo "$PASS/3 services running"
echo ""
echo "============================================"
echo "  PRODUCTION PREVIEW READY"
echo ""
echo "  App:  http://localhost:9001"
echo "  API:  http://localhost:9000"
echo "  Docs: http://localhost:9000/docs"
echo "============================================"
echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both."
echo ""

# Trap Ctrl+C to clean up
trap "echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait

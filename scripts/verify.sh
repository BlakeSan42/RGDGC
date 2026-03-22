#!/usr/bin/env bash
# Verify RGDGC services — checks production ports by default
#
# Usage:
#   ./scripts/verify.sh        # Check production (9000/9001)
#   ./scripts/verify.sh dev    # Check dev ports (8001/8082)

MODE="${1:-prod}"

echo "=== RGDGC Service Verification ($MODE) ==="
echo ""

PASS=0
FAIL=0

check() {
  local name="$1"
  local cmd="$2"
  if eval "$cmd" > /dev/null 2>&1; then
    echo "  [OK]   $name"
    PASS=$((PASS+1))
  else
    echo "  [FAIL] $name"
    FAIL=$((FAIL+1))
  fi
}

if [ "$MODE" = "prod" ]; then
  API=9000
  WEB=9001
else
  API=8001
  WEB=8082
fi

# Docker
echo "Docker:"
check "PostgreSQL (5433)" "docker inspect --format='{{.State.Health.Status}}' rgdgc-db 2>/dev/null | grep -q healthy"
check "Redis (6381)" "redis-cli -p 6381 ping 2>/dev/null | grep -q PONG"

echo ""
echo "Backend (port $API):"
check "Health" "curl -sf http://localhost:$API/health"
check "Docs" "curl -sf http://localhost:$API/docs"
check "Auth" "curl -sf -X POST http://localhost:$API/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@rgdgc.com\",\"password\":\"admin123\"}'"

echo ""
echo "Frontend (port $WEB):"
check "Web server" "curl -sf http://localhost:$WEB"

echo ""
TOTAL=$((PASS+FAIL))
echo "Result: $PASS/$TOTAL passing"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "To start production: ./scripts/start-prod.sh"
  echo "To start dev:        ./scripts/start-backend.sh + ./scripts/start-web.sh"
  exit 1
else
  echo "All services operational!"
  echo ""
  echo "App: http://localhost:$WEB"
  echo "API: http://localhost:$API"
fi

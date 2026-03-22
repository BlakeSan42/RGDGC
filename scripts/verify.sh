#!/usr/bin/env bash
# Verify all RGDGC services are running and responsive

echo "=== RGDGC Service Verification ==="
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

# Docker
echo "Docker:"
check "PostgreSQL (5433)" "docker inspect --format='{{.State.Health.Status}}' rgdgc-db 2>/dev/null | grep -q healthy"
check "Redis (6381)" "redis-cli -p 6381 ping | grep -q PONG"

echo ""
echo "Backend:"
check "Health endpoint" "curl -sf http://localhost:8001/health"
check "Swagger docs" "curl -sf http://localhost:8001/docs"
check "Auth (login)" "curl -sf -X POST http://localhost:8001/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@rgdgc.com\",\"password\":\"admin123\"}'"
check "Courses API" "curl -sf http://localhost:8001/api/v1/courses -H 'Authorization: Bearer \$(curl -s -X POST http://localhost:8001/api/v1/auth/login -H \"Content-Type: application/json\" -d \"{\\\"email\\\":\\\"admin@rgdgc.com\\\",\\\"password\\\":\\\"admin123\\\"}\" | python3 -c \"import sys,json;print(json.load(sys.stdin)[\\\"access_token\\\"])\")'"

echo ""
echo "Frontend:"
check "Web server (8082)" "curl -sf http://localhost:8082"
check "JS bundle loads" "curl -sf 'http://localhost:8082/node_modules/expo-router/entry.bundle?platform=web&dev=true&lazy=true'"

echo ""
TOTAL=$((PASS+FAIL))
echo "Result: $PASS/$TOTAL passing"
if [ "$FAIL" -gt 0 ]; then
  echo "WARNING: $FAIL service(s) not responding"
  exit 1
else
  echo "All services operational!"
fi

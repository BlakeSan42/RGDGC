#!/usr/bin/env bash
# RGDGC Health Check — adapted from MadWorld's health-check.sh
#
# Usage:
#   ./scripts/health-check.sh          # Human-readable output
#   ./scripts/health-check.sh --json   # JSON output (for cron/alerting)
#
# Exit codes: 0 = all healthy, 1 = one or more failures

set -euo pipefail

JSON_MODE=false
[[ "${1:-}" == "--json" ]] && JSON_MODE=true

PASS=0
FAIL=0
RESULTS=()

check() {
  local name="$1"
  local cmd="$2"

  if eval "$cmd" &>/dev/null; then
    RESULTS+=("{\"name\":\"$name\",\"status\":\"healthy\"}")
    ((PASS++))
    $JSON_MODE || echo "  [OK]  $name"
  else
    RESULTS+=("{\"name\":\"$name\",\"status\":\"unhealthy\"}")
    ((FAIL++))
    $JSON_MODE || echo "  [FAIL] $name"
  fi
}

$JSON_MODE || echo ""
$JSON_MODE || echo "=== RGDGC Health Check ==="
$JSON_MODE || echo ""

# ── Docker Containers ──
$JSON_MODE || echo "Containers:"
check "backend"  "docker inspect --format='{{.State.Health.Status}}' rgdgc-backend 2>/dev/null | grep -q healthy"
check "frontend" "docker inspect --format='{{.State.Health.Status}}' rgdgc-frontend 2>/dev/null | grep -q healthy"
check "database" "docker inspect --format='{{.State.Health.Status}}' rgdgc-db 2>/dev/null | grep -q healthy"
check "redis"    "docker inspect --format='{{.State.Health.Status}}' rgdgc-redis 2>/dev/null | grep -q healthy"
check "caddy"    "docker inspect --format='{{.State.Health.Status}}' rgdgc-caddy 2>/dev/null | grep -q healthy"

$JSON_MODE || echo ""

# ── HTTP Endpoints ──
$JSON_MODE || echo "Endpoints:"
check "api-health"   "curl -sf http://localhost:8000/health"
check "api-docs"     "curl -sf http://localhost:8000/docs"
check "frontend-app" "curl -sf http://localhost:3000/"

$JSON_MODE || echo ""

# ── Summary ──
TOTAL=$((PASS + FAIL))

if $JSON_MODE; then
  echo "{\"total\":$TOTAL,\"pass\":$PASS,\"fail\":$FAIL,\"checks\":[$(IFS=,; echo "${RESULTS[*]}")]}"
else
  echo "Summary: $PASS/$TOTAL passing"
  if [ "$FAIL" -gt 0 ]; then
    echo "WARNING: $FAIL check(s) failed!"
  else
    echo "All systems healthy."
  fi
  echo ""
fi

[ "$FAIL" -eq 0 ]

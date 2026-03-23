#!/usr/bin/env bash
###############################################################################
# RGDGC End-to-End Smoke Test
#
# Tests the full stack against a running local backend:
#   1. Health check
#   2. Auth (register + login)
#   3. Courses & layouts
#   4. Scoring (start round → submit scores → complete)
#   5. League standings
#   6. Chat (Ace bot)
#   7. Weather
#   8. Discs
#   9. Putting analytics
#
# Prerequisites:
#   - Docker running (PostgreSQL + Redis)
#   - Backend running on localhost:8001
#
# Usage:
#   ./scripts/smoke-test.sh
###############################################################################

set -euo pipefail

API="http://localhost:8001/api/v1"
PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

# Globals set during tests
ACCESS_TOKEN=""
ROUND_ID=""

# ── Helpers ──

test_endpoint() {
  local name="$1"
  local method="$2"
  local path="$3"
  local body="${4:-}"
  local auth="${5:-false}"
  local expect_status="${6:-200}"

  ((TOTAL++))

  local args=(-s -o /tmp/smoke_response -w "%{http_code}" --max-time 10)
  args+=(-X "$method")
  args+=(-H "Content-Type: application/json")

  if [ "$auth" = "true" ] && [ -n "$ACCESS_TOKEN" ]; then
    args+=(-H "Authorization: Bearer $ACCESS_TOKEN")
  fi

  if [ -n "$body" ]; then
    args+=(-d "$body")
  fi

  local status
  status=$(curl "${args[@]}" "${API}${path}" 2>/dev/null || echo "000")

  if [ "$status" = "$expect_status" ]; then
    ((PASS++))
    printf "  ${GREEN}[PASS]${NC}  %s (HTTP %s)\n" "$name" "$status"
    return 0
  else
    ((FAIL++))
    local response
    response=$(cat /tmp/smoke_response 2>/dev/null | head -c 200 || echo "no response")
    printf "  ${RED}[FAIL]${NC}  %s (expected %s, got %s) %s\n" "$name" "$expect_status" "$status" "$response"
    return 1
  fi
}

get_json_field() {
  # Simple JSON field extraction (no jq dependency)
  python3 -c "import json,sys; d=json.load(sys.stdin); print(d$1)" < /tmp/smoke_response 2>/dev/null || echo ""
}

echo ""
echo "=== RGDGC End-to-End Smoke Test ==="
echo ""

# ── 1. Health Check ──
echo "1. Health"
# Health is at root, not under /api/v1
((TOTAL++))
if curl -sf --max-time 5 http://localhost:8001/health >/dev/null 2>&1; then
  ((PASS++))
  printf "  ${GREEN}[PASS]${NC}  API health (HTTP 200)\n"
else
  ((FAIL++))
  printf "  ${RED}[FAIL]${NC}  API health — backend not responding\n"
fi

echo ""

# ── 2. Auth ──
echo "2. Authentication"

# Generate unique test user
TIMESTAMP=$(date +%s)
TEST_EMAIL="smoke_${TIMESTAMP}@test.rgdgc.com"
TEST_USER="smoke_${TIMESTAMP}"

test_endpoint "Register" POST "/auth/register" \
  "{\"email\":\"${TEST_EMAIL}\",\"username\":\"${TEST_USER}\",\"password\":\"smoke_pass_123\",\"display_name\":\"Smoke Test\"}" \
  false "201"

# Extract token from registration
ACCESS_TOKEN=$(get_json_field "['access_token']")

if [ -z "$ACCESS_TOKEN" ]; then
  # Try login if registration failed (user may exist)
  test_endpoint "Login" POST "/auth/login" \
    "{\"email\":\"${TEST_EMAIL}\",\"password\":\"smoke_pass_123\"}" \
    false "200"
  ACCESS_TOKEN=$(get_json_field "['access_token']")
fi

if [ -n "$ACCESS_TOKEN" ]; then
  test_endpoint "Get current user" GET "/auth/me" "" true "200"
else
  echo "  ${YELLOW}[SKIP]${NC}  Auth tests (no token obtained)"
fi

echo ""

# ── 3. Courses ──
echo "3. Courses"
test_endpoint "List courses" GET "/courses" "" false "200"

COURSE_ID=$(get_json_field "[0]['id']")
if [ -n "$COURSE_ID" ] && [ "$COURSE_ID" != "" ]; then
  test_endpoint "Get course detail" GET "/courses/${COURSE_ID}" "" false "200"
fi

echo ""

# ── 4. Scoring ──
echo "4. Scoring"
if [ -n "$ACCESS_TOKEN" ]; then
  # Start a practice round on layout 1
  test_endpoint "Start round" POST "/rounds" \
    '{"layout_id":1,"is_practice":true}' true "201"

  ROUND_ID=$(get_json_field "['id']")

  if [ -n "$ROUND_ID" ] && [ "$ROUND_ID" != "" ]; then
    test_endpoint "Submit hole 1 score" POST "/rounds/${ROUND_ID}/scores" \
      '{"hole_number":1,"strokes":3,"putts":1}' true "201"

    test_endpoint "Get round detail" GET "/rounds/${ROUND_ID}" "" true "200"
  fi
else
  echo "  ${YELLOW}[SKIP]${NC}  Scoring (no auth token)"
fi

echo ""

# ── 5. Leagues & Standings ──
echo "5. Leagues"
test_endpoint "List leagues" GET "/leagues" "" false "200"
test_endpoint "Dubs leaderboard" GET "/leagues/1/leaderboard" "" false "200"

echo ""

# ── 6. Events ──
echo "6. Events"
test_endpoint "List events" GET "/events" "" false "200"
test_endpoint "Upcoming events" GET "/events?status=upcoming" "" false "200"

echo ""

# ── 7. Chat (Ace) ──
echo "7. Chat"
if [ -n "$ACCESS_TOKEN" ]; then
  # Chat endpoint requires admin role — test that regular user gets 403
  test_endpoint "Chat (non-admin → 403)" POST "/chat" \
    '{"message":"What are the standings?"}' true "403"
else
  echo "  ${YELLOW}[SKIP]${NC}  Chat (no auth token)"
fi

echo ""

# ── 8. Weather ──
echo "8. Weather"
test_endpoint "Current weather" GET "/weather/current" "" false "200"
test_endpoint "Wind for putting" GET "/weather/wind" "" false "200"

echo ""

# ── 9. Geo ──
echo "9. Geo"
if [ -n "$COURSE_ID" ] && [ "$COURSE_ID" != "" ]; then
  test_endpoint "Course GeoJSON" GET "/geo/courses/${COURSE_ID}/geojson" "" false "200"
fi

echo ""

# ── 10. Putting Analytics ──
echo "10. Putting"
test_endpoint "Putting probability" GET "/putting/probability?distance_meters=5" "" true "200"

echo ""

# ── Summary ──
echo "==========================================="
if [ "$FAIL" -eq 0 ]; then
  printf "${GREEN}SMOKE TEST PASSED: %d/%d${NC}\n" "$PASS" "$TOTAL"
else
  printf "${YELLOW}SMOKE TEST: %d/%d passed, %d failed${NC}\n" "$PASS" "$TOTAL" "$FAIL"
fi
echo ""

# Cleanup
rm -f /tmp/smoke_response

[ "$FAIL" -eq 0 ]

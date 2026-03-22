#!/usr/bin/env bash
# RGDGC Security Audit — automated scan
# Run: ./scripts/security-audit.sh
# Add to CI: runs on every PR

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$DIR/.."
REPORT="$ROOT/signals/security-audit-$(date +%Y%m%d).json"

echo "=== RGDGC Security Audit ==="
echo ""

PASS=0
FAIL=0
WARN=0

check() {
  local severity="$1" name="$2" cmd="$3"
  if eval "$cmd" > /dev/null 2>&1; then
    echo "  [OK]   $name"
    PASS=$((PASS+1))
  else
    if [ "$severity" = "CRITICAL" ] || [ "$severity" = "HIGH" ]; then
      echo "  [FAIL] $name ($severity)"
      FAIL=$((FAIL+1))
    else
      echo "  [WARN] $name ($severity)"
      WARN=$((WARN+1))
    fi
  fi
}

# 1. Secrets in code
echo "Secrets Detection:"
check "CRITICAL" "No .env files committed" "! git ls-files --error-unmatch '*.env' 2>/dev/null"
check "CRITICAL" "No private keys in code" "! grep -rn 'PRIVATE_KEY=0x' $ROOT/backend $ROOT/contracts $ROOT/mobile --include='*.py' --include='*.ts' --include='*.json' 2>/dev/null | grep -v node_modules | grep -v '.env.example'"
check "CRITICAL" "No sk. tokens in code" "! grep -rn 'sk\\.eyJ' $ROOT --include='*.py' --include='*.ts' --include='*.tsx' --include='*.json' 2>/dev/null | grep -v node_modules"
check "HIGH" "No hardcoded passwords" "! grep -rn 'password.*=.*[\"'\'']' $ROOT/backend/app --include='*.py' 2>/dev/null | grep -v 'password_hash\|password.*:\|password.*Field\|password.*str\|password.*None\|#.*password'"

echo ""
echo "Authentication:"
check "HIGH" "JWT uses hmac.compare_digest" "grep -q 'compare_digest' $ROOT/backend/app/core/security.py 2>/dev/null"
check "HIGH" "Refresh token checks blacklist" "grep -q 'blacklist\|is_token_blacklisted' $ROOT/backend/app/api/v1/auth.py 2>/dev/null"
check "MEDIUM" "Password min length enforced" "grep -q 'min_length' $ROOT/backend/app/schemas/user.py 2>/dev/null"
check "MEDIUM" "Score inputs validated (ge/le)" "grep -q 'ge=1' $ROOT/backend/app/schemas/round.py 2>/dev/null"

echo ""
echo "XSS Protection:"
check "CRITICAL" "HTML escaping in public pages" "grep -q 'html.escape\|escape(' $ROOT/backend/app/api/public.py 2>/dev/null"
check "MEDIUM" "Security headers middleware" "grep -q 'X-Content-Type-Options\|security_headers' $ROOT/backend/app/main.py 2>/dev/null"

echo ""
echo "Infrastructure:"
check "MEDIUM" "Docker non-root user" "grep -q 'USER' $ROOT/backend/Dockerfile 2>/dev/null"
check "LOW" "Redis has password" "grep -q 'requirepass' $ROOT/docker-compose.yml 2>/dev/null"

echo ""
echo "Dependencies:"
if command -v pip-audit > /dev/null 2>&1; then
  check "MEDIUM" "Python deps secure" "cd $ROOT/backend && pip-audit -r requirements.txt --desc 2>/dev/null"
else
  echo "  [SKIP] pip-audit not installed (pip install pip-audit)"
fi

echo ""
TOTAL=$((PASS+FAIL+WARN))
echo "============================================"
echo "  Results: $PASS passed, $FAIL failed, $WARN warnings ($TOTAL total)"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "ACTION REQUIRED: $FAIL critical/high issues found"
  exit 1
fi

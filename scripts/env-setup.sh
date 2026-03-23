#!/usr/bin/env bash
#
# env-setup.sh — Generate .env files for development or production
#
# Usage:
#   ./scripts/env-setup.sh dev           # Set up local development (default)
#   ./scripts/env-setup.sh prod          # Generate production env template
#   ./scripts/env-setup.sh check         # Validate current environment
#   ./scripts/env-setup.sh point-prod    # Point local frontends at production API
#   ./scripts/env-setup.sh point-local   # Point local frontends back at localhost

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

generate_secret() {
    python3 -c "import secrets; print(secrets.token_hex(32))"
}

cmd_dev() {
    echo "Setting up development environment..."

    # Backend .env
    cat > "$PROJECT_ROOT/backend/.env" << 'EOF'
# RGDGC Backend — Development
ENVIRONMENT=development
DATABASE_URL=postgresql+asyncpg://rgdgc:rgdgc_dev@localhost:5433/rgdgc
REDIS_URL=redis://localhost:6381
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET=dev-jwt-secret-change-in-production
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8081,http://localhost:19006
EOF

    # Mobile .env
    cat > "$PROJECT_ROOT/mobile/.env" << 'EOF'
EXPO_PUBLIC_API_URL=http://localhost:8001
EOF

    # Admin .env
    cat > "$PROJECT_ROOT/admin-dashboard/.env" << 'EOF'
VITE_API_URL=http://localhost:8001/api/v1
EOF

    echo "✓ Dev environment ready"
    echo "  Backend:  backend/.env → localhost:5433/6381"
    echo "  Mobile:   mobile/.env → localhost:8001"
    echo "  Admin:    admin-dashboard/.env → localhost:8001"
    echo ""
    echo "Start everything:"
    echo "  docker compose up -d              # DB + Redis"
    echo "  ./scripts/dev-server.sh start     # Backend + Celery"
    echo "  cd mobile && npx expo start --web # Mobile web"
    echo "  cd admin-dashboard && npm run dev  # Admin panel"
}

cmd_prod() {
    echo "Generating production environment template..."
    echo ""

    local secret_key=$(generate_secret)
    local jwt_secret=$(generate_secret)
    local owner_key=$(generate_secret)

    cat > "$PROJECT_ROOT/.env.production" << EOF
# ╔═══════════════════════════════════════════════════════════════╗
# ║  RGDGC Production Environment — Set these in Railway         ║
# ║  Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)                          ║
# ║  NEVER commit this file. It's in .gitignore.                 ║
# ╚═══════════════════════════════════════════════════════════════╝

ENVIRONMENT=production

# ── Database (Railway provides these automatically) ──
# DATABASE_URL=\${{Postgres.DATABASE_URL}}
# REDIS_URL=\${{Redis.REDIS_URL}}

# ── Security (generated — save these somewhere safe) ──
SECRET_KEY=$secret_key
JWT_SECRET=$jwt_secret
OWNER_KEY=$owner_key

# ── CORS (your production domains) ──
CORS_ORIGINS=https://rgdgc.com,https://admin.rgdgc.com,https://rgdgc-admin.vercel.app

# ── OAuth (get from Google Cloud Console) ──
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# GOOGLE_IOS_CLIENT_ID=

# ── LLM (at least one for the chat bot) ──
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=

# ── Blockchain (optional — Sepolia testnet) ──
# WEB3_PROVIDER_URL=https://sepolia.infura.io/v3/YOUR_KEY
# RGDG_TOKEN_ADDRESS=
# TREASURY_ADDRESS=
# DEPLOYER_PRIVATE_KEY=

# ── Monitoring (optional) ──
# SENTRY_DSN=
# POSTHOG_API_KEY=
EOF

    echo "✓ Generated .env.production with fresh secrets"
    echo ""
    echo "  SECRET_KEY:  ${secret_key:0:8}..."
    echo "  JWT_SECRET:  ${jwt_secret:0:8}..."
    echo "  OWNER_KEY:   ${owner_key:0:8}..."
    echo ""
    echo "Next: Copy these values into Railway → Variables"
    echo "  railway variables set SECRET_KEY=\"$secret_key\""
    echo "  railway variables set JWT_SECRET=\"$jwt_secret\""
    echo "  railway variables set OWNER_KEY=\"$owner_key\""
}

cmd_check() {
    echo "Checking environment..."
    echo ""

    local ok=true

    # Check Docker
    if docker ps --filter name=rgdgc-db --format '{{.Status}}' 2>/dev/null | grep -q "Up"; then
        echo "✓ PostgreSQL (rgdgc-db) running"
    else
        echo "✗ PostgreSQL not running — run: docker compose up -d"
        ok=false
    fi

    if docker ps --filter name=rgdgc-redis --format '{{.Status}}' 2>/dev/null | grep -q "Up"; then
        echo "✓ Redis (rgdgc-redis) running"
    else
        echo "✗ Redis not running — run: docker compose up -d"
        ok=false
    fi

    # Check backend
    if curl -sf http://localhost:8001/health > /dev/null 2>&1; then
        echo "✓ Backend healthy on :8001"
    else
        echo "✗ Backend not running — run: ./scripts/dev-server.sh start"
        ok=false
    fi

    # Check env files
    for f in backend/.env mobile/.env admin-dashboard/.env; do
        if [ -f "$PROJECT_ROOT/$f" ]; then
            echo "✓ $f exists"
        else
            echo "✗ $f missing — run: ./scripts/env-setup.sh dev"
            ok=false
        fi
    done

    # Check for dev secrets in production
    if [ -f "$PROJECT_ROOT/backend/.env" ]; then
        local env_val=$(grep "^ENVIRONMENT=" "$PROJECT_ROOT/backend/.env" | cut -d= -f2)
        if [ "$env_val" = "production" ]; then
            if grep -q "change-in-production" "$PROJECT_ROOT/backend/.env"; then
                echo "✗ DANGER: Production env has dev secrets!"
                ok=false
            fi
        fi
    fi

    echo ""
    if $ok; then
        echo "✓ All checks passed"
    else
        echo "✗ Some checks failed — see above"
    fi
}

cmd_point_prod() {
    local prod_url="${1:-}"
    if [ -z "$prod_url" ]; then
        echo "Usage: ./scripts/env-setup.sh point-prod https://your-app.up.railway.app"
        echo ""
        echo "Points your local mobile + admin at the production backend"
        echo "for testing prod data with local frontends."
        return 1
    fi

    # Update mobile
    sed -i.bak "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=$prod_url|" "$PROJECT_ROOT/mobile/.env"
    rm -f "$PROJECT_ROOT/mobile/.env.bak"

    # Update admin
    sed -i.bak "s|VITE_API_URL=.*|VITE_API_URL=$prod_url/api/v1|" "$PROJECT_ROOT/admin-dashboard/.env"
    rm -f "$PROJECT_ROOT/admin-dashboard/.env.bak"

    echo "✓ Frontends now pointing at: $prod_url"
    echo "  Restart expo and vite to pick up changes."
}

cmd_point_local() {
    sed -i.bak "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=http://localhost:8001|" "$PROJECT_ROOT/mobile/.env"
    rm -f "$PROJECT_ROOT/mobile/.env.bak"

    sed -i.bak "s|VITE_API_URL=.*|VITE_API_URL=http://localhost:8001/api/v1|" "$PROJECT_ROOT/admin-dashboard/.env"
    rm -f "$PROJECT_ROOT/admin-dashboard/.env.bak"

    echo "✓ Frontends now pointing at: localhost:8001"
    echo "  Restart expo and vite to pick up changes."
}

# ── Main ──
case "${1:-dev}" in
    dev)         cmd_dev ;;
    prod)        cmd_prod ;;
    check)       cmd_check ;;
    point-prod)  cmd_point_prod "${2:-}" ;;
    point-local) cmd_point_local ;;
    *)
        echo "Usage: $0 {dev|prod|check|point-prod <url>|point-local}"
        exit 1
        ;;
esac

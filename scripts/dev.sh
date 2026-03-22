#!/usr/bin/env bash
###############################################################################
# RGDGC Development Environment
#
# Usage:
#   ./scripts/dev.sh setup    Full first-time setup
#   ./scripts/dev.sh start    Start all dev servers
#   ./scripts/dev.sh stop     Stop all services
#   ./scripts/dev.sh test     Run all tests
#   ./scripts/dev.sh migrate  Run database migrations
#   ./scripts/dev.sh seed     Seed development data
#   ./scripts/dev.sh health   Run health checks
#   ./scripts/dev.sh help     Show this help
#
# Ports (offset to avoid MadWorld conflicts):
#   PostgreSQL: 5433   Redis: 6381   Backend API: 8001
#   Admin Dashboard: 5173   Expo: 8081
###############################################################################

set -euo pipefail

# Resolve project root (parent of scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PYTHON="${PYTHON:-$(command -v python3 2>/dev/null || command -v python 2>/dev/null)}"
VENV="$PROJECT_ROOT/backend/venv"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; }

# Track background PIDs for clean shutdown
PIDS=()

cleanup() {
    if [ ${#PIDS[@]} -gt 0 ]; then
        info "Shutting down dev servers..."
        for pid in "${PIDS[@]}"; do
            kill "$pid" 2>/dev/null || true
        done
        wait 2>/dev/null || true
        ok "All dev servers stopped."
    fi
}

trap cleanup EXIT INT TERM

# ── Commands ─────────────────────────────────────────────────────────────────

cmd_setup() {
    info "Setting up RGDGC development environment..."
    echo ""

    cmd_install
    cmd_db_start
    cmd_migrate
    cmd_seed

    echo ""
    echo "============================================"
    ok "RGDGC is ready! Run './scripts/dev.sh start'"
    echo "============================================"
    echo ""
}

cmd_install() {
    info "Installing all dependencies..."

    # Backend
    info "Installing backend (Python)..."
    if [ ! -d "$VENV" ]; then
        "$PYTHON" -m venv "$VENV"
    fi
    source "$VENV/bin/activate"
    pip install --upgrade pip -q
    pip install -r backend/requirements.txt -q
    deactivate
    ok "Backend dependencies installed."

    # Mobile
    info "Installing mobile (React Native)..."
    cd "$PROJECT_ROOT/mobile" && npm install --silent
    ok "Mobile dependencies installed."

    # Admin Dashboard
    info "Installing admin dashboard (React)..."
    cd "$PROJECT_ROOT/admin-dashboard" && npm install --silent
    ok "Admin dashboard dependencies installed."

    # Contracts
    info "Installing contracts (Hardhat)..."
    cd "$PROJECT_ROOT/contracts" && npm install --silent
    ok "Contract dependencies installed."

    cd "$PROJECT_ROOT"
}

cmd_db_start() {
    info "Starting PostgreSQL and Redis..."
    docker compose up -d

    info "Waiting for PostgreSQL to be ready..."
    for i in $(seq 1 15); do
        if docker exec rgdgc-db pg_isready -U rgdgc -q 2>/dev/null; then
            ok "PostgreSQL is ready."
            return 0
        fi
        sleep 1
    done
    err "PostgreSQL did not become ready in 15 seconds."
    return 1
}

cmd_db_stop() {
    info "Stopping database containers..."
    docker compose down
    ok "Database containers stopped."
}

cmd_migrate() {
    info "Running Alembic migrations..."
    source "$VENV/bin/activate"
    cd "$PROJECT_ROOT/backend" && alembic upgrade head
    deactivate
    cd "$PROJECT_ROOT"
    ok "Migrations applied."
}

cmd_seed() {
    info "Seeding development data..."
    source "$VENV/bin/activate"
    cd "$PROJECT_ROOT/backend" && "$PYTHON" scripts/seed_data.py
    deactivate
    cd "$PROJECT_ROOT"
    ok "Seed data loaded."
}

cmd_start() {
    echo ""
    info "Starting RGDGC dev environment..."
    echo ""
    echo "  Backend API:      http://localhost:8001"
    echo "  Backend docs:     http://localhost:8001/docs"
    echo "  Admin dashboard:  http://localhost:5173"
    echo "  Expo (mobile):    http://localhost:8081"
    echo ""
    info "Press Ctrl+C to stop all services."
    echo ""

    # Ensure DB is running
    if ! docker inspect rgdgc-db &>/dev/null; then
        cmd_db_start
    fi

    # Backend
    (
        source "$VENV/bin/activate"
        cd "$PROJECT_ROOT/backend"
        uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
    ) &
    PIDS+=($!)

    # Mobile
    (
        cd "$PROJECT_ROOT/mobile"
        npx expo start --port 8081
    ) &
    PIDS+=($!)

    # Admin Dashboard
    (
        cd "$PROJECT_ROOT/admin-dashboard"
        npm run dev
    ) &
    PIDS+=($!)

    # Wait for all background processes
    wait
}

cmd_stop() {
    info "Stopping all RGDGC services..."

    # Kill known dev processes
    pkill -f "uvicorn app.main" 2>/dev/null && ok "Backend stopped." || true
    pkill -f "expo start" 2>/dev/null && ok "Expo stopped." || true
    pkill -f "vite" 2>/dev/null && ok "Admin dashboard stopped." || true

    # Stop containers
    docker compose down 2>/dev/null && ok "Containers stopped." || true

    ok "All services stopped."
}

cmd_test() {
    info "Running all tests..."

    info "Backend tests..."
    source "$VENV/bin/activate"
    cd "$PROJECT_ROOT/backend" && pytest -v
    deactivate

    info "Contract tests..."
    cd "$PROJECT_ROOT/contracts" && npx hardhat test

    cd "$PROJECT_ROOT"
    ok "All tests passed."
}

cmd_health() {
    "$PROJECT_ROOT/scripts/health-check.sh"
}

cmd_help() {
    echo ""
    echo "RGDGC Development Environment"
    echo "=============================="
    echo ""
    echo "Usage: ./scripts/dev.sh <command>"
    echo ""
    echo "Commands:"
    echo "  setup     Full first-time setup (install + db + migrate + seed)"
    echo "  start     Start all dev servers (backend + mobile + admin)"
    echo "  stop      Stop all services and containers"
    echo "  test      Run all tests"
    echo "  migrate   Run Alembic database migrations"
    echo "  seed      Seed development data"
    echo "  health    Run health checks"
    echo "  help      Show this help"
    echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────

case "${1:-help}" in
    setup)   cmd_setup ;;
    install) cmd_install ;;
    start)   cmd_start ;;
    stop)    cmd_stop ;;
    test)    cmd_test ;;
    migrate) cmd_migrate ;;
    seed)    cmd_seed ;;
    health)  cmd_health ;;
    help)    cmd_help ;;
    *)
        err "Unknown command: $1"
        cmd_help
        exit 1
        ;;
esac

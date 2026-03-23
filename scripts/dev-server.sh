#!/usr/bin/env bash
#
# dev-server.sh — Single shared development backend for all terminals
#
# Problem: Multiple Claude terminals each start their own uvicorn, causing
# port conflicts, DB pool exhaustion, and lock contention.
#
# Solution: One server process managed via a PID file. Any terminal can:
#   ./scripts/dev-server.sh start   — Start (or confirm already running)
#   ./scripts/dev-server.sh stop    — Stop the shared server
#   ./scripts/dev-server.sh restart — Restart cleanly
#   ./scripts/dev-server.sh status  — Check if running
#   ./scripts/dev-server.sh logs    — Tail the server log
#
# The server runs uvicorn with --reload so code changes auto-apply.
# All terminals should use the API at http://localhost:8001 instead of
# creating their own DB connections where possible.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
PID_FILE="$PROJECT_ROOT/.dev-server.pid"
CELERY_PID_FILE="$PROJECT_ROOT/.dev-celery.pid"
CELERY_BEAT_PID_FILE="$PROJECT_ROOT/.dev-celery-beat.pid"
LOG_FILE="$PROJECT_ROOT/.dev-server.log"
CELERY_LOG_FILE="$PROJECT_ROOT/.dev-celery.log"
PORT=8001
HOST="0.0.0.0"

_is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
        # Stale PID file
        rm -f "$PID_FILE"
    fi
    return 1
}

_kill_stale_uvicorns() {
    # Kill any uvicorn processes on our port that we don't manage
    local pids
    pids=$(lsof -ti :"$PORT" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "  Cleaning up stale processes on port $PORT..."
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

cmd_start() {
    if _is_running; then
        local pid
        pid=$(cat "$PID_FILE")
        echo "✓ Dev server already running (PID $pid) on http://$HOST:$PORT"
        echo "  Use './scripts/dev-server.sh logs' to see output"
        return 0
    fi

    _kill_stale_uvicorns

    echo "Starting dev server on http://$HOST:$PORT..."

    # Activate venv and start uvicorn in background
    cd "$BACKEND_DIR"
    source .venv/bin/activate 2>/dev/null || true

    nohup python -m uvicorn app.main:app \
        --host "$HOST" \
        --port "$PORT" \
        --reload \
        --reload-dir app \
        --log-level info \
        > "$LOG_FILE" 2>&1 &

    local pid=$!
    echo "$pid" > "$PID_FILE"

    # Wait for health check
    echo "  Waiting for health check..."
    local attempts=0
    while [ $attempts -lt 15 ]; do
        if curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
            echo "✓ Dev server running (PID $pid) on http://localhost:$PORT"
            _start_celery
            return 0
        fi
        sleep 1
        attempts=$((attempts + 1))
    done

    echo "✗ Server failed to start. Check logs:"
    tail -20 "$LOG_FILE"
    rm -f "$PID_FILE"
    return 1
}

_start_celery() {
    # Start Celery worker + beat if not already running
    if [ -f "$CELERY_PID_FILE" ]; then
        local cpid
        cpid=$(cat "$CELERY_PID_FILE")
        if kill -0 "$cpid" 2>/dev/null; then
            echo "✓ Celery worker already running (PID $cpid)"
            return 0
        fi
        rm -f "$CELERY_PID_FILE" "$CELERY_BEAT_PID_FILE"
    fi

    cd "$BACKEND_DIR"
    source .venv/bin/activate 2>/dev/null || true

    # Check if celery is installed
    if ! python -c "import celery" 2>/dev/null; then
        echo "  Celery not installed, skipping background tasks"
        return 0
    fi

    echo "  Starting Celery worker + beat..."

    nohup celery -A app.worker worker \
        --loglevel=info \
        --concurrency=2 \
        >> "$CELERY_LOG_FILE" 2>&1 &
    echo "$!" > "$CELERY_PID_FILE"

    nohup celery -A app.worker beat \
        --loglevel=info \
        >> "$CELERY_LOG_FILE" 2>&1 &
    echo "$!" > "$CELERY_BEAT_PID_FILE"

    echo "✓ Celery worker + beat started"
}

_stop_celery() {
    for pf in "$CELERY_PID_FILE" "$CELERY_BEAT_PID_FILE"; do
        if [ -f "$pf" ]; then
            local cpid
            cpid=$(cat "$pf")
            kill "$cpid" 2>/dev/null || true
            rm -f "$pf"
        fi
    done
    # Kill any orphan celery processes
    pkill -f "celery -A app.worker" 2>/dev/null || true
}

cmd_stop() {
    if ! _is_running; then
        echo "Dev server not running."
        _kill_stale_uvicorns
        return 0
    fi

    local pid
    pid=$(cat "$PID_FILE")
    echo "Stopping dev server (PID $pid)..."
    kill "$pid" 2>/dev/null || true

    # Wait for clean shutdown
    local attempts=0
    while kill -0 "$pid" 2>/dev/null && [ $attempts -lt 10 ]; do
        sleep 1
        attempts=$((attempts + 1))
    done

    if kill -0 "$pid" 2>/dev/null; then
        echo "  Force killing..."
        kill -9 "$pid" 2>/dev/null || true
    fi

    rm -f "$PID_FILE"
    _kill_stale_uvicorns
    _stop_celery
    echo "✓ Dev server stopped."
}

cmd_restart() {
    cmd_stop
    sleep 1
    cmd_start
}

cmd_status() {
    if _is_running; then
        local pid
        pid=$(cat "$PID_FILE")
        echo "✓ Dev server running (PID $pid) on http://localhost:$PORT"

        # Show connection info
        local conns
        conns=$(docker exec rgdgc-db psql -U rgdgc -d rgdgc -tA \
            -c "SELECT count(*) FROM pg_stat_activity WHERE datname='rgdgc';" 2>/dev/null || echo "?")
        echo "  DB connections: $conns / 100"
        echo "  Health: $(curl -sf http://localhost:$PORT/health 2>/dev/null || echo 'unreachable')"

        # Celery status
        if [ -f "$CELERY_PID_FILE" ]; then
            local cpid
            cpid=$(cat "$CELERY_PID_FILE")
            if kill -0 "$cpid" 2>/dev/null; then
                echo "  Celery worker: running (PID $cpid)"
            else
                echo "  Celery worker: dead (stale PID $cpid)"
            fi
        else
            echo "  Celery worker: not running"
        fi
    else
        echo "✗ Dev server not running."

        # Check for orphan processes
        local orphans
        orphans=$(lsof -ti :"$PORT" 2>/dev/null || true)
        if [ -n "$orphans" ]; then
            echo "  ⚠ Found orphan processes on port $PORT: $orphans"
            echo "  Run './scripts/dev-server.sh start' to clean up and restart"
        fi
    fi
}

cmd_logs() {
    if [ -f "$LOG_FILE" ]; then
        tail -f "$LOG_FILE"
    else
        echo "No log file found. Is the server running?"
    fi
}

# ── Main ──
case "${1:-status}" in
    start)   cmd_start ;;
    stop)    cmd_stop ;;
    restart) cmd_restart ;;
    status)  cmd_status ;;
    logs)    cmd_logs ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac

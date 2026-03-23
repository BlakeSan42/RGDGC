#!/usr/bin/env bash
#
# team.sh — Real-time multi-terminal coordination via Redis
#
# Redis on :6381 is the shared brain. All state is instant and atomic.
# No files to go stale. Every terminal sees the same state at the same time.
#
# Usage:
#   ./scripts/team.sh init <id>               # Register (e.g., t1, t2)
#   ./scripts/team.sh status                  # Live team state from Redis
#   ./scripts/team.sh claim <path> [desc]     # Claim a file/directory
#   ./scripts/team.sh release [path]          # Release claim (or all)
#   ./scripts/team.sh check <path>            # Who owns this?
#   ./scripts/team.sh checkin [message]       # Post status + broadcast to all
#   ./scripts/team.sh board                   # Recent activity stream
#   ./scripts/team.sh msg <text>              # Broadcast a message to all terminals
#   ./scripts/team.sh read                    # Read messages since last check
#   ./scripts/team.sh merge                   # Merge branch to main (runs tests)
#   ./scripts/team.sh sync                    # Rebase onto latest main
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REDIS="redis-cli -p 6381"
IDENTITY_FILE="$PROJECT_ROOT/.terminal-id"

# Redis key prefixes
PFX="team"   # team:terminals:<id>, team:claims:<path>, team:board, team:msgs

_get_id() {
    if [ -f "$IDENTITY_FILE" ]; then cat "$IDENTITY_FILE"
    elif [ -n "${TERMINAL_ID:-}" ]; then echo "$TERMINAL_ID"
    else echo ""; fi
}

_require_id() {
    local id; id=$(_get_id)
    [ -n "$id" ] || { echo "ERROR: Run ./scripts/team.sh init <id> first"; exit 1; }
    echo "$id"
}

_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
_branch() { git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"; }

_redis_check() {
    $REDIS ping >/dev/null 2>&1 || { echo "ERROR: Redis not running on :6381. Start Docker: docker compose up -d"; exit 1; }
}

cmd_init() {
    local id="${1:?Usage: team.sh init <id> (e.g., t1, t2)}"
    _redis_check
    echo "$id" > "$IDENTITY_FILE"
    local branch; branch=$(_branch)
    local now; now=$(_now)

    # Store terminal state as a Redis hash
    $REDIS HSET "$PFX:terminal:$id" \
        branch "$branch" \
        last_checkin "$now" \
        status "active" \
        working_on "just started" \
        pid "$$" \
        >/dev/null

    # Add to active terminals set
    $REDIS SADD "$PFX:terminals" "$id" >/dev/null

    # Log to activity stream
    $REDIS RPUSH "$PFX:board" "[$now] $id: initialized on $branch" >/dev/null
    $REDIS LTRIM "$PFX:board" -100 -1 >/dev/null  # Keep last 100

    # Broadcast
    $REDIS PUBLISH "$PFX:broadcast" "$id joined on $branch" >/dev/null 2>&1 || true

    echo "Registered $id on $branch"
}

cmd_status() {
    _redis_check
    local terminals; terminals=$($REDIS SMEMBERS "$PFX:terminals" 2>/dev/null)

    if [ -z "$terminals" ]; then
        echo "No terminals registered. Run: ./scripts/team.sh init <id>"
        return
    fi

    echo "=== TEAM (live from Redis) ==="
    echo ""
    for tid in $terminals; do
        local branch status working checkin
        branch=$($REDIS HGET "$PFX:terminal:$tid" branch 2>/dev/null || echo "?")
        status=$($REDIS HGET "$PFX:terminal:$tid" status 2>/dev/null || echo "?")
        working=$($REDIS HGET "$PFX:terminal:$tid" working_on 2>/dev/null || echo "?")
        checkin=$($REDIS HGET "$PFX:terminal:$tid" last_checkin 2>/dev/null || echo "?")
        echo "  $tid [$status] $branch"
        echo "      $working"
        echo "      last: $checkin"
        echo ""
    done

    # Show claims
    local claim_keys; claim_keys=$($REDIS KEYS "$PFX:claim:*" 2>/dev/null)
    if [ -n "$claim_keys" ]; then
        echo "Claims:"
        for key in $claim_keys; do
            local path="${key#$PFX:claim:}"
            local owner desc
            owner=$($REDIS HGET "$key" terminal 2>/dev/null || echo "?")
            desc=$($REDIS HGET "$key" description 2>/dev/null || echo "")
            echo "  $path -> $owner ($desc)"
        done
    else
        echo "No file claims."
    fi
}

cmd_claim() {
    local path="${1:?Usage: team.sh claim <path> [desc]}"
    local desc="${2:-}"
    local id; id=$(_require_id)
    _redis_check

    # Check for conflicts using Redis KEYS scan
    local claim_keys; claim_keys=$($REDIS KEYS "$PFX:claim:*" 2>/dev/null)
    for key in $claim_keys; do
        local claimed_path="${key#$PFX:claim:}"
        local owner; owner=$($REDIS HGET "$key" terminal 2>/dev/null)
        [ "$owner" = "$id" ] && continue

        # Check path overlap
        if python3 -c "
import sys
cp, p = '$claimed_path', '$path'
if cp.startswith(p) or p.startswith(cp): sys.exit(0)
sys.exit(1)
" 2>/dev/null; then
            echo "CONFLICT: $claimed_path claimed by $owner"
            return 1
        fi
    done

    # Claim it
    local now; now=$(_now)
    $REDIS HSET "$PFX:claim:$path" terminal "$id" claimed_at "$now" description "$desc" >/dev/null
    $REDIS RPUSH "$PFX:board" "[$now] $id: claimed $path ($desc)" >/dev/null
    $REDIS PUBLISH "$PFX:broadcast" "$id claimed $path" >/dev/null 2>&1 || true
    echo "Claimed: $path -> $id"
}

cmd_release() {
    local path="${1:-all}"
    local id; id=$(_require_id)
    _redis_check

    if [ "$path" = "all" ]; then
        local claim_keys; claim_keys=$($REDIS KEYS "$PFX:claim:*" 2>/dev/null)
        local count=0
        for key in $claim_keys; do
            local owner; owner=$($REDIS HGET "$key" terminal 2>/dev/null)
            if [ "$owner" = "$id" ]; then
                $REDIS DEL "$key" >/dev/null
                count=$((count + 1))
            fi
        done
        echo "Released $count claims"
    else
        local owner; owner=$($REDIS HGET "$PFX:claim:$path" terminal 2>/dev/null)
        if [ "$owner" = "$id" ]; then
            $REDIS DEL "$PFX:claim:$path" >/dev/null
            echo "Released: $path"
        else
            echo "No claim on $path owned by $id"
        fi
    fi

    $REDIS RPUSH "$PFX:board" "[$(_now)] $id: released $path" >/dev/null
}

cmd_check() {
    local path="${1:?Usage: team.sh check <path>}"
    _redis_check

    local found=false
    local claim_keys; claim_keys=$($REDIS KEYS "$PFX:claim:*" 2>/dev/null)
    for key in $claim_keys; do
        local claimed_path="${key#$PFX:claim:}"
        if python3 -c "
import sys
cp, p = '$claimed_path', '$path'
if cp.startswith(p) or p.startswith(cp): sys.exit(0)
sys.exit(1)
" 2>/dev/null; then
            local owner desc
            owner=$($REDIS HGET "$key" terminal 2>/dev/null || echo "?")
            desc=$($REDIS HGET "$key" description 2>/dev/null || echo "")
            echo "$claimed_path -> $owner ($desc)"
            found=true
        fi
    done
    [ "$found" = "false" ] && echo "$path: unclaimed"
}

cmd_checkin() {
    local message="${1:-still working}"
    local id; id=$(_require_id)
    local branch; branch=$(_branch)
    local now; now=$(_now)
    _redis_check

    $REDIS HSET "$PFX:terminal:$id" \
        last_checkin "$now" \
        branch "$branch" \
        status "active" \
        working_on "$message" \
        >/dev/null

    $REDIS RPUSH "$PFX:board" "[$now] $id ($branch): $message" >/dev/null
    $REDIS LTRIM "$PFX:board" -100 -1 >/dev/null
    $REDIS PUBLISH "$PFX:broadcast" "$id: $message" >/dev/null 2>&1 || true
    echo "Checked in: $id — $message"
}

cmd_msg() {
    local text="${1:?Usage: team.sh msg <text>}"
    local id; id=$(_require_id)
    local now; now=$(_now)
    _redis_check

    # Store in message list (persistent) + publish (real-time)
    $REDIS RPUSH "$PFX:messages" "[$now] $id: $text" >/dev/null
    $REDIS LTRIM "$PFX:messages" -50 -1 >/dev/null
    $REDIS PUBLISH "$PFX:broadcast" "MSG from $id: $text" >/dev/null 2>&1 || true
    $REDIS RPUSH "$PFX:board" "[$now] $id [MSG]: $text" >/dev/null
    echo "Sent: $text"
}

cmd_read() {
    _redis_check
    local msgs; msgs=$($REDIS LRANGE "$PFX:messages" -10 -1 2>/dev/null)
    if [ -n "$msgs" ]; then
        echo "=== Recent Messages ==="
        echo "$msgs"
    else
        echo "No messages."
    fi
}

cmd_board() {
    _redis_check
    local entries; entries=$($REDIS LRANGE "$PFX:board" -30 -1 2>/dev/null)
    if [ -n "$entries" ]; then
        echo "=== Activity Stream (last 30) ==="
        echo "$entries"
    else
        echo "No activity yet."
    fi
}

cmd_merge() {
    local id; id=$(_require_id)
    local branch; branch=$(_branch)
    [ "$branch" = "main" ] && { echo "ERROR: Already on main."; exit 1; }
    _redis_check

    echo "=== Merging $branch to main ==="
    $REDIS PUBLISH "$PFX:broadcast" "$id: merging $branch to main" >/dev/null 2>&1 || true

    echo "[1/4] Rebasing onto main..."
    git fetch origin main 2>/dev/null || true
    git rebase main || { echo "ERROR: Rebase conflicts."; exit 1; }

    echo "[2/4] Running tests..."
    local fail=0
    if [ -d "$PROJECT_ROOT/backend" ]; then
        cd "$PROJECT_ROOT/backend"
        if ! PYTHONPATH="$PROJECT_ROOT/backend" python -m pytest tests/ -q --tb=line 2>/dev/null; then
            echo "FAIL: Backend tests"; fail=1
        fi
        cd "$PROJECT_ROOT"
    fi
    if [ -f "$PROJECT_ROOT/mobile/tsconfig.json" ]; then
        cd "$PROJECT_ROOT/mobile"
        if ! npx tsc --noEmit 2>/dev/null; then echo "FAIL: Mobile TS"; fail=1; fi
        cd "$PROJECT_ROOT"
    fi
    [ $fail -ne 0 ] && { echo "ERROR: Tests failed."; exit 1; }

    echo "[3/4] Merging..."
    git checkout main
    git merge --ff-only "$branch" || { echo "ERROR: Cannot FF."; git checkout "$branch"; exit 1; }

    echo "[4/4] Cleanup..."
    git branch -d "$branch"
    cmd_release "all" 2>/dev/null || true

    local now; now=$(_now)
    $REDIS RPUSH "$PFX:board" "[$now] $id: MERGED $branch to main" >/dev/null
    $REDIS PUBLISH "$PFX:broadcast" "$id: MERGED $branch to main" >/dev/null 2>&1 || true
    $REDIS HSET "$PFX:terminal:$id" status "idle" working_on "merge complete, picking next task" >/dev/null
    echo "SUCCESS: $branch merged to main."
}

cmd_sync() {
    local branch; branch=$(_branch)
    if [ "$branch" = "main" ]; then git pull origin main 2>/dev/null || true; return; fi
    git fetch origin main 2>/dev/null || true
    git rebase main && echo "Synced $branch onto main."
}

case "${1:-status}" in
    init)    cmd_init "${2:-}" ;;
    status)  cmd_status ;;
    claim)   cmd_claim "${2:-}" "${3:-}" ;;
    release) cmd_release "${2:-all}" ;;
    check)   cmd_check "${2:-}" ;;
    checkin) cmd_checkin "${*:2}" ;;
    msg)     cmd_msg "${*:2}" ;;
    read)    cmd_read ;;
    board)   cmd_board ;;
    merge)   cmd_merge ;;
    sync)    cmd_sync ;;
    *)       echo "Usage: $0 {init|status|claim|release|check|checkin|msg|read|board|merge|sync}"; exit 1 ;;
esac

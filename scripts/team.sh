#!/usr/bin/env bash
#
# team.sh — Multi-terminal coordination for RGDGC
#
# Untracked lockfile at .team-lock.json prevents file collisions.
# Pre-commit hook enforces branch discipline and claim ownership.
#
# Usage:
#   ./scripts/team.sh init <id>               # Register (e.g., t1, t2)
#   ./scripts/team.sh status                  # Show terminals + claims
#   ./scripts/team.sh claim <path> [desc]     # Claim a file/directory
#   ./scripts/team.sh release [path]          # Release claim (or all)
#   ./scripts/team.sh check <path>            # Who owns this?
#   ./scripts/team.sh checkin [message]       # Post status update
#   ./scripts/team.sh board                   # Recent activity log
#   ./scripts/team.sh merge                   # Merge branch to main (runs tests)
#   ./scripts/team.sh sync                    # Rebase onto latest main
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCKFILE="$PROJECT_ROOT/.team-lock.json"
BOARDFILE="$PROJECT_ROOT/.team-board.log"
IDENTITY_FILE="$PROJECT_ROOT/.terminal-id"

_ensure_lockfile() {
    [ -f "$LOCKFILE" ] || echo '{"terminals":{},"claims":{}}' > "$LOCKFILE"
}

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

cmd_init() {
    local id="${1:?Usage: team.sh init <id> (e.g., t1, t2)}"
    _ensure_lockfile
    echo "$id" > "$IDENTITY_FILE"
    local branch; branch=$(_branch)
    local now; now=$(_now)
    python3 -c "
import json
with open('$LOCKFILE') as f: data = json.load(f)
data['terminals']['$id'] = {'branch':'$branch','last_checkin':'$now','status':'active','working_on':'just started'}
with open('$LOCKFILE','w') as f: json.dump(data, f, indent=2)
print('Registered $id on $branch')
"
    echo "[$now] $id: init on $branch" >> "$BOARDFILE"
}

cmd_status() {
    _ensure_lockfile
    python3 -c "
import json
with open('$LOCKFILE') as f: data = json.load(f)
ts = data.get('terminals',{})
cs = data.get('claims',{})
if not ts: print('No terminals. Run: ./scripts/team.sh init <id>')
else:
    for tid,i in sorted(ts.items()):
        print(f\"  {tid} [{i.get('status','?')}] {i.get('branch','?')} — {i.get('working_on','?')}\")
if cs:
    print(f'\nClaims ({len(cs)}):')
    for p,i in sorted(cs.items()): print(f\"  {p} -> {i['terminal']} ({i.get('description','')})\")
else: print('\nNo file claims.')
"
}

cmd_claim() {
    local path="${1:?Usage: team.sh claim <path> [desc]}"
    local desc="${2:-}"
    local id; id=$(_require_id)
    _ensure_lockfile
    python3 -c "
import json, sys
with open('$LOCKFILE') as f: data = json.load(f)
claims = data.get('claims',{})
for cp,ci in claims.items():
    if ci.get('terminal') == '$id': continue
    if cp.startswith('$path') or '$path'.startswith(cp):
        print(f'CONFLICT: {cp} claimed by {ci[\"terminal\"]}')
        sys.exit(1)
claims['$path'] = {'terminal':'$id','claimed_at':'$(_now)','description':'$desc'}
data['claims'] = claims
with open('$LOCKFILE','w') as f: json.dump(data, f, indent=2)
print(f'Claimed $path -> $id')
"
    echo "[$(_now)] $id: claimed $path ($desc)" >> "$BOARDFILE"
}

cmd_release() {
    local path="${1:-all}"
    local id; id=$(_require_id)
    _ensure_lockfile
    python3 -c "
import json
with open('$LOCKFILE') as f: data = json.load(f)
cs = data.get('claims',{})
if '$path' == 'all':
    rm = [p for p,i in cs.items() if i.get('terminal')=='$id']
    for p in rm: del cs[p]
    print(f'Released {len(rm)} claims')
else:
    if '$path' in cs and cs['$path'].get('terminal')=='$id': del cs['$path']; print('Released $path')
    else: print('No claim on $path owned by $id')
data['claims'] = cs
with open('$LOCKFILE','w') as f: json.dump(data, f, indent=2)
"
    echo "[$(_now)] $id: released $path" >> "$BOARDFILE"
}

cmd_check() {
    local path="${1:?Usage: team.sh check <path>}"
    _ensure_lockfile
    python3 -c "
import json
with open('$LOCKFILE') as f: data = json.load(f)
found = False
for cp,ci in data.get('claims',{}).items():
    if cp.startswith('$path') or '$path'.startswith(cp):
        print(f'{cp} -> {ci[\"terminal\"]} ({ci.get(\"description\",\"\")})')
        found = True
if not found: print('$path: unclaimed')
"
}

cmd_checkin() {
    local message="${1:-still working}"
    local id; id=$(_require_id)
    local branch; branch=$(_branch)
    local now; now=$(_now)
    _ensure_lockfile
    python3 -c "
import json
with open('$LOCKFILE') as f: data = json.load(f)
t = data.setdefault('terminals',{}).setdefault('$id',{})
t['last_checkin']='$now'; t['branch']='$branch'; t['status']='active'; t['working_on']='''$message'''
with open('$LOCKFILE','w') as f: json.dump(data, f, indent=2)
"
    echo "[$now] $id ($branch): $message" >> "$BOARDFILE"
    echo "Checked in: $id — $message"
}

cmd_board() {
    [ -f "$BOARDFILE" ] && tail -30 "$BOARDFILE" || echo "No board entries yet."
}

cmd_merge() {
    local id; id=$(_require_id)
    local branch; branch=$(_branch)
    [ "$branch" = "main" ] && { echo "ERROR: Already on main."; exit 1; }

    echo "=== Merging $branch to main ==="

    echo "[1/4] Rebasing onto main..."
    git fetch origin main 2>/dev/null || true
    git rebase main || { echo "ERROR: Rebase conflicts. Fix, then git rebase --continue && ./scripts/team.sh merge"; exit 1; }

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
    [ $fail -ne 0 ] && { echo "ERROR: Tests failed. Fix before merging."; exit 1; }

    echo "[3/4] Fast-forward merge..."
    git checkout main
    git merge --ff-only "$branch" || { echo "ERROR: Cannot FF. Rebase first."; git checkout "$branch"; exit 1; }

    echo "[4/4] Cleanup..."
    git branch -d "$branch"
    cmd_release "all" 2>/dev/null || true
    echo "[$(_now)] $id: merged $branch to main" >> "$BOARDFILE"
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
    board)   cmd_board ;;
    merge)   cmd_merge ;;
    sync)    cmd_sync ;;
    *)       echo "Usage: $0 {init|status|claim|release|check|checkin|board|merge|sync}"; exit 1 ;;
esac

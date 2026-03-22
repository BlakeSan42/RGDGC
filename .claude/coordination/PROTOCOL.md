# Multi-Session Coordination Protocol

## How It Works
Multiple Claude Code terminal sessions coordinate through this shared filesystem.
Each session registers itself, claims tasks, posts updates, and reads messages from others.

## Directory Structure
```
.claude/coordination/
  PROTOCOL.md          ← You're reading it. Rules of engagement.
  board.md             ← Shared task board. Who's doing what.
  sessions/            ← One file per active session (heartbeat + status).
  messages/            ← Timestamped messages between sessions.
```

## Session Lifecycle

### 1. Register
On startup (or when told to coordinate), create a file in `sessions/`:
```
sessions/<session-name>.md    e.g., sessions/backend.md
```

Contents:
```markdown
---
name: <session-name>
role: <what this session focuses on>
started: <ISO timestamp>
last_heartbeat: <ISO timestamp>
status: active
---
Currently working on: <brief description>
Blocked by: <nothing | description>
Can help with: <capabilities>
```

### 2. Heartbeat
Update `last_heartbeat` and `Currently working on` whenever you complete a significant task.
Sessions with heartbeats older than 30 minutes may be considered inactive.

### 3. Claim Tasks
Check `board.md` for unclaimed tasks. To claim one:
- Change its status from `unclaimed` to `claimed:<your-session-name>`
- Update your session file

### 4. Post Messages
Create a file in `messages/` for cross-session communication:
```
messages/<timestamp>-<from>-to-<to>.md
```

Example: `messages/20260322-1400-backend-to-mobile.md`

Contents:
```markdown
---
from: backend
to: mobile (or "all")
priority: normal (or "high" or "blocking")
read_by: []
---
<message content>
```

### 5. Check Messages
Before starting new work, scan `messages/` for anything addressed to you or "all".
After reading, add your session name to `read_by`.

## Board Format (board.md)
```markdown
## Active Sprint

### Task Name
- status: unclaimed | claimed:<session> | in_progress:<session> | done:<session> | blocked
- priority: P0 | P1 | P2
- depends_on: [other task names]
- notes: <context>
```

## Rules
1. **Don't edit another session's files** — only your own session file and messages you author.
2. **Claim before working** — prevents duplicate effort.
3. **Post blockers immediately** — if you need something from another session, message them.
4. **Keep board.md updated** — it's the source of truth for project status.
5. **Each session can launch its own subagents** — but track what they're doing in your session file.
6. **Small, frequent updates > big batches** — update heartbeat often.

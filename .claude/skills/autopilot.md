---
name: autopilot
description: Start autonomous work — read the roadmap, claim the next task, execute, repeat
---

# Autopilot Mode

## When to use
When Blake says "go", "autopilot", "keep building", "do your thing", or starts a session without specific instructions.

## Steps

### 1. Orient
Read these files to understand current state:
- `.claude/coordination/roadmap.md` — what needs to be built (priority order)
- `.claude/coordination/board.md` — what's claimed and by whom
- `.claude/coordination/sessions/` — who's active right now
- `.claude/coordination/messages/` — any pending messages

### 2. Identify
Find the highest-priority **unclaimed** task from the roadmap that:
- No other active session has claimed
- Doesn't depend on a blocked task
- Matches your capabilities (any session can do anything, but specialize if possible)

### 3. Claim
Update `board.md`:
```markdown
### [Task Name]
- status: claimed:<your-session-name>
- priority: [from roadmap]
- started: [ISO timestamp]
```

Register yourself in `sessions/` if not already registered.

### 4. Execute
Do the work:
- Read relevant code before modifying
- Run tests after changes (`make test` for backend, `npx tsc --noEmit` for mobile)
- Commit after each logical unit with clear messages
- Update your session heartbeat periodically

### 5. Complete
- Mark task done on `board.md`
- Update `roadmap.md` (strikethrough completed task, add notes)
- Post a message in `messages/` if others depend on this work
- **Loop back to step 2** — pick the next task

### 6. Report
After completing 1-3 tasks (or if blocked), give Blake a brief status:
```
## Autopilot Status
| Task | Result |
|------|--------|
| [task] | Done / Blocked / In Progress |

**Next up:** [next task from roadmap]
```

## Key Principle
**Don't stop. Don't ask. The roadmap is your instructions.** Only pause for:
- Destructive operations (production deploy, data deletion)
- Ambiguous architecture decisions not covered by CLAUDE.md
- Blake saying "stop" or "pause"

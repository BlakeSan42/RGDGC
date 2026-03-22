# Autopilot Protocol
> How sessions operate autonomously without waiting for human instructions.

## Trigger
Any session can enter autopilot mode when:
- Blake says "go", "autopilot", "keep building", "do your thing", or similar
- A session starts and Blake doesn't give specific instructions
- The `/autopilot` skill is invoked

## Decision Loop

```
┌─────────────────────────────────┐
│  1. READ ROADMAP                │
│     .claude/coordination/       │
│     roadmap.md                  │
└───────────────┬─────────────────┘
                │
┌───────────────▼─────────────────┐
│  2. CHECK BOARD                 │
│     board.md — what's claimed?  │
│     sessions/ — who's active?   │
└───────────────┬─────────────────┘
                │
┌───────────────▼─────────────────┐
│  3. CHECK MESSAGES              │
│     messages/ — any blockers?   │
│     Any requests from others?   │
└───────────────┬─────────────────┘
                │
┌───────────────▼─────────────────┐
│  4. PICK HIGHEST UNCLAIMED TASK │
│     From roadmap priority queue │
│     Claim it on board.md        │
└───────────────┬─────────────────┘
                │
┌───────────────▼─────────────────┐
│  5. EXECUTE                     │
│     Do the work. Commit often.  │
│     Update heartbeat.           │
└───────────────┬─────────────────┘
                │
┌───────────────▼─────────────────┐
│  6. COMPLETE                    │
│     Mark done on board.md       │
│     Update roadmap.md           │
│     Post completion message     │
│     → Loop back to step 1       │
└─────────────────────────────────┘
```

## Rules

### What to do
- **Always pick the highest-priority unclaimed task** from the roadmap
- **Claim before working** — update board.md first
- **Commit after each logical unit** — small, frequent commits
- **Update roadmap.md** when you complete or learn something that changes priorities
- **Post messages** when you finish something others depend on
- **Run tests** after making changes — never leave tests broken
- **Be honest in status** — if something is harder than expected, note it

### What NOT to do
- **Don't ask Blake what to do** — the roadmap tells you
- **Don't work on P2 tasks when P0 tasks are unclaimed**
- **Don't touch another session's claimed work**
- **Don't deploy to production** without explicit approval
- **Don't modify KSA-Research/** — private/confidential
- **Don't skip tests** — run `make test` after backend changes
- **Don't break what's working** — verify existing tests still pass before committing

### Conflict resolution
- If two sessions could work on the same area, the one that claimed first wins
- If you need something from a blocked task, post a message and move to the next task
- If the roadmap is unclear, check CLAUDE.md for architecture decisions
- If a task turns out to be much larger than expected, break it into subtasks on board.md

## Session Specialization

Sessions should self-assign based on what they're best at:

| If you see these files changing... | You're probably... | Focus on... |
|------------------------------------|--------------------|-------------|
| `backend/` | Backend session | API, DB, tests, deployment |
| `mobile/` | Mobile session | Screens, components, native features |
| `admin-dashboard/` | Frontend session | Admin pages, API integration |
| `contracts/`, `mcp-server/` | Infrastructure session | Blockchain, MCP, CI/CD |
| `openclaw-skills/` | Bot session | Skills, integrations, chat |

But any session can work on anything unclaimed.

## Progress Reporting

After completing a task, update the roadmap with a one-line status:
```markdown
1. ~~**Deploy contracts to Sepolia testnet**~~ — DONE (2026-03-23, session: backend-1)
```

## Emergency Stop

If Blake says "stop", "pause", "hold", or "wait" — immediately stop autonomous work, report current status, and wait for instructions.

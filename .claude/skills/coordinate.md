---
name: coordinate
description: Check in with other Claude Code sessions, read/post messages, claim tasks from the shared board
---

# Multi-Session Coordination

## When to use
When the user says "coordinate", "check in", "sync up", or "what are the others doing".

## Steps

### 1. Read the protocol
Read `.claude/coordination/PROTOCOL.md` for rules.

### 2. Check who's active
Read all files in `.claude/coordination/sessions/` to see which sessions are registered and what they're working on. Sessions with `last_heartbeat` older than 30 minutes are likely inactive.

### 3. Read the board
Read `.claude/coordination/board.md` to see task status — what's unclaimed, claimed, in progress, done, or blocked.

### 4. Check messages
Read all files in `.claude/coordination/messages/` for anything addressed to your session name or "all". Update `read_by` after reading.

### 5. Register or update yourself
Create or update your session file in `.claude/coordination/sessions/<your-name>.md` with:
- What you're currently working on
- What you're blocked by (if anything)
- What you can help with
- Current timestamp as `last_heartbeat`

### 6. Report to user
Summarize:
- Who's active and what they're doing
- Any messages for this session
- Board status (what's done, what's in flight, what's unclaimed)
- Suggested next task to claim

### 7. Claim work if directed
If the user says to pick up work, claim an unclaimed task on `board.md` by changing its status to `claimed:<your-session-name>`.

## Posting messages to other sessions
Create a file: `.claude/coordination/messages/<timestamp>-<from>-to-<to>.md`
Use frontmatter: from, to, priority, read_by.

## Launching subagents
Each session can launch its own subagents for parallel work. Track what they're doing in your session file under "Active subagents:".

## Key principle
**Claim before working. Update often. Post blockers immediately.**

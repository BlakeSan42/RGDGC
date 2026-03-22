# RGDGC Sprint Board — 2026-03-22

## Goal
Get the platform running end-to-end today: backend serving data, mobile app booting with real screens, admin dashboard scaffolded.

---

## Active Sprint

### Scaffold Admin Dashboard
- status: in_progress:terminal-3
- priority: P1
- depends_on: []
- notes: Agent building React + Vite + Tailwind project with pages, sidebar, API client. Running now.

### Build Mobile Putting Practice
- status: unclaimed
- priority: P1
- depends_on: []
- notes: Log putts, see probability, track C1/C1X/C2. Uses /api/v1/putting/* endpoints.

---

## Completed

### Fix 2 Failing Backend Integration Tests
- status: done:terminal-2
- notes: Fixed PuttingStats schema (by_distance→by_zone), fixed timezone-aware datetime in complete_round. 41/41 passing.

### Mobile npm install + Type Check
- status: done:terminal-2
- notes: Removed nativewind dependency, tsc --noEmit passes clean.

### MCP Server Build Verification
- status: done:terminal-2
- notes: npm install + tsc build — zero errors, dist/ output created.

### Build Mobile Scoring Flow
- status: done:terminal-2
- notes: 3 screens (select-course → select-layout → scorecard). Hole-by-hole entry with +/- buttons, quick score buttons, hole navigator, score badges, auto-submit, complete round.

### Generate Alembic Migration
- status: done:terminal-3
- notes: 474298be8931_initial_schema.py — all 15 tables. Added missing disc model imports. Stamped head.

### Fix health-check.sh
- status: done:terminal-3
- notes: Removed nonexistent containers, fixed ports to 5433/6381/8001, added fallback pg_isready. 6/6 passing.

### Spin Up Backend + DB
- status: done:terminal-2
- notes: PostgreSQL on 5433, Redis on 6381, FastAPI on 8001. All running.

### Create Seed Data Script
- status: done:terminal-2

### Build Mobile Navigation
- status: done:terminal-2

### Build Mobile Screens — Play/League/Stats/Profile
- status: done:terminal-2

### Wire MCP to Live Backend
- status: done:terminal-2

### CLAUDE.md + Infrastructure
- status: done:terminal-2

### GitHub Repo + Initial Commit
- status: done:terminal-2
- notes: https://github.com/BlakeSan42/RGDGC

---

## Backlog
- OpenClaw bot skills implementation
- AR distance measurement (ARKit/ARCore)
- Disc golf game engine (flight physics)
- NFT disc tracking (QR stickers)
- Blockchain smart contract deployment
- Push notifications
- Offline mode + sync

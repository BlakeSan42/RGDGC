---
name: terminal-4
role: QA Lead — backend verification, end-to-end testing, dispatch coordination
started: 2026-03-22T16:30:00-05:00
last_heartbeat: 2026-03-22T16:30:00-05:00
status: active
---

Currently working on: Backend workstream — making the API actually run end-to-end

Blocked by: nothing

Can help with: Backend fixes, API testing, integration verification, coordination

## Workstream: Terminal 1 (Backend)
1. Fix missing qrcode dependency ✅
2. Fix Alembic migrations (stubs → real)
3. Verify backend starts, all routes load
4. Smoke test all API route groups
5. Seed database with River Grove DGC course data
6. Verify health check script passes

## Dispatch Plan for Other Terminals

### Terminal 2 (Mobile) — UNCLAIMED
1. Install missing deps: expo-auth-session, expo-apple-authentication, expo-location, expo-notifications
2. Fix all TypeScript errors (readonly state in putting practice, missing imports)
3. npx expo start → verify loads on simulator
4. Walk critical path: Play → Start Round → Select Course → Layout → Scorecard → Complete
5. Verify Stats, League, Profile tabs render with API data
6. Chat tab — wire or add "coming soon" state

### Terminal 3 (Integration) — UNCLAIMED
1. Deploy contracts to Sepolia testnet
2. Wire contract addresses into backend config + admin Treasury page
3. Test MCP server against live backend — all 9 tools
4. Run CI pipeline — fix lint/type/test failures
5. End-to-end smoke: mobile round → backend → admin → MCP
6. Verify admin dashboard shows real data (not mock fallbacks)

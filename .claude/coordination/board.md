# RGDGC Sprint Board — 2026-03-22 (Updated Evening)

## Current Sprint Goal
Get to production: Railway deploy, Expo production build, OpenClaw bot live.

---

## Completed This Sprint (All Phases)

### Phase A — Sticker System: COMPLETE
- generate_disc_codes.py moved to scripts (T3)
- Sticker backend: 6 endpoints live (T3)
- Mobile Sticker Claim Screen: 3-step flow (T2)

### Phase B — Geo/Mapping: COMPLETE
- PostGIS enabled, GeoAlchemy2 installed (T3)
- Geo fields on Course/Hole models (T3)
- 3 GeoJSON API endpoints live (T3)
- @rnmapbox/maps + CourseMap component (T3 + T2)
- 55 holes seeded with real GPS coordinates (T3)
- Weather.gov API: /current + /wind endpoints (T2)

### Phase C — Backend QA: COMPLETE
- All route groups verified (T4)
- Missing deps fixed (T4)
- Alembic migrations fixed (T4)
- Disc route double prefix fixed (T4)

### Phase D — Contracts & Blockchain: COMPLETE
- Contracts deployed to Sepolia (commit 14d855f)
- 3 contracts: RGDGToken, RGDGTreasury, DiscRegistry
- verify.ts, setup-testnet.ts, wire-backend.ts all executed
- Backend blockchain service wired to live contract addresses
- Web3 auth (nonce + verify), token balance, treasury, fee verification

### Phase E — Admin Dashboard: COMPLETE
- 11 pages wired to live API (no mock data)
- Sticker management page (stats, generate, lookup, inventory, claims)
- Admin endpoint fixes (query params to JSON body)

### Phase F — Mobile Polish: COMPLETE
- Offline sync: OfflineBanner, course/layout caching, offline round starts
- Push notifications: token registration, routing, unread badges
- Score editing, group play, scorecard sharing
- 39 screens, 0 TypeScript errors

### Phase G — Backend Features: COMPLETE
- Redis caching layer (cache_service.py)
- Stats service (scoring breakdown, personal bests)
- Auto handicap calculation
- Owner control system (/api/v1/owner/*)
- Putting model recalibrated
- Events and results seeded
- KSA module (439 lines, added by another terminal)
- OpenClaw bot: 7 skills done, all API calls verified

### Cross-Terminal
- MCP server: 9/9 tools verified (T2)
- CI pipeline: fixed PostGIS, admin-dashboard check, peer deps (T2)
- Location fix: IL to Kingwood TX with real UDisc data (T2)
- End-to-end smoke test passing (T2 + T4)
- Google OAuth, chat bot, disc management, notifications (T3)

---

## E2E Validation — 88+ TESTS PASSING (0 API bugs)
- 12 complete user journeys tested live against running backend
- Auth: register, login, logout, token revocation
- Scoring: start round, submit holes, complete
- Putting: log, batch sync, stats, probability, strokes gained
- Leagues: list, join, members, leaderboard
- Events: list, detail, results
- Discs: register, QR, lost/found/returned, public HTML
- Chat: standings, events, rules, help
- Admin: analytics, announcements, audit log, cache
- Geo: GeoJSON, weather, wind
- Blockchain: balance, transactions, treasury

---

## Active / Unclaimed Work

### P0 — Ship Blockers (next up)

| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| Backend → Railway deploy | Unclaimed | — | Procfile exists, need env vars + deploy |
| Mobile → Expo production build | Unclaimed | — | EAS config needed, production API URL |
| OpenClaw bot → Go live | Unclaimed | — | Needs Discord bot token + Anthropic API key |

### P1 — Core Gaps

| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| USGS 3DEP DEM for Kingwood TX | Unclaimed | — | 1m resolution bare-earth DEM |
| Harris County LIDAR via TNRIS | Unclaimed | — | Tree canopy height model |
| Celery background tasks | Unclaimed | — | Reminders, batch sync, leaderboard recalc |

---

## Backlog (P2/P3)
- AR distance measurement (ARKit/ARCore)
- Disc golf game engine (flight physics)
- 3D terrain rendering (Mapbox v11)
- Drone orthomosaic pipeline (PMTiles → R2)
- Apple Watch / Wear OS companion
- Stripe payment integration
- Course builder
- Tournament mode (online multiplayer)

# RGDGC Master Roadmap
> **Last updated:** 2026-03-22 (evening)
> **Source of truth** for what needs to be built next. Any session can read this and start working.

## Current Milestone: MVP Launch-Ready
**Goal:** Every component deployable and tested end-to-end.

---

## Status Summary

| Component | Completion | Deployable? | Notes |
|-----------|-----------|-------------|-------|
| Backend API | 95% | Yes (Railway) | 88+ tests passing, 18 route groups, cache service, KSA module, stats service |
| Mobile App | 65% | Yes (Expo Go) | 39 screens, 0 TS errors, scoring/offline/push all wired |
| Admin Dashboard | 75% | Yes (Vercel) | 11 pages, wired to live API, sticker mgmt, treasury |
| MCP Server | 100% | Yes (local) | 9/9 tools verified |
| Smart Contracts | 100% | Deployed (Sepolia) | 3 contracts live, verified, addresses in deployments.json |
| OpenClaw Bot | 80% | Needs tokens | 7 skills done, API calls verified, needs Discord/Anthropic keys |
| CI/CD | 80% | Yes | 4 jobs green, deploy workflow exists |

---

## What's Been Done (Completed Items)

### Ship Blockers — ALL CLEARED
- [x] **Deploy contracts to Sepolia testnet** — DONE (commit 14d855f)
  - RGDGToken: `0x91c4...A92F`, Treasury: `0x0E9E...21B4`, DiscRegistry: `0x7ebC...72bf`
  - Deploy, verify, setup-testnet, wire-backend scripts all executed
- [x] **Wire admin dashboard to live API** — DONE
  - 11 pages: Dashboard, Events, Leagues, Players, PlayerDetail, EventDetail, DiscRegistry, Treasury, Stickers, ClubSettings, Login
  - Removed all mock/hardcoded data
- [x] **Fix mobile web build (expo-auth-session ESM crash)** — DONE
- [x] **Offline sync integration** — DONE
  - OfflineBanner, course/layout caching, offline round starts, sync page
- [x] **Push notifications** — DONE
  - Push token registration, notification routing, unread badges
- [x] **OpenClaw bot skills** — DONE (7 skills)
  - course-info, disc-lookup, event-checkin, rules, standings, stats, weather
  - All 5 core API calls verified against live backend
- [x] **Redis caching layer** — DONE
  - cache_service.py, caching on leaderboards, courses, putting, events, leagues
- [x] **Blockchain backend integration** — DONE
  - Web3 auth (nonce + verify), token balance, treasury stats, fee verification
  - blockchain_service.py wired to deployed contract addresses
- [x] **Score editing, group play, scorecard sharing** — DONE
  - scoring/scorecard.tsx with sharing support
- [x] **Stats service** — DONE
  - Scoring breakdown, personal bests, stats_service.py
- [x] **Auto handicap calculation** — DONE
  - Calculated on round completion via rounds.py
- [x] **Owner control system** — DONE
  - /api/v1/owner/* (hidden from Swagger), two-factor auth, impersonate, lock/unlock
- [x] **Sticker management admin page** — DONE
  - Stats overview, generate batch, code lookup, batch inventory, recent claims
- [x] **Putting model recalibrated** — DONE
- [x] **Events and results seeded** — DONE
- [x] **KSA module** — DONE (439 lines, added by another terminal)
- [x] **Admin endpoint fixes** — DONE (query params to JSON body)
- [x] **88+ API endpoint tests passing** — DONE (12 user journeys, E2E validated)

### Previously Completed
- [x] Sticker system backend (6 endpoints) + mobile claim screen
- [x] PostGIS + GeoAlchemy2 + GeoJSON endpoints + CourseMap component
- [x] 55 holes seeded with real GPS coordinates
- [x] Weather.gov API integration (/current + /wind)
- [x] All backend route groups verified, deps fixed, migrations fixed
- [x] MCP server 9/9 tools verified
- [x] CI pipeline fixes (PostGIS, admin-dashboard check, peer deps)
- [x] Location correction: IL to Kingwood TX with real UDisc data
- [x] Google OAuth, chat bot, disc management, notifications

---

## Priority Queue (Pick from top)

### P0 — Remaining Ship Blockers

1. **Backend → Railway deployment**
   - Verify Procfile/railway.json config
   - Set production env vars (DATABASE_URL, REDIS_URL, SECRET_KEY, CORS_ORIGINS)
   - Deploy and run health check
   - _Files:_ `backend/Procfile`, `backend/railway.json`, `.github/workflows/deploy.yml`

2. **Mobile → Expo production build**
   - Configure EAS build profiles
   - Set production API URL
   - Test on physical device via Expo Go
   - _Files:_ `mobile/eas.json`, `mobile/app.json`, `mobile/.env`

3. **OpenClaw bot → Go live**
   - Set Discord bot token + Anthropic API key in `.env`
   - Deploy to Railway or Fly.io
   - _Files:_ `clawd-bot/.env`, `clawd-bot/Dockerfile`

### P1 — Core Feature Gaps

4. **USGS 3DEP DEM for Kingwood TX**
   - Fetch 1m resolution bare-earth DEM
   - Process into elevation profiles for course holes
   - Script exists: `scripts/fetch_elevation.py`

5. **Harris County LIDAR via TNRIS**
   - Tree canopy height model for AR obstacle data
   - Download from TNRIS DataHub for Harris County

6. **Celery background tasks**
   - Event reminder emails/push
   - Batch putt sync processing
   - Leaderboard recalculation
   - _Files:_ `backend/app/tasks/`

### P2 — Enhancement Layer

7. **AR distance measurement (ARKit/ARCore)**
   - React Native AR module integration
   - Point-to-point distance measurement
   - Putting overlay with probability display
   - _Files:_ `mobile/src/features/ar/`

8. **Disc golf game engine**
   - Flight physics (speed/glide/turn/fade)
   - Quick Round mode first
   - Career mode progression
   - _Files:_ `mobile/src/features/game/`

### P3 — Polish & Scale

9. 3D terrain rendering (Mapbox v11)
10. Drone orthomosaic pipeline (PMTiles → R2)
11. Apple Watch / Wear OS companion
12. Stripe payment integration for league fees
13. Course builder (user-created courses)
14. Tournament mode (online multiplayer)

---

## MVP Success Criteria — Verification

### 1. "A player can download the app, create an account, and score a round"
**Status: MOSTLY VERIFIED (90%)**
- Auth: register, login, logout, token revocation — all tested E2E
- Scoring: start round, select course/layout, submit hole scores, complete round — all tested E2E
- Mobile screens exist: auth flow (3 screens), course selection, layout selection, scorecard, round detail
- Offline scoring works with sync
- **Gap:** Not yet tested as a production Expo build on a physical device. Expo Go works. Need EAS build + production API URL to fully verify the "download the app" part.

### 2. "League standings are accurate and update after events"
**Status: VERIFIED (95%)**
- Points calculation tested (field_size rule, ties, DNF/DQ = 0 points, drop_worst)
- Leaderboard endpoint verified via E2E tests
- Events with results seeded and standings confirmed accurate
- Redis caching on leaderboards with TTL invalidation
- **Gap:** Not verified with a full season of real data. Logic is tested with seed data.

### 3. "Admin can create events, enter results, and view analytics"
**Status: VERIFIED (95%)**
- Admin dashboard: 11 pages wired to live API (no mock data)
- Event management, result submission, analytics dashboard all functional
- Admin endpoints tested: analytics, announcements, audit log, cache clear
- Sticker management, treasury dashboard, player/league management all live
- **Gap:** Admin endpoint fixes were recent (query params to JSON body) — should re-run admin E2E after those changes.

### 4. "MCP server answers club questions via Claude"
**Status: VERIFIED (100%)**
- 9/9 tools tested and working: get_leaderboard, get_player_stats, get_upcoming_events, get_event_results, lookup_rule, get_course_info, calculate_handicap, get_player_rounds, get_event_checkins

### 5. "Smart contracts deployed on testnet"
**Status: VERIFIED (100%)**
- 3 contracts deployed to Sepolia (commit 14d855f)
- Addresses recorded in deployments.json
- Backend blockchain service wired to contract addresses

### 6. "CI/CD deploys automatically on push to main"
**Status: PARTIALLY VERIFIED (70%)**
- CI pipeline runs (4 jobs green)
- Deploy workflow exists but Railway deployment not yet executed
- Need to verify the actual auto-deploy on push to main works end-to-end

---

## Honest Pillar Assessment

| Pillar | Completion | Notes |
|--------|-----------|-------|
| Disc Golf Game | 5% | No game engine exists yet. This is all P2/P3. Mobile app handles real-world scoring, not a playable game. |
| Putting Analytics | 85% | Model calibrated, probability endpoint, strokes gained, batch sync, stats — all working. Missing AR overlay. |
| AR Training | 0% | Not started. Requires ARKit/ARCore native modules. |
| League Management | 90% | Events, scoring, standings, prizes, points calc all done. Missing Stripe/crypto payments for fees. |
| AI Assistant | 90% | MCP server 100%. OpenClaw bot 80% (needs Discord token to go live). |

---

## How to Use This File

**Starting a new session?** Read this file. Pick the highest-priority unclaimed task. Check `board.md` to make sure nobody else claimed it. Update `board.md` with your claim. Start working.

**Finishing a task?** Update this file (mark complete, add notes). Update `board.md`. Commit your work.

**Blocked?** Post a message in `.claude/coordination/messages/` and move to the next task.

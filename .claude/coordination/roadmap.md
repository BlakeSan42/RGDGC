# RGDGC Master Roadmap
> **Last updated:** 2026-03-22
> **Source of truth** for what needs to be built next. Any session can read this and start working.

## Current Milestone: MVP Launch-Ready
**Goal:** Every component deployable and tested end-to-end.

---

## Status Summary

| Component | Completion | Deployable? | Notes |
|-----------|-----------|-------------|-------|
| Backend API | 90% | Yes (Railway) | 96/97 tests, 13 route groups |
| Mobile App | 60% | Yes (Expo Go) | 36 screens, 0 TS errors, scoring flow works |
| Admin Dashboard | 50% | Yes (Vercel) | 8 pages, uses mock fallback data |
| MCP Server | 100% | Yes (local) | 9/9 tools verified |
| Smart Contracts | 100% | Ready (Sepolia) | 3 contracts, tested, deploy script ready |
| OpenClaw Bot | 5% | No | Skeleton only |
| CI/CD | 80% | Yes | 4 jobs green, deploy workflow exists |

---

## Priority Queue (Pick from top)

### P0 — Ship Blockers (do these first)

1. **Deploy contracts to Sepolia testnet**
   - Run `npx hardhat run scripts/deploy.ts --network sepolia`
   - Verify on Etherscan via `scripts/verify.ts`
   - Run `scripts/setup-testnet.ts` for initial config
   - Run `scripts/wire-backend.ts` to get env vars
   - Update backend .env with contract addresses
   - _Files:_ `contracts/scripts/`, `backend/.env`

2. ~~**Wire admin dashboard to live API**~~ — DONE (2026-03-22)
   - Dashboard: added `/admin/activity` and `/admin/analytics/weekly-rounds` backend endpoints
   - Dashboard: expanded `/analytics/dashboard` to return growth metrics
   - Removed all mock/hardcoded data from Dashboard.tsx and TreasuryDashboard.tsx
   - Linter added loading states, error banners, and retry buttons

3. **Backend → Railway deployment**
   - Verify Procfile/railway.json config
   - Set production env vars (DATABASE_URL, REDIS_URL, SECRET_KEY, CORS_ORIGINS)
   - Deploy and run health check
   - _Files:_ `backend/Procfile`, `backend/railway.json`, `.github/workflows/deploy.yml`

4. ~~**Fix mobile web build (expo-auth-session ESM crash)**~~ — DONE (2026-03-22)
   - Created platform-specific `useGoogleAuth.ts` (native) / `useGoogleAuth.web.ts` (stub)
   - All 3 auth screens now use shared hook instead of direct expo-auth-session imports
   - Web bundle no longer crashes on Node 22+; 0 TS errors

5. **Mobile → Expo production build**
   - Configure EAS build profiles
   - Set production API URL
   - Test on physical device via Expo Go
   - _Files:_ `mobile/eas.json`, `mobile/app.json`, `mobile/.env`

### P1 — Core Feature Gaps

5. ~~**Offline sync integration**~~ — DONE (2026-03-22)
   - OfflineBanner integrated into root layout (slides down when offline)
   - select-course.tsx: caches courses on fetch, falls back to cache when offline
   - select-layout.tsx: caches layouts, allows starting round offline (roundId="offline")
   - Profile tab: added "Sync & Offline" nav link to sync page
   - Scoring/putting flows already had offline save — this wired the UI layer

6. ~~**Push notifications**~~ — DONE (2026-03-22)
   - useNotifications hook: now sends Expo push token to backend via `POST /users/me/push-token`
   - Root layout: auto-registers push on authenticated mount, notification tap routing
   - Tab bar: real unread badge (lights up on foreground notification, clears on tap)
   - Added `userApi.registerPushToken()` to mobile API service
   - Backend was already complete (event results, announcements trigger push)

7. ~~**OpenClaw bot — verified against live backend**~~ — DONE (2026-03-22)
   - Fixed 5 API endpoint mismatches (players→users, disc lookup path, course list, leaderboard wrapping, events wrapping)
   - All 5 core API calls verified: course info, leaderboard, events, disc lookup, rules
   - Formatters produce clean Discord markdown output with real data
   - Bot imports cleanly, venv created, deps installed
   - Needs: Discord bot token + Anthropic API key in `.env` to go live

8. **USGS 3DEP DEM for Kingwood TX**
   - Fetch 1m resolution bare-earth DEM
   - Process into elevation profiles for course holes
   - Script exists: `scripts/fetch_elevation.py`
   - _Files:_ `scripts/`, `backend/app/services/`

9. **Harris County LIDAR via TNRIS**
   - Tree canopy height model for AR obstacle data
   - Download from TNRIS DataHub for Harris County
   - Process into usable format for course overlays
   - _Files:_ `scripts/`, data stored in S3/R2

### P2 — Enhancement Layer

10. **Redis caching layer**
    - Cache leaderboard, course data, player stats
    - TTL-based invalidation on score submission
    - _Files:_ `backend/app/core/cache.py`, `backend/app/api/v1/`

11. **Celery background tasks**
    - Event reminder emails/push
    - Batch putt sync processing
    - Leaderboard recalculation
    - _Files:_ `backend/app/tasks/`

12. **Blockchain backend integration**
    - Wire deployed contract addresses to backend endpoints
    - Test pay-fee, balance, transactions flows
    - _Files:_ `backend/app/api/v1/blockchain.py`, `backend/app/services/`

13. **AR distance measurement (ARKit/ARCore)**
    - React Native AR module integration
    - Point-to-point distance measurement
    - Putting overlay with probability display
    - _Files:_ `mobile/src/features/ar/`

14. **Disc golf game engine**
    - Flight physics (speed/glide/turn/fade)
    - Quick Round mode first
    - Career mode progression
    - _Files:_ `mobile/src/features/game/`

### P3 — Polish & Scale

15. **3D terrain rendering** (Mapbox v11)
16. **Drone orthomosaic pipeline** (PMTiles → R2)
17. **Apple Watch / Wear OS companion**
18. **Stripe payment integration** for league fees
19. **Course builder** (user-created courses)
20. **Tournament mode** (online multiplayer)

---

## Objective Definitions

### Five Pillars (from CLAUDE.md)
1. **Disc Golf Game** — Playable mobile game with physics, career mode, 8 game modes
2. **Putting Analytics** — Physics model, player fitting, strokes gained
3. **AR Training** — Distance measurement, putting overlay, stance guide
4. **League Management** — Events, scoring, standings, prizes, payments
5. **AI Assistant** — OpenClaw bot + Claude MCP server

### Success Criteria for MVP
- [ ] A player can download the app, create an account, and score a round
- [ ] League standings are accurate and update after events
- [ ] Admin can create events, enter results, and view analytics
- [ ] MCP server answers club questions via Claude
- [ ] Smart contracts deployed on testnet
- [ ] CI/CD deploys automatically on push to main

---

## How to Use This File

**Starting a new session?** Read this file. Pick the highest-priority unclaimed task. Check `board.md` to make sure nobody else claimed it. Update `board.md` with your claim. Start working.

**Finishing a task?** Update this file (mark complete, add notes). Update `board.md`. Commit your work.

**Blocked?** Post a message in `.claude/coordination/messages/` and move to the next task.

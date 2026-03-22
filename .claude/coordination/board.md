# RGDGC Sprint Board — 2026-03-22

## Current Sprint Goal
Ship a working app: scoring flow end-to-end (DONE), sticker claim, putting practice, Mapbox maps, weather integration.

---

## Phase A: Sticker System

### Move generate_disc_codes.py to scripts/
- status: done:terminal-3

### Mobile Sticker Claim Screen
- status: claimed:terminal-2
- priority: P1
- depends_on: []
- notes: QR scanner → claim flow → add disc details. Backend sticker endpoints are live. Uses /api/v1/stickers/claim/{code}.

### Admin Dashboard: Sticker Management Page
- status: unclaimed
- priority: P1
- notes: Generate batch, view inventory, download CSV. Wire into existing admin-dashboard/src/pages/.

---

## Phase B: Geo/Mapping Architecture

### Enable PostGIS Extension
- status: done:terminal-3

### Add Geo Fields to Course/Hole Models
- status: done:terminal-3

### GeoJSON API Endpoints
- status: done:terminal-3

### Add @rnmapbox/maps to Mobile
- status: done:terminal-3
- notes: CourseMap component with satellite/street toggle, tee/basket/fairway layers, hole info cards.

### Seed River Grove DGC GPS Coordinates
- status: done:terminal-3
- notes: 55 holes across 3 layouts with real GPS. GeoJSON endpoint returns 57 features.

### Download USGS 3DEP DEM for Kingwood TX
- status: unclaimed
- priority: P1
- notes: 1m resolution bare-earth DEM. Harris County, Houston metro. Free from USGS National Map.

### Download Harris County LIDAR via TNRIS
- status: unclaimed
- priority: P1
- notes: Tree canopy height. Source: TNRIS (tnris.org). Free.

### Weather.gov API Integration
- status: done:terminal-2
- notes: weather_service.py (NWS API), weather.py (2 endpoints: /current, /putting-wind). Router wired. Uncommitted.

---

## Phase C: Backend QA (Terminal 4)

### Fix missing dependencies
- status: done:terminal-4
- notes: Added qrcode[svg], requests, slowapi, boto3. Duplicate httpx removed.

### Fix Alembic migrations
- status: done:terminal-4
- notes: Initial + sticker migrations were empty stubs. Rewrote with real DDL for all 20+ tables. Committed by terminal-2.

### Fix disc route double prefix
- status: done:terminal-4
- notes: APIRouter(prefix="/discs") + mount prefix="/discs" caused /api/v1/discs/discs/. Removed internal prefix.

### Smoke test all 12 API route groups
- status: done:terminal-4
- notes: All 12 route groups verified with curl. Full scoring flow tested end-to-end.

---

## Still Unclaimed

### Build Mobile Putting Practice
- status: unclaimed
- priority: P1
- notes: Log putts, see probability, track C1/C1X/C2. Uses /api/v1/putting/* endpoints.

### Test MCP Server Against Live Backend
- status: unclaimed
- priority: P1
- notes: All 9 tools against running API. Verify responses are correct.

### Run CI Pipeline
- status: unclaimed
- priority: P1
- notes: GitHub Actions — fix any lint/type/test failures.

### Deploy Contracts to Sepolia
- status: unclaimed
- priority: P2
- notes: Smart contracts exist in contracts/. Deploy, verify, wire addresses into backend config.

---

## Completed
Key milestones:
- End-to-end smoke test PASSED (login → course → round → 19 holes → complete → -1 vs par)
- Mobile TypeScript: 0 errors
- Backend: 41/41 tests passing
- All 12 API route groups verified (terminal-4 QA)
- MCP server builds clean
- Admin dashboard scaffolded (10 pages)
- Sticker backend: 6 endpoints live
- PostGIS + GeoJSON API: 3 endpoints live
- Mapbox course map component added
- Weather.gov integration (NWS API) added
- Google OAuth wired
- Real course data seeded (Kingwood, TX, 55 holes)
- Disc registration working (RGDG-0001)
- Chat bot responding to keyword queries

---

## Backlog
- Drone orthomosaic pipeline (PMTiles → R2)
- 3D terrain rendering (Mapbox v11)
- AR distance measurement (ARKit/ARCore)
- Disc golf game engine (flight physics)
- OpenClaw bot skills
- Push notifications
- Offline mode + sync
- Blockchain contract deployment + treasury wiring

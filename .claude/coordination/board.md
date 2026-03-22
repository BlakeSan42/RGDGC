# RGDGC Sprint Board — 2026-03-22

## Current Sprint Goal
Ship a working app: scoring flow end-to-end (DONE), sticker claim, putting practice, Mapbox maps, weather integration.

---

## Completed This Sprint

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
- All 12 API route groups verified (T4)
- Missing deps fixed (T4)
- Alembic migrations fixed (T4)
- Disc route double prefix fixed (T4)

### Cross-Terminal
- MCP server: 9/9 tools verified (T2)
- CI pipeline: fixed PostGIS, admin-dashboard check, peer deps (T2)
- Location fix: IL → Kingwood TX with real UDisc data (T2)
- End-to-end smoke test passing (T2 + T4)
- 0 TypeScript errors across 36 mobile screens
- Google OAuth, chat bot, disc management, notifications (T3)

---

## Still Unclaimed

### Admin Dashboard: Sticker Management Page
- status: unclaimed
- priority: P1
- notes: Generate batch UI, inventory view, CSV download.

### USGS 3DEP DEM for Kingwood TX
- status: unclaimed
- priority: P1
- notes: 1m resolution bare-earth DEM for elevation profiles.

### Harris County LIDAR via TNRIS
- status: unclaimed
- priority: P1
- notes: Tree canopy height model.

### Deploy Contracts to Sepolia
- status: unclaimed
- priority: P2
- notes: Smart contracts in contracts/. Deploy, verify, wire addresses.

---

## Backlog
- Drone orthomosaic pipeline (PMTiles → R2)
- 3D terrain rendering (Mapbox v11)
- AR distance measurement (ARKit/ARCore)
- Disc golf game engine (flight physics)
- OpenClaw bot skills
- Push notifications
- Offline mode + sync

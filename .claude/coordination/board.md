# RGDGC Sprint Board — 2026-03-22

## Current Sprint Goal
**Phase A: Sticker System Integration** (NOW) → **Phase B: Geo/Mapping Architecture** (NEXT)

---

## Phase A: Sticker System (Priority)

### Move generate_disc_codes.py to scripts/
- status: done:terminal-3
- priority: P1
- notes: Copied to scripts/generate_disc_codes.py.

### Mobile Sticker Claim Screen
- status: unclaimed
- priority: P1
- depends_on: [Integrate Sticker Router]
- notes: QR scanner → claim flow → add disc details. Uses /api/v1/stickers/claim/{code}. Ties into existing disc registration.

### Admin Dashboard: Sticker Management Page
- status: unclaimed
- priority: P1
- depends_on: [Integrate Sticker Router]
- notes: Generate batch, view inventory, download CSV. Wire into existing admin-dashboard/src/pages/.

---

## Phase B: Geo/Mapping Architecture (In Progress)

### Enable PostGIS Extension
- status: done:terminal-3
- notes: PostGIS 3.4 enabled. Docker image swapped to postgis/postgis:15-3.4-alpine. GeoAlchemy2 + Shapely installed.

### Add Geo Fields to Course/Hole Models
- status: done:terminal-3
- notes: Hole: tee_position, basket_position, fairway_line (geometry), tee/basket elevation, elevation_profile. Course: boundary polygon. New CourseFeature model for OB/mandos/trees/water. GiST spatial indexes.

### GeoJSON API Endpoints
- status: done:terminal-3
- notes: 3 endpoints live — /geo/courses/{id}/geojson (full FeatureCollection), /geo/courses/{id}/holes/{n}/elevation, /geo/nearest-hole (auto-detect hole from GPS).

### Add @rnmapbox/maps to Mobile
- status: unclaimed
- priority: P0
- depends_on: []
- notes: Install Mapbox SDK, create course map view with satellite imagery + hole overlays. Free tier (50k loads/month).

### Download USGS 3DEP DEM for Kingwood TX
- status: unclaimed
- priority: P1
- depends_on: []
- notes: 1m resolution bare-earth DEM from USGS National Map. Compute elevation profiles per hole. Kingwood, TX (Harris County, Houston metro). Free data.

### Download Harris County LIDAR via TNRIS
- status: unclaimed
- priority: P1
- depends_on: []
- notes: Tree canopy height model from point clouds. Source: TNRIS (tnris.org) — Texas Natural Resources Info System. Harris County has excellent LIDAR from FEMA flood mapping. Also check USGS 3DEP. Free.

### Weather.gov API Integration
- status: unclaimed
- priority: P1
- depends_on: []
- notes: Real-time wind for Kingwood TX. NWS Houston/Galveston forecast office. No API key needed. Feed into putting probability model.

### Seed River Grove DGC GPS Coordinates
- status: unclaimed
- priority: P0
- depends_on: [Add Geo Fields]
- notes: Need real lat/lng for every tee pad and basket on all 3 layouts (All 18 plus 3A, Standard 18, Ryne Theis Memorial). Can extract from UDisc, satellite imagery, or walk with GPS. Critical for map to show anything.

---

## Still Unclaimed from Previous Sprint

### Build Mobile Putting Practice
- status: unclaimed
- priority: P1
- depends_on: []
- notes: Log putts, see probability, track C1/C1X/C2. Uses /api/v1/putting/* endpoints.

---

## Completed
(see git log for full history — 18 tasks completed across terminal-1, terminal-2, terminal-3)

---

## Backlog
- Drone orthomosaic pipeline (PMTiles → R2)
- 3D terrain rendering (Mapbox v11)
- AR distance measurement (ARKit/ARCore)
- Disc golf game engine (flight physics)
- OpenClaw bot skills
- Blockchain smart contract deployment
- Push notifications
- Offline mode + sync

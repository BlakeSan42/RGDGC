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

### USGS 3DEP DEM for Kingwood TX
- status: unclaimed
- priority: P1
- notes: 1m resolution bare-earth DEM for elevation profiles.

### Harris County LIDAR via TNRIS
- status: unclaimed
- priority: P1
- notes: Tree canopy height model.

## Completed This Round (T2)

### Admin Dashboard: Sticker Management Page — DONE
- Stats overview (5 cards), generate batch form, code lookup, batch inventory, recent claims
- Auto-refresh, CSV download, Sidebar + route wired

### Deploy Contracts to Sepolia — READY
- Deploy script verified (Token → Treasury → DiscRegistry, 1M supply, 500K to treasury)
- verify.ts — Etherscan verification for all 3 contracts
- setup-testnet.ts — Post-deploy: set fee, mint test tokens, register test disc
- wire-backend.ts — Outputs env vars for backend .env
- DEPLOY.md — Full step-by-step guide with faucet links

### Owner Control System — DONE
- /api/v1/owner/* endpoints (hidden from Swagger)
- Two-factor: super_admin JWT + X-Owner-Key header
- Impersonate, lock/unlock, role override, password reset, system status
- Role escalation locked down (admins can't promote to admin/super_admin)

---

## Backlog
- Drone orthomosaic pipeline (PMTiles → R2)
- 3D terrain rendering (Mapbox v11)
- AR distance measurement (ARKit/ARCore)
- Disc golf game engine (flight physics)
- OpenClaw bot skills
- Push notifications
- Offline mode + sync

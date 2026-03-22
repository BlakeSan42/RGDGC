# Resolution Log — RGDGC

Issues found and resolved during development. Newest first.

---

## 2026-03-22 (Sprint Day 1)

### [FIXED] Test suite: 61 failures → 155/155 passing (T3)
- **Root cause:** Async event loop mismatch in test conftest — engine created in different loop than tests
- **Fix:** Per-test engine creation with `db_module._engine` injection, `ENVIRONMENT=testing` + `DATABASE_URL` override before imports
- **Secondary fixes:** timezone-aware datetime into naive columns (disc_service, admin analytics, stickers), `params=` → `json=` in test API calls

### [FIXED] Timezone mismatch causing 500 errors (T3)
- **Affected:** disc confirm_returned, sticker claim, admin analytics dashboard
- **Root cause:** `datetime.now(timezone.utc)` written to `TIMESTAMP WITHOUT TIME ZONE` columns
- **Fix:** Changed to `datetime.utcnow()` in all affected services

### [FIXED] Admin dashboard type mismatch dnf/dq (T3)
- **Root cause:** Admin dashboard used `is_dnf`/`is_dq`, backend returns `dnf`/`dq`
- **Fix:** Renamed in `types.ts` and `EventDetail.tsx`

### [FIXED] Duplicate geoApi exports (T3)
- **Root cause:** Both `api.ts` and `geo.ts` exported `geoApi` with different method names
- **Fix:** Removed duplicate from `geo.ts`, kept canonical in `api.ts`

### [FIXED] PostGIS not in Docker image (T3)
- **Root cause:** `postgres:15-alpine` doesn't include PostGIS extension
- **Fix:** Switched to `postgis/postgis:15-3.4-alpine`

### [FIXED] MCP server node_modules missing (T3)
- **Fix:** `npm install` in mcp-server/

### [FIXED] Health check wrong ports/containers (T3)
- **Fix:** Updated to 5433/6381/8001, removed nonexistent containers

### [FIXED] Disc route double prefix /discs/discs/ (T4)
- **Root cause:** Router had `prefix="/discs"` AND was mounted at `prefix="/discs"`
- **Fix:** Removed internal prefix from router

### [FIXED] Missing Python deps (T4)
- **Packages:** qrcode[svg], requests, slowapi, boto3
- **Fix:** Added to requirements.txt

### [FIXED] Alembic migrations were empty stubs (T4)
- **Fix:** Rewrote with real DDL for all 20+ tables

### [FIXED] Mobile TypeScript errors (T2)
- **Fix:** Removed nativewind, fixed import paths, added missing type exports

### [FIXED] Location: Illinois → Kingwood TX (T2)
- **Root cause:** Original scaffold used River Grove, IL
- **Fix:** Updated all coordinates, seed data, CLAUDE.md to Kingwood, TX (30.027066, -95.208576)

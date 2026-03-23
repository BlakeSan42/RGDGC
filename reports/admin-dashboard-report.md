# RGDGC Admin Dashboard Test Report

**Date:** 2026-03-23
**Tested by:** Claude (automated)
**Dashboard URL:** https://rgdgc-admin.vercel.app
**API URL:** https://rgdgc-api-production.up.railway.app

---

## 1. Admin Dashboard Frontend Tests

### 1.1 Main Page Load
- **URL:** https://rgdgc-admin.vercel.app/
- **HTTP Status:** 200
- **Result:** PASS
- **Summary:** Returns valid HTML with correct `<title>RGDGC Admin</title>`. Loads Inter, Poppins, and JetBrains Mono fonts. References JS bundle (`index-B9QgS5oe.js`) and CSS bundle (`index-B2D972Rg.css`). Uses Vite SPA pattern with `<div id="root">`.

### 1.2 Static Assets — JS Bundle
- **URL:** https://rgdgc-admin.vercel.app/assets/index-B9QgS5oe.js
- **HTTP Status:** 200
- **Size:** ~160 KB
- **Result:** PASS
- **Summary:** JavaScript bundle loads successfully. Contains React, React Router, Recharts, Axios, and application code.

### 1.3 Static Assets — CSS Bundle
- **URL:** https://rgdgc-admin.vercel.app/assets/index-B2D972Rg.css
- **HTTP Status:** 200
- **Size:** ~38 KB
- **Result:** PASS
- **Summary:** TailwindCSS bundle loads successfully with all utility classes.

### 1.4 /login Page
- **URL:** https://rgdgc-admin.vercel.app/login
- **HTTP Status:** 404
- **Result:** FAIL
- **Summary:** Returns Vercel's "The page could not be found" error instead of the SPA. This is a **SPA routing issue** — the `vercel.json` is missing a catch-all rewrite to serve `index.html` for all non-asset routes. Only the root `/` works because it maps directly to `index.html`.

### 1.5 API URL Configuration (VITE_API_URL)
- **Result:** FAIL (CRITICAL)
- **Summary:** The JS bundle contains a hardcoded baseURL of `http://localhost:8001/api/v1`. This means the deployed admin dashboard **cannot reach the production API**. All API calls from the browser will fail because they target localhost.
- **Source:** Found in JS bundle: `"http://localhost:8001/api/v1",he=vt.create({baseURL:ok,header...`
- **Root cause:** The `.env` file at `admin-dashboard/.env` has `VITE_API_URL=http://localhost:8001/api/v1`. This value was baked into the Vite build. Either:
  - The Vercel project environment variables do not override `VITE_API_URL`, OR
  - The build was done locally and deployed as static files without the correct env var.
- **Fix needed:** Set `VITE_API_URL=https://rgdgc-api-production.up.railway.app/api/v1` in Vercel's environment variables and redeploy.

### 1.6 Backend Reachability from Dashboard
- **Result:** FAIL (blocked by 1.5)
- **Summary:** The `vercel.json` has a rewrite rule for `/api/:path*` -> `https://api.rgdgc.com/api/:path*`, but:
  1. The JS bundle uses `http://localhost:8001/api/v1` directly (not relative `/api/v1`), so the Vercel rewrite is never triggered.
  2. The rewrite targets `api.rgdgc.com` which may or may not point to the Railway backend.

---

## 2. Backend API Endpoint Tests

### 2.1 API Root
- **URL:** https://rgdgc-api-production.up.railway.app/
- **HTTP Status:** 404
- **Result:** EXPECTED (no root handler defined; FastAPI returns 404)

### 2.2 Login (POST /api/v1/auth/login)
- **Credentials:** admin@rgdgc.com / admin123
- **HTTP Status:** 200
- **Result:** PASS
- **Summary:** Returns valid JWT tokens and user object. User confirmed as `super_admin` role, display name "Blake Sanders", user ID 1. Access and refresh tokens issued successfully.

### 2.3 Dashboard Analytics (GET /api/v1/admin/analytics/dashboard)
- **HTTP Status:** 200
- **Result:** PASS
- **Summary:** Returns dashboard stats:
  - Active players: 0
  - Upcoming events: 2
  - Rounds this week: 0
  - Revenue this month: $25.00
  - All growth metrics: 0 (new deployment, no historical data)

### 2.4 Players List (GET /api/v1/admin/users)
- **HTTP Status:** 404
- **Result:** EXPECTED (endpoint does not exist)
- **Summary:** This endpoint is not implemented in the backend. The admin router exposes `/admin/users/{user_id}/role` (POST) for role changes but has no user listing endpoint. The admin dashboard likely uses `/api/v1/users` (the users router) instead.

### 2.5 Audit Log (GET /api/v1/admin/audit-log)
- **HTTP Status:** 200
- **Result:** PASS
- **Summary:** Returns empty array `[]`. No audit entries yet (fresh deployment).

### 2.6 Cache Clear (POST /api/v1/admin/cache/clear)
- **HTTP Status:** 200
- **Result:** PASS
- **Summary:** Returns `{"detail":"Cache cleared successfully"}`. Redis cache clear works.

---

## 3. Issues Summary

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | **CRITICAL** | VITE_API_URL baked as `localhost:8001` in production JS bundle | Set `VITE_API_URL=https://rgdgc-api-production.up.railway.app/api/v1` in Vercel env vars and redeploy |
| 2 | **HIGH** | SPA routing broken — `/login` and all deep links return Vercel 404 | Add catch-all rewrite to `vercel.json`: `{"source": "/((?!api|assets).*)", "destination": "/index.html"}` |
| 3 | **LOW** | No `/admin/users` list endpoint on backend | Implement GET `/admin/users` or confirm dashboard uses `/users` router |
| 4 | **INFO** | `vercel.json` API rewrite targets `api.rgdgc.com` but JS bundle uses absolute localhost URL | Once issue #1 is fixed, either use relative URLs (`/api/v1`) to leverage the Vercel rewrite, or use the full Railway URL |

---

## 4. Recommended Fixes

### Fix 1: Vercel Environment Variable (CRITICAL)
```bash
# In Vercel dashboard or CLI:
vercel env add VITE_API_URL production
# Value: https://rgdgc-api-production.up.railway.app/api/v1

# Then redeploy:
vercel --prod
```

### Fix 2: SPA Routing in vercel.json
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://rgdgc-api-production.up.railway.app/api/:path*"
    },
    {
      "source": "/((?!assets).*)",
      "destination": "/index.html"
    }
  ]
}
```

### Fix 3: Local .env should not be committed with localhost
Update `admin-dashboard/.env` to use production URL or remove it from version control entirely (use `.env.example` for documentation and Vercel env vars for actual values).

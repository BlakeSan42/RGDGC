# RGDGC Deployment Guide

Deploy the full stack: Backend API (Railway) + Mobile Web (Vercel) + Admin Dashboard (Vercel).

## Architecture

```
Users → app.rgdgc.com (Mobile Web / Vercel)
         ↓ API calls
Admins → admin.rgdgc.com (Admin Dashboard / Vercel)
         ↓ API calls
         api.rgdgc.com (FastAPI / Railway)
         ↓
         PostgreSQL + Redis (Railway managed)
```

## Prerequisites

- GitHub account (repo pushed to GitHub)
- Railway account (https://railway.com — sign in with GitHub)
- Vercel account (https://vercel.com — sign in with GitHub)
- Google OAuth Client ID (see `docs/GOOGLE_OAUTH_SETUP.md`)

---

## Part 1: Backend on Railway

### 1.1 Create the project

1. Go to https://railway.com/new
2. Click **Deploy from GitHub Repo**
3. Select your `RGDGC` repository
4. Railway will detect the monorepo — set **Root Directory** to `backend`
5. It will auto-detect the Dockerfile

### 1.2 Add PostgreSQL

1. In your Railway project, click **+ New** → **Database** → **PostgreSQL**
2. Railway auto-creates `DATABASE_URL` and links it to your service
3. Click the PostgreSQL service → **Variables** tab → copy the `DATABASE_URL`
4. It will look like: `postgresql://postgres:xxx@xxx.railway.internal:5432/railway`

**Important:** The backend uses `asyncpg`, so you need the async URL. In your backend service variables, set:
```
DATABASE_URL=postgresql+asyncpg://postgres:xxx@xxx.railway.internal:5432/railway
```
(Replace `postgresql://` with `postgresql+asyncpg://` from the Railway-provided URL)

### 1.3 Add Redis

1. Click **+ New** → **Database** → **Redis**
2. Railway auto-creates `REDIS_URL`
3. Copy it — it looks like: `redis://default:xxx@xxx.railway.internal:6379`

### 1.4 Set environment variables

In the backend service → **Variables** tab, add:

```
# Database (modify the auto-generated URL to use asyncpg)
DATABASE_URL=postgresql+asyncpg://postgres:PASSWORD@HOST:5432/railway

# Redis (use the auto-generated URL as-is)
REDIS_URL=redis://default:PASSWORD@HOST:6379

# Auth — generate real secrets!
SECRET_KEY=<run: python3 -c "import secrets; print(secrets.token_hex(32))">
JWT_SECRET=<run: python3 -c "import secrets; print(secrets.token_hex(32))">

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# CORS — your Vercel frontend URLs
CORS_ORIGINS=https://app.rgdgc.com,https://admin.rgdgc.com

# Environment
ENVIRONMENT=production

# Owner key (for super-admin operations)
OWNER_KEY=<run: python3 -c "import secrets; print(secrets.token_hex(32))">

# Blockchain (already deployed to Sepolia)
RGDG_TOKEN_ADDRESS=0x91c4348E39B021031b617A74D836f395715fA92F
TREASURY_ADDRESS=0x0E9E12cfd11249f4f7e9a3781f9833e7d76c21B4
DISC_REGISTRY_ADDRESS=0x7ebC421d1AcD36Af2b823CBA4afBEA2497f472bf
WEB3_PROVIDER_URL=https://ethereum-sepolia-rpc.publicnode.com
WEB3_CHAIN_ID=11155111
```

Generate your secrets locally:
```bash
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
python3 -c "import secrets; print('JWT_SECRET=' + secrets.token_hex(32))"
python3 -c "import secrets; print('OWNER_KEY=' + secrets.token_hex(32))"
```

### 1.5 Custom domain (optional)

1. In the backend service → **Settings** → **Networking** → **Custom Domain**
2. Add `api.rgdgc.com`
3. Railway gives you a CNAME record to add to your DNS
4. If you don't have a domain, Railway gives you a free URL like `rgdgc-backend-production.up.railway.app`

### 1.6 Deploy

Railway auto-deploys on push to main. You can also trigger manually:
- Click **Deploy** in the Railway dashboard, or
- Push any change to `backend/` on the `main` branch

### 1.7 Verify

```bash
# Replace with your Railway URL
curl https://api.rgdgc.com/health
curl https://api.rgdgc.com/api/v1/courses
```

---

## Part 2: Mobile Web on Vercel

### 2.1 Create the project

1. Go to https://vercel.com/new
2. Click **Import Git Repository** → select `RGDGC`
3. Set **Root Directory** to `mobile`
4. Vercel will read `mobile/vercel.json` for the build config
5. **Framework Preset**: Override to `Other` (Expo export, not Next.js)

### 2.2 Set environment variables

In Vercel → Project Settings → Environment Variables:

```
EXPO_PUBLIC_API_URL=https://api.rgdgc.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### 2.3 Custom domain (optional)

1. Go to **Settings** → **Domains**
2. Add `app.rgdgc.com`
3. Vercel gives you DNS records to configure

If no custom domain, Vercel gives you `rgdgc-mobile.vercel.app`.

### 2.4 Deploy

Vercel auto-deploys on push to main. The first deploy happens when you create the project.

---

## Part 3: Admin Dashboard on Vercel

### 3.1 Create the project

1. Go to https://vercel.com/new
2. Import `RGDGC` repo again (Vercel supports multiple projects per repo)
3. Set **Root Directory** to `admin-dashboard`
4. **Framework Preset**: Vite (auto-detected)

### 3.2 Set environment variables

```
VITE_API_URL=https://api.rgdgc.com/api/v1
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### 3.3 Custom domain (optional)

Add `admin.rgdgc.com` in Settings → Domains.

### 3.4 Deploy

Auto-deploys on push to main.

---

## Part 4: Update Google OAuth for Production

After deploying, go back to Google Cloud Console → Credentials → your OAuth Client ID:

**Add to Authorized JavaScript origins:**
```
https://app.rgdgc.com
https://admin.rgdgc.com
https://api.rgdgc.com
```
(Or your Vercel/Railway URLs if not using custom domains)

**Add to Authorized redirect URIs:**
```
https://app.rgdgc.com
https://auth.expo.io/@your-expo-username/rgdgc
```

---

## Part 5: Seed Production Database

After the backend is running on Railway, seed it with course data:

```bash
# Get your Railway backend URL
BACKEND_URL=https://api.rgdgc.com  # or your Railway URL

# Register yourself as the first user (via Google OAuth in the app)
# Then promote to admin:
railway run --service backend -- python -c "
from app.db.database import sync_engine
from sqlalchemy import text
with sync_engine.connect() as conn:
    conn.execute(text(\"UPDATE users SET role='super_admin' WHERE email='your@gmail.com'\"))
    conn.commit()
    print('Done')
"
```

Or use the Railway shell:
1. Railway dashboard → Backend service → **Shell** tab
2. Run: `python -c "...same SQL..."`

The seed script (`scripts/seed_data.py`) can also be run via Railway shell to populate courses and test data.

---

## Quick Reference

### URLs (with custom domains)

| Service | URL |
|---------|-----|
| Mobile Web | https://app.rgdgc.com |
| Admin Dashboard | https://admin.rgdgc.com |
| Backend API | https://api.rgdgc.com |
| API Docs | https://api.rgdgc.com/docs |

### URLs (without custom domains)

| Service | URL |
|---------|-----|
| Mobile Web | https://rgdgc-mobile.vercel.app |
| Admin Dashboard | https://rgdgc-admin.vercel.app |
| Backend API | https://rgdgc-backend.up.railway.app |

### Environment Variables Summary

| Service | Variable | Value |
|---------|----------|-------|
| Railway (backend) | `DATABASE_URL` | Auto from Railway PostgreSQL (change to asyncpg) |
| Railway (backend) | `REDIS_URL` | Auto from Railway Redis |
| Railway (backend) | `SECRET_KEY` | Generate: `secrets.token_hex(32)` |
| Railway (backend) | `JWT_SECRET` | Generate: `secrets.token_hex(32)` |
| Railway (backend) | `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| Railway (backend) | `CORS_ORIGINS` | `https://app.rgdgc.com,https://admin.rgdgc.com` |
| Railway (backend) | `ENVIRONMENT` | `production` |
| Vercel (mobile) | `EXPO_PUBLIC_API_URL` | `https://api.rgdgc.com` |
| Vercel (mobile) | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Same Google Client ID |
| Vercel (admin) | `VITE_API_URL` | `https://api.rgdgc.com/api/v1` |
| Vercel (admin) | `VITE_GOOGLE_CLIENT_ID` | Same Google Client ID |

### Monthly Cost Estimate

| Service | Cost |
|---------|------|
| Railway (backend + Postgres + Redis) | $5-15/mo |
| Vercel (mobile web) | Free |
| Vercel (admin dashboard) | Free |
| **Total** | **$5-15/mo** |

---

## Troubleshooting

### Backend won't start on Railway
- Check **Deploy Logs** in Railway dashboard
- Most common: `DATABASE_URL` still has `postgresql://` instead of `postgresql+asyncpg://`
- Verify all required env vars are set

### CORS errors in browser
- Backend `CORS_ORIGINS` must include the exact frontend URLs (including `https://`)
- No trailing slashes

### Google sign-in fails in production
- Google Cloud Console → Authorized origins must include your production URLs
- The same Client ID must be in all 3 services

### Vercel build fails for mobile
- Expo export needs `--legacy-peer-deps` — this is set in `vercel.json` via `installCommand`
- If it still fails, check the build logs for missing env vars

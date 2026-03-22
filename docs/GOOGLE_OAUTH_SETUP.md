# Google OAuth Setup Guide — RGDGC

Complete instructions to configure Google Sign-In for the RGDGC platform (mobile app, admin dashboard, and backend).

## What You Need

- A Google account (personal is fine)
- Access to [Google Cloud Console](https://console.cloud.google.com/)
- ~10 minutes

## Step 1: Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Click the project dropdown (top-left, next to "Google Cloud")
3. Click **New Project**
4. Name: `RGDGC` (or whatever you want)
5. Click **Create**
6. Make sure it's selected in the project dropdown

## Step 2: Enable the Google Identity API

1. Go to **APIs & Services** → **Library** (left sidebar)
2. Search for `Google Identity Toolkit API`
3. Click it → **Enable**
4. Also search for and enable `People API` (for profile photos)

## Step 3: Configure the OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (allows any Google account to sign in)
3. Click **Create**
4. Fill in:
   - **App name**: `RGDGC`
   - **User support email**: your email
   - **Developer contact information**: your email
5. Click **Save and Continue**
6. **Scopes**: Click **Add or Remove Scopes**
   - Add: `email`, `profile`, `openid`
   - Click **Update** → **Save and Continue**
7. **Test users**: Skip (not needed for development)
8. Click **Back to Dashboard**

> **Note**: While in "Testing" mode, only test users you add can sign in.
> To let anyone sign in, click **Publish App** on the consent screen page.
> For development, "Testing" mode is fine — just add your own Google email as a test user.

## Step 4: Create OAuth Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. **Application type**: `Web application`
4. **Name**: `RGDGC Web`
5. **Authorized JavaScript origins** — add ALL of these:
   ```
   http://localhost:8081
   http://localhost:8082
   http://localhost:3001
   http://localhost:5173
   http://localhost:9000
   http://localhost:9001
   http://localhost:19006
   ```
6. **Authorized redirect URIs** — add:
   ```
   https://auth.expo.io/@your-expo-username/rgdgc
   http://localhost:8081
   http://localhost:8082
   http://localhost:9001
   ```
   > Replace `your-expo-username` with your actual Expo username.
   > If you don't have one, run `npx expo login` to create/find it.
7. Click **Create**
8. **Copy the Client ID** — it looks like: `123456789-abcdef.apps.googleusercontent.com`

> You only need ONE client ID (Web type). Expo's auth proxy handles mobile by routing through the web client.

## Step 5: Paste the Client ID

You need to put the same Client ID in 3 places:

### Backend (`backend/.env`)
```
GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
```

### Mobile (`mobile/.env`)
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
```

### Admin Dashboard (`admin-dashboard/.env`)
```
VITE_GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
```

**Quick one-liner** (replace the ID):
```bash
CLIENT_ID="YOUR_CLIENT_ID_HERE.apps.googleusercontent.com"

# macOS sed
sed -i '' "s/PASTE_YOUR_WEB_CLIENT_ID_HERE.apps.googleusercontent.com/$CLIENT_ID/" backend/.env mobile/.env admin-dashboard/.env
```

## Step 6: Start Everything and Test

### Prerequisites
```bash
# PostgreSQL + Redis must be running
docker compose up -d
```

### Start all services
```bash
# Terminal 1: Backend API (port 8001)
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8001

# Terminal 2: Mobile web (port 8082)
cd mobile && npx expo start --web --port 8082

# Terminal 3: Admin dashboard (port 3001)
cd admin-dashboard && npm run dev
```

### Test the flow
1. Open `http://localhost:8082` in your browser
2. You should see the RGDGC welcome screen with "Continue with Google"
3. Click it → Google sign-in popup appears
4. Sign in with your Google account
5. You should be redirected to the main app (Play tab)

### What happens on the backend
- `POST /api/v1/auth/google` receives the Google ID token
- Verifies it with Google's servers
- Finds existing user by `google_id` or `email`, OR creates a new one
- Returns JWT access + refresh tokens
- User role (player/admin) is determined by `user.role` in the database

### Admin access
To make yourself an admin after first login:
```bash
# Find your user ID
curl http://localhost:8001/api/v1/users | python3 -m json.tool

# Use the owner endpoint (if OWNER_KEY is set in backend/.env)
# Or directly in the database:
docker exec -it rgdgc-postgres psql -U rgdgc -d rgdgc -c \
  "UPDATE users SET role = 'admin' WHERE email = 'your@gmail.com';"
```

Then log into the admin dashboard at `http://localhost:3001`.

## Troubleshooting

### "Google authentication is not configured"
→ `GOOGLE_CLIENT_ID` is empty or missing in `backend/.env`. Restart the backend after adding it.

### "Google token was not issued for this application"
→ The client ID in `mobile/.env` doesn't match `backend/.env`. They must be identical.

### Google popup doesn't appear / closes immediately
→ Check **Authorized JavaScript origins** in Google Cloud Console includes your localhost URL.

### "Access blocked: This app's request is invalid" (Error 400)
→ **Authorized redirect URIs** is missing the Expo auth proxy URL. Add:
`https://auth.expo.io/@your-expo-username/rgdgc`

### Works on web but not on physical device
→ For iOS/Android devices, you may need platform-specific client IDs:
- iOS: Create another OAuth client ID with type "iOS", bundle ID `com.rgdgc.app`
- Android: Create another OAuth client ID with type "Android", package `com.rgdgc.app`
Then add them to `mobile/.env` as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.

### Rate limited by Google
→ The backend limits `/auth/google` to 10 requests/minute. If you're testing rapidly, wait a minute.

## Port Reference

| Service | URL | Purpose |
|---------|-----|---------|
| Backend API | `http://localhost:8001` | FastAPI, all `/api/v1/*` endpoints |
| Mobile (web) | `http://localhost:8082` | Expo web build, player-facing |
| Admin Dashboard | `http://localhost:3001` | Vite dev server, admin-facing |
| PostgreSQL | `localhost:5433` | Database (via Docker) |
| Redis | `localhost:6381` | Cache (via Docker) |

## Summary of Files Changed

| File | Variable | Value |
|------|----------|-------|
| `backend/.env` | `GOOGLE_CLIENT_ID` | Your Web Client ID |
| `mobile/.env` | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Same Web Client ID |
| `admin-dashboard/.env` | `VITE_GOOGLE_CLIENT_ID` | Same Web Client ID |

One Google Cloud project. One OAuth Client ID (Web type). Pasted in 3 places. That's it.

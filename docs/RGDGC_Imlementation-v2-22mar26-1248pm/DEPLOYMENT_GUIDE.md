# RGDGC Deployment Guide: Go Live Today

## Overview

This guide provides step-by-step instructions to deploy the RGDGC app so users can access it today. We'll use the fastest path to production while maintaining quality.

---

## 1. Deployment Timeline

### 1.1 Fastest Path (Same Day Launch)

| Phase | Time | What You Get |
|-------|------|--------------|
| **Phase 1: Backend** | 30 min | API live, database ready |
| **Phase 2: Mobile Preview** | 30 min | Testable app via Expo Go |
| **Phase 3: App Stores** | 1-7 days | Full native apps |

### 1.2 What Users Can Access Today

```
TODAY (within hours):
✓ Web-accessible API
✓ Mobile app via Expo Go (no app store needed)
✓ Full functionality for testing
✓ Share with your league members immediately

WITHIN 1-7 DAYS:
✓ iOS App Store listing
✓ Google Play Store listing
✓ Professional app store presence
```

---

## 2. Required Accounts (Create These First)

### 2.1 Account Checklist

| Account | URL | Cost | Time to Setup |
|---------|-----|------|---------------|
| **Railway** | railway.app | $5/month | 5 min |
| **Expo** | expo.dev | Free | 5 min |
| **Apple Developer** | developer.apple.com | $99/year | 1-2 days* |
| **Google Play Console** | play.google.com/console | $25 one-time | 1-2 days* |
| **GitHub** | github.com | Free | 5 min |
| **Cloudflare** (optional) | cloudflare.com | Free | 10 min |

*Apple/Google accounts can be created while waiting for approval. App can be tested via Expo Go immediately.

### 2.2 Create Accounts Now

```bash
# Open each in browser
open https://railway.app
open https://expo.dev
open https://developer.apple.com/programs/enroll/
open https://play.google.com/console/signup
open https://github.com/signup
```

---

## 3. Phase 1: Deploy Backend (30 minutes)

### 3.1 Prepare Code for Deployment

```bash
cd ~/Projects/rgdgc-app/backend

# Create production-ready requirements.txt
cat > requirements.txt << 'EOF'
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
asyncpg==0.29.0
alembic==1.13.1
pydantic==2.5.3
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
redis==5.0.1
httpx==0.26.0
psycopg2-binary==2.9.9
python-dotenv==1.0.0
gunicorn==21.2.0
EOF

# Create Procfile for Railway
cat > Procfile << 'EOF'
web: gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
EOF

# Create railway.json
cat > railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "alembic upgrade head && gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100
  }
}
EOF

# Initialize git if not already
git init
git add .
git commit -m "Initial commit - backend ready for deployment"
```

### 3.2 Create GitHub Repository

```bash
# Create repo on GitHub (do this in browser or with gh CLI)
# https://github.com/new

# Or use GitHub CLI
brew install gh
gh auth login
gh repo create rgdgc-backend --private --source=. --push
```

### 3.3 Deploy to Railway

**Step 1: Login to Railway**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login
```

**Step 2: Create Project in Railway Dashboard**

1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize GitHub and select `rgdgc-backend`

**Step 3: Add PostgreSQL**

1. In your Railway project, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway automatically creates `DATABASE_URL` environment variable

**Step 4: Add Redis**

1. Click "+ New" again
2. Select "Database" → "Redis"
3. Railway automatically creates `REDIS_URL` environment variable

**Step 5: Configure Environment Variables**

In Railway dashboard → your backend service → Variables:

```
DATABASE_URL=<auto-populated by Railway>
REDIS_URL=<auto-populated by Railway>
SECRET_KEY=<generate with: openssl rand -hex 32>
JWT_SECRET_KEY=<generate with: openssl rand -hex 32>
ENVIRONMENT=production
DEBUG=false
```

Generate secrets:
```bash
# Run these and copy the output
openssl rand -hex 32  # For SECRET_KEY
openssl rand -hex 32  # For JWT_SECRET_KEY
```

**Step 6: Deploy**

Railway auto-deploys when you push to GitHub:
```bash
git push origin main
```

**Step 7: Get Your API URL**

1. In Railway dashboard, click on your backend service
2. Go to Settings → Domains
3. Click "Generate Domain"
4. You'll get something like: `rgdgc-backend-production.up.railway.app`

**Step 8: Verify Deployment**

```bash
# Test your API
curl https://rgdgc-backend-production.up.railway.app/health

# Should return:
# {"status":"healthy","version":"1.0.0"}

# View Swagger docs
open https://rgdgc-backend-production.up.railway.app/docs
```

### 3.4 Railway Cost Estimate

| Resource | Usage | Cost |
|----------|-------|------|
| Backend (1GB RAM) | ~$5/month | ~$5 |
| PostgreSQL | ~$5/month | ~$5 |
| Redis | ~$5/month | ~$5 |
| **Total** | | **~$15/month** |

*Railway offers $5 free credit monthly*

---

## 4. Phase 2: Deploy Mobile App (30 minutes)

### 4.1 Configure API URL

```bash
cd ~/Projects/rgdgc-app/mobile

# Create environment config
cat > src/config.ts << 'EOF'
const ENV = {
  development: {
    apiUrl: 'http://localhost:8000',
  },
  production: {
    apiUrl: 'https://rgdgc-backend-production.up.railway.app',  // Your Railway URL
  },
};

const getEnvVars = () => {
  if (__DEV__) {
    return ENV.development;
  }
  return ENV.production;
};

export default getEnvVars();
EOF
```

### 4.2 Setup Expo Account

```bash
# Login to Expo
npx expo login

# Create EAS project
eas init

# Configure EAS build
eas build:configure
```

### 4.3 Immediate Testing via Expo Go (No App Store Needed!)

**This is how users can access your app TODAY:**

```bash
cd ~/Projects/rgdgc-app/mobile

# Start Expo with production API
EXPO_PUBLIC_API_URL=https://rgdgc-backend-production.up.railway.app npx expo start

# Or publish to Expo's servers for sharing
npx expo publish
```

**Share with your league members:**

1. After `expo publish`, you'll get a URL like: `exp://exp.host/@yourname/rgdgc`
2. Share this URL with members
3. They download "Expo Go" from App Store/Play Store
4. Open the link or scan QR code
5. **App works immediately!**

### 4.4 Create Shareable Preview Link

```bash
# Publish to Expo
npx expo publish

# Output will show:
# Published to: https://expo.dev/@yourname/rgdgc
# QR code for Expo Go

# Create shareable link
echo "
📱 RGDGC APP - INSTALL INSTRUCTIONS

1. Download 'Expo Go' from your app store:
   - iPhone: https://apps.apple.com/app/expo-go/id982107779
   - Android: https://play.google.com/store/apps/details?id=host.exp.exponent

2. Open this link on your phone:
   exp://exp.host/@yourname/rgdgc

3. The RGDGC app will open!

Questions? Contact Blake
"
```

---

## 5. Phase 3: App Store Deployment (1-7 days)

### 5.1 iOS App Store

**Prerequisites:**
- Apple Developer account ($99/year) - https://developer.apple.com/programs/enroll/
- App icons and screenshots ready

**Step 1: Configure EAS for iOS**

```bash
cd ~/Projects/rgdgc-app/mobile

# Update eas.json
cat > eas.json << 'EOF'
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
EOF
```

**Step 2: Create App in App Store Connect**

1. Go to https://appstoreconnect.apple.com
2. Click "My Apps" → "+"  → "New App"
3. Fill in:
   - Platform: iOS
   - Name: RGDGC
   - Primary Language: English
   - Bundle ID: com.rgdgc.app
   - SKU: rgdgc-app

**Step 3: Build for iOS**

```bash
# Build production iOS app
eas build --platform ios --profile production

# This takes 15-30 minutes
# You'll get a .ipa file URL when done
```

**Step 4: Submit to App Store**

```bash
# Submit to App Store
eas submit --platform ios --profile production

# Or do it manually:
# 1. Download the .ipa from the EAS build URL
# 2. Open Transporter app (from Mac App Store)
# 3. Upload the .ipa
```

**Step 5: App Store Review**

In App Store Connect:
1. Fill in app description, keywords, screenshots
2. Set pricing (Free)
3. Submit for review
4. Wait 1-7 days for approval

### 5.2 Google Play Store

**Prerequisites:**
- Google Play Console account ($25 one-time) - https://play.google.com/console/signup
- App icons and screenshots ready

**Step 1: Configure EAS for Android**

```bash
# Update eas.json to include Android
cat > eas.json << 'EOF'
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "production"
      }
    }
  }
}
EOF
```

**Step 2: Create App in Google Play Console**

1. Go to https://play.google.com/console
2. Click "Create app"
3. Fill in:
   - App name: RGDGC
   - Default language: English
   - App or game: App
   - Free or paid: Free

**Step 3: Build for Android**

```bash
# Build production Android app
eas build --platform android --profile production

# This takes 15-30 minutes
# You'll get a .aab file URL when done
```

**Step 4: Submit to Play Store**

```bash
# Create service account for automated submission
# (See https://github.com/expo/fyi/blob/main/creating-google-service-account.md)

# Submit to Play Store
eas submit --platform android --profile production

# Or manually:
# 1. Download the .aab from EAS build URL
# 2. Go to Play Console → Production → Create new release
# 3. Upload the .aab
# 4. Fill in release notes
# 5. Submit for review
```

**Step 5: Play Store Review**

1. Complete store listing (description, screenshots)
2. Set content rating (fill questionnaire)
3. Set up pricing & distribution
4. Submit for review (usually 1-3 days)

---

## 6. Complete Deployment Checklist

### 6.1 Backend Checklist

- [ ] Railway account created
- [ ] GitHub repo created and pushed
- [ ] Railway project created
- [ ] PostgreSQL provisioned
- [ ] Redis provisioned
- [ ] Environment variables set
- [ ] API deployed and responding
- [ ] Health check passing
- [ ] Database migrations run

### 6.2 Mobile Checklist

- [ ] Expo account created
- [ ] API URL configured
- [ ] App tested locally
- [ ] Published to Expo (for immediate access)
- [ ] Shareable link created

### 6.3 App Stores Checklist

**iOS:**
- [ ] Apple Developer account ($99)
- [ ] App created in App Store Connect
- [ ] Icons and screenshots ready
- [ ] EAS build completed
- [ ] Submitted to App Store
- [ ] Approved and live

**Android:**
- [ ] Google Play Console account ($25)
- [ ] App created in Play Console
- [ ] Icons and screenshots ready
- [ ] EAS build completed
- [ ] Submitted to Play Store
- [ ] Approved and live

---

## 7. Sharing With Users Today

### 7.1 Immediate Access (Expo Go)

Create this message for your league members:

```
🥏 RGDGC APP IS LIVE! 🥏

Hey everyone! Our new disc golf app is ready for testing.
Here's how to get it on your phone RIGHT NOW:

📱 STEP 1: Download Expo Go
iPhone: https://apps.apple.com/app/expo-go/id982107779
Android: https://play.google.com/store/apps/details?id=host.exp.exponent

📱 STEP 2: Open the app
Scan this QR code or open this link:
[INSERT QR CODE IMAGE]
exp://exp.host/@yourname/rgdgc

That's it! The app will open and you can:
✓ Create your account
✓ Score rounds
✓ View leaderboards
✓ Check in to events

The full App Store version is coming soon, but this works great for now!

Questions? Reply here or message Blake.

See you on the course! 🥏
```

### 7.2 QR Code Generation

```bash
# Install qrcode tool
brew install qrencode

# Generate QR code for your Expo link
qrencode -o rgdgc-qr.png "exp://exp.host/@yourname/rgdgc"

# Or use online: https://www.qr-code-generator.com
```

### 7.3 Facebook Group Post

```
🎉 BIG NEWS for RGDGC! 🎉

We just launched our own disc golf app!

📱 Features:
• Score your rounds
• Track putting stats
• View league leaderboards
• Check in to events
• Get notified about results

📲 GET IT NOW:
1. Download "Expo Go" from your app store
2. Open: exp://exp.host/@yourname/rgdgc

Full App Store version coming next week!

Let me know if you have any questions. Happy throwing! 🥏
```

---

## 8. Post-Launch Monitoring

### 8.1 Set Up Monitoring

**Uptime Monitoring (Free):**
```bash
# Create account at uptimerobot.com
# Add monitor for: https://rgdgc-backend-production.up.railway.app/health
# Set alerts for downtime
```

**Error Tracking (Free tier):**
```bash
# Create account at sentry.io
# Add to backend:
pip install sentry-sdk[fastapi]

# Add to app/main.py:
import sentry_sdk
sentry_sdk.init(
    dsn="YOUR_SENTRY_DSN",
    traces_sample_rate=0.1,
)
```

### 8.2 Railway Dashboard

```bash
# View logs
railway logs

# Check metrics
# Go to Railway dashboard → your service → Metrics
```

### 8.3 User Feedback

Add a simple feedback mechanism:
```bash
# Create a Google Form for feedback
# Share link in app settings or announcement

# Or use the chat feature to collect feedback via @clawd bot
```

---

## 9. Updating the App

### 9.1 Backend Updates

```bash
# Make changes
cd ~/Projects/rgdgc-app/backend
# Edit files...

# Commit and push
git add .
git commit -m "Fix: description of change"
git push origin main

# Railway auto-deploys!
```

### 9.2 Mobile Updates (Expo)

**For JavaScript-only changes (instant):**
```bash
cd ~/Projects/rgdgc-app/mobile

# Publish update
npx expo publish

# Users get update next time they open app!
```

**For native changes (requires new build):**
```bash
# Rebuild and resubmit to stores
eas build --platform all --profile production
eas submit --platform all
```

---

## 10. Cost Summary

### 10.1 Monthly Costs

| Service | Cost |
|---------|------|
| Railway (Backend + DB + Redis) | ~$15/month |
| Expo (Free tier) | $0 |
| Cloudflare (optional) | $0 |
| Sentry (Free tier) | $0 |
| **Monthly Total** | **~$15** |

### 10.2 One-Time Costs

| Service | Cost |
|---------|------|
| Apple Developer Program | $99/year |
| Google Play Console | $25 one-time |
| **Total to launch** | **~$125** |

---

## 11. Troubleshooting

### 11.1 Common Issues

| Issue | Solution |
|-------|----------|
| Railway deploy fails | Check logs: `railway logs`. Often a missing dependency. |
| Database connection error | Verify DATABASE_URL is set. Check Railway PostgreSQL is running. |
| Expo publish fails | Run `npx expo doctor` to check for issues. |
| App not connecting to API | Check API URL in config. Verify CORS settings in backend. |
| iOS build fails | Check certificates: `eas credentials`. |
| Android build fails | Check for gradle issues in build logs. |

### 11.2 Getting Help

```bash
# Railway support
open https://railway.app/help

# Expo support
open https://docs.expo.dev
open https://discord.gg/expo

# Stack Overflow
# Tag: [railway] [expo] [react-native] [fastapi]
```

---

## 12. Quick Start Commands

```bash
# === ONE-TIME SETUP ===
npm install -g @railway/cli expo-cli eas-cli
railway login
npx expo login

# === DEPLOY BACKEND ===
cd ~/Projects/rgdgc-app/backend
git push origin main  # Railway auto-deploys

# === DEPLOY MOBILE (immediate access) ===
cd ~/Projects/rgdgc-app/mobile
npx expo publish

# === BUILD FOR APP STORES ===
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform all

# === VIEW LOGS ===
railway logs -f

# === UPDATE APP ===
git push origin main  # Backend
npx expo publish      # Mobile (JS changes)
```

---

## 13. Next Steps After Launch

1. **Collect feedback** from early users
2. **Monitor errors** in Sentry
3. **Track usage** in analytics
4. **Iterate quickly** based on feedback
5. **Announce on Facebook group** when App Store versions are live
6. **Plan first league event** using the app

---

*Document Version: 1.0*
*Last Updated: March 2026*
*Owner: RGDGC Tech Team*

---

## Appendix A: Complete Environment Variables Reference

```bash
# Backend (.env)
DATABASE_URL=postgresql://user:pass@host:5432/rgdgc
REDIS_URL=redis://host:6379
SECRET_KEY=<64-char-hex-string>
JWT_SECRET_KEY=<64-char-hex-string>
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=24
ENVIRONMENT=production
DEBUG=false

# Optional
SENTRY_DSN=https://xxx@sentry.io/xxx
ANTHROPIC_API_KEY=sk-ant-xxx  # For AI bot
DISCORD_BOT_TOKEN=xxx
TELEGRAM_BOT_TOKEN=xxx

# Blockchain (if using)
WEB3_PROVIDER_URL=https://sepolia.infura.io/v3/xxx
RGDG_TOKEN_ADDRESS=0x...
TREASURY_ADDRESS=0x...
```

## Appendix B: Asset Requirements

### App Icons

| Platform | Size | Format |
|----------|------|--------|
| iOS App Icon | 1024x1024 | PNG, no transparency |
| Android Adaptive | 1024x1024 | PNG with safe zone |
| App Store | 1024x1024 | PNG |

### Screenshots

| Platform | Sizes Needed |
|----------|--------------|
| iOS | 6.7" (1290x2796), 6.5" (1284x2778), 5.5" (1242x2208) |
| Android | Phone (1080x1920+), Tablet (optional) |

**Tip:** Use a screenshot tool like https://screenshots.pro or https://shotbot.io

## Appendix C: App Store Descriptions

### Short Description (80 chars)
```
Track disc golf rounds, compete in leagues, improve your game.
```

### Full Description
```
RGDGC is the official app for River Grove Disc Golf Club.

FEATURES:
• Score your rounds at any course
• Track detailed putting statistics (C1, C2)
• Join league events and compete for prizes
• View real-time leaderboards
• AR distance measurement
• Connect with fellow disc golfers

LEAGUE FEATURES:
• Check in to Sunday Singles and Dubs events
• Automatic points calculation
• Season standings and prize tracking
• Event notifications and reminders

IMPROVE YOUR GAME:
• Putting probability analysis
• Strokes gained statistics
• Round-over-round progress tracking
• Personal best tracking by course

Whether you're a league regular or just tracking casual rounds, RGDGC helps you play better disc golf.

Join the River Grove Disc Golf community today!
```

### Keywords (iOS)
```
disc golf, frisbee golf, scorecard, league, PDGA, putting, rounds, courses
```

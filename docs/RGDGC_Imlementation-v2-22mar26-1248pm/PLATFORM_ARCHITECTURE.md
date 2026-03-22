# RGDGC Platform & Deployment Architecture

## Overview

This document addresses the critical question: **Website vs Native App?** and provides the complete deployment architecture for both options.

---

## 1. Platform Decision: Native App (Recommended)

### 1.1 Comparison Matrix

| Factor | Website (PWA) | Native App | Winner |
|--------|--------------|------------|--------|
| **App Store Presence** | No | Yes - discoverability, trust | 🏆 Native |
| **Push Notifications** | Limited, unreliable | Full support | 🏆 Native |
| **Offline Support** | Good | Excellent | 🏆 Native |
| **AR Features** | Limited WebXR | Full ARKit/ARCore | 🏆 Native |
| **Performance** | Good | Excellent | 🏆 Native |
| **Home Screen** | "Add to Home" prompt | One-tap install | 🏆 Native |
| **Updates** | Instant | App Store review (1-3 days) | 🏆 Web |
| **Development Cost** | Lower | Higher | 🏆 Web |
| **Camera Access** | Limited | Full | 🏆 Native |
| **Background Tasks** | Very limited | Supported | 🏆 Native |

### 1.2 Recommendation: React Native

**Why React Native over Flutter or full native?**

| Option | Pros | Cons |
|--------|------|------|
| **React Native** | Single codebase, JS ecosystem, hot reload, CodePush OTA updates | Bridge overhead |
| **Flutter** | Great performance, beautiful UI | Dart learning curve, larger app size |
| **Native (Swift + Kotlin)** | Best performance, full platform access | 2x development cost, separate codebases |

**React Native is the sweet spot** because:
1. **One codebase** for iOS and Android
2. **CodePush** allows over-the-air updates (bypasses app store for JS changes)
3. **Expo** simplifies development and builds
4. **Large community** and npm ecosystem
5. **Native modules** available for AR, camera, etc.

### 1.3 Architecture Decision

```
┌─────────────────────────────────────────────────────────────┐
│                      RGDGC ECOSYSTEM                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           MOBILE APP (React Native + Expo)          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │   iOS App   │  │ Android App │  │   Shared    │  │   │
│  │  │  (App Store)│  │(Play Store) │  │   Code 95%  │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              BACKEND API (FastAPI + PostgreSQL)     │   │
│  │                   Hosted on Railway                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│              ┌─────────────┼─────────────┐                  │
│              ▼             ▼             ▼                  │
│  ┌───────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │    Redis      │ │  PostgreSQL │ │  S3 Storage │         │
│  │   (Cache)     │ │  (Database) │ │   (Files)   │         │
│  └───────────────┘ └─────────────┘ └─────────────┘         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               WEB ADMIN DASHBOARD                    │   │
│  │         (React SPA - admin.rgdgc.com)               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              BOTS (Discord, Telegram)               │   │
│  │           OpenClaw on separate server                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

### 2.1 Complete Stack

| Layer | Technology | Hosting |
|-------|------------|---------|
| **iOS App** | React Native + Expo | App Store |
| **Android App** | React Native + Expo | Play Store |
| **Backend API** | FastAPI + SQLAlchemy | Railway |
| **Database** | PostgreSQL 15 | Railway (managed) |
| **Cache** | Redis | Railway (managed) |
| **File Storage** | S3 / Cloudflare R2 | AWS or Cloudflare |
| **Admin Dashboard** | React + Vite | Vercel or Netlify |
| **AI Bot** | OpenClaw (Python) | Railway or Fly.io |
| **Blockchain** | Ethereum (Sepolia → Mainnet) | Infura/Alchemy |

### 2.2 Why Railway?

| Feature | Railway | Heroku | Render | Fly.io |
|---------|---------|--------|--------|--------|
| **Price** | ~$5-20/mo | $7-25/mo | $7-25/mo | $5-20/mo |
| **Managed Postgres** | ✓ | ✓ | ✓ | ✓ |
| **Managed Redis** | ✓ | $ | ✓ | Manual |
| **Deploy from GitHub** | ✓ | ✓ | ✓ | ✓ |
| **Docker support** | ✓ | ✓ | ✓ | ✓ |
| **Zero config** | ✓ | ~ | ~ | Manual |
| **Free tier** | $5 credit/mo | None | 750 hrs/mo | $5/mo |

**Railway wins** for simplicity and all-in-one managed services.

---

## 3. Docker Configuration

### 3.1 Why Docker?

| Benefit | Description |
|---------|-------------|
| **Consistency** | Same environment locally and in production |
| **Isolation** | Dependencies don't conflict |
| **Reproducibility** | Anyone can run the same setup |
| **Easy deployment** | Railway/Render/Fly.io all support Docker |

### 3.2 Project Structure with Docker

```
rgdgc-app/
├── docker-compose.yml          # Local development
├── docker-compose.prod.yml     # Production (optional)
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/
│   │   ├── api/
│   │   └── services/
│   └── alembic/
│
├── mobile/                     # React Native (not dockerized)
│   ├── package.json
│   ├── app.json
│   ├── src/
│   └── ios/
│   └── android/
│
├── admin-dashboard/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│
└── bot/
    ├── Dockerfile
    ├── requirements.txt
    └── skills/
```

### 3.3 Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 3.4 Docker Compose (Local Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/rgdgc
      - REDIS_URL=redis://redis:6379
      - SECRET_KEY=dev-secret-key-change-in-prod
      - DEBUG=true
    volumes:
      - ./backend:/app
    depends_on:
      - db
      - redis
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=rgdgc
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # Admin dashboard (optional for local dev)
  admin:
    build: ./admin-dashboard
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8000
    volumes:
      - ./admin-dashboard:/app
      - /app/node_modules

volumes:
  postgres_data:
```

### 3.5 Running Locally with Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Run database migrations
docker-compose exec api alembic upgrade head

# Stop all services
docker-compose down

# Reset database
docker-compose down -v  # Removes volumes
docker-compose up -d
```

---

## 4. Mobile App Setup (React Native + Expo)

### 4.1 Project Initialization

```bash
# Install Expo CLI
npm install -g expo-cli eas-cli

# Create new project
npx create-expo-app rgdgc-mobile --template expo-template-blank-typescript

cd rgdgc-mobile

# Install dependencies
npm install @react-navigation/native @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context
npm install axios @tanstack/react-query
npm install expo-secure-store  # For auth tokens
npm install expo-camera expo-location  # For AR features
npm install react-native-reanimated react-native-gesture-handler
```

### 4.2 Expo Configuration

```json
// app.json
{
  "expo": {
    "name": "RGDGC",
    "slug": "rgdgc",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#1B5E20"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.rgdgc.app",
      "buildNumber": "1",
      "infoPlist": {
        "NSCameraUsageDescription": "RGDGC uses your camera for AR distance measurement",
        "NSLocationWhenInUseUsageDescription": "RGDGC uses your location to find nearby courses"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1B5E20"
      },
      "package": "com.rgdgc.app",
      "versionCode": 1,
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.ACCESS_FINE_LOCATION"
      ]
    },
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    },
    "plugins": [
      "expo-camera",
      "expo-location"
    ]
  }
}
```

### 4.3 EAS Build Configuration

```json
// eas.json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "your-app-store-connect-app-id",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "production"
      }
    }
  }
}
```

---

## 5. Complete File Structure

```
rgdgc-app/
│
├── README.md
├── docker-compose.yml
├── .env.example
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   └── app/
│       ├── __init__.py
│       ├── main.py
│       ├── config.py
│       ├── db/
│       │   ├── __init__.py
│       │   ├── database.py
│       │   └── init_db.py
│       ├── models/
│       │   ├── __init__.py
│       │   ├── user.py
│       │   ├── course.py
│       │   ├── round.py
│       │   ├── league.py
│       │   └── transaction.py
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── user.py
│       │   ├── round.py
│       │   └── league.py
│       ├── api/
│       │   ├── __init__.py
│       │   └── v1/
│       │       ├── __init__.py
│       │       ├── router.py
│       │       ├── auth.py
│       │       ├── users.py
│       │       ├── rounds.py
│       │       ├── leagues.py
│       │       └── admin.py
│       ├── core/
│       │   ├── __init__.py
│       │   ├── security.py
│       │   ├── permissions.py
│       │   └── web3_auth.py
│       └── services/
│           ├── __init__.py
│           ├── user_service.py
│           ├── scoring_service.py
│           ├── leaderboard_service.py
│           └── blockchain_service.py
│
├── mobile/
│   ├── app.json
│   ├── eas.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── babel.config.js
│   ├── assets/
│   │   ├── icon.png
│   │   ├── splash.png
│   │   └── adaptive-icon.png
│   ├── src/
│   │   ├── App.tsx
│   │   ├── navigation/
│   │   │   ├── index.tsx
│   │   │   ├── MainTabs.tsx
│   │   │   └── AuthStack.tsx
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── ScoreRoundScreen.tsx
│   │   │   ├── StatsScreen.tsx
│   │   │   ├── LeagueScreen.tsx
│   │   │   ├── ChatScreen.tsx
│   │   │   └── ProfileScreen.tsx
│   │   ├── components/
│   │   │   ├── ScoreCard.tsx
│   │   │   ├── HoleScore.tsx
│   │   │   ├── Leaderboard.tsx
│   │   │   └── EventCard.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useRounds.ts
│   │   │   └── useLeague.ts
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   └── storage.ts
│   │   └── utils/
│   │       ├── constants.ts
│   │       └── helpers.ts
│   └── ios/
│   └── android/
│
├── admin-dashboard/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       └── components/
│
├── bot/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   └── skills/
│       ├── standings/
│       ├── event-checkin/
│       └── pdga-rules/
│
├── contracts/  # Solidity
│   ├── RGDGToken.sol
│   ├── Treasury.sol
│   ├── hardhat.config.js
│   └── scripts/
│       └── deploy.js
│
└── docs/
    ├── DEVELOPMENT_PLAN.md
    ├── ARCHITECTURE_REVIEW.md
    └── operations/
        ├── ADMIN_GUIDE.md
        ├── USER_ONBOARDING.md
        ├── LOCAL_DEV_GUIDE.md
        └── DEPLOYMENT_GUIDE.md
```

---

## 6. Environment Variables

### 6.1 Backend (.env)

```bash
# backend/.env

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rgdgc

# Redis
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=your-super-secret-key-change-this
JWT_SECRET_KEY=your-jwt-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=24

# App
DEBUG=true
ENVIRONMENT=development
API_VERSION=v1

# Blockchain (optional)
WEB3_PROVIDER_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
RGDG_TOKEN_ADDRESS=0x...
TREASURY_ADDRESS=0x...
DEPLOYER_PRIVATE_KEY=0x...  # Never commit this!

# External Services
ANTHROPIC_API_KEY=sk-ant-...  # For AI bot
DISCORD_BOT_TOKEN=...
TELEGRAM_BOT_TOKEN=...

# Push Notifications
EXPO_ACCESS_TOKEN=...

# Storage
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=rgdgc-uploads
```

### 6.2 Mobile (app.config.js)

```javascript
// mobile/app.config.js
export default {
  expo: {
    // ... other config
    extra: {
      apiUrl: process.env.API_URL || 'http://localhost:8000',
      environment: process.env.ENVIRONMENT || 'development',
    },
  },
};
```

---

## 7. Service Dependencies

### 7.1 Required Accounts

| Service | Purpose | Cost | Setup Time |
|---------|---------|------|------------|
| **Apple Developer** | iOS App Store | $99/year | 1-2 days (approval) |
| **Google Play Console** | Android Play Store | $25 one-time | 1-2 days |
| **Railway** | Backend hosting | ~$5-20/mo | 10 minutes |
| **Expo** | Mobile builds | Free tier | 5 minutes |
| **Cloudflare** | DNS, R2 storage | Free-$20/mo | 30 minutes |
| **Infura/Alchemy** | Ethereum RPC | Free tier | 5 minutes |

### 7.2 Optional Services

| Service | Purpose | Cost |
|---------|---------|------|
| **Sentry** | Error tracking | Free tier |
| **PostHog** | Analytics | Free tier |
| **Resend** | Transactional email | Free tier |
| **Uptime Robot** | Monitoring | Free |

---

## 8. Security Considerations

### 8.1 Secrets Management

```bash
# NEVER commit secrets. Use:
# 1. Railway environment variables (production)
# 2. .env files locally (gitignored)
# 3. Expo secrets for mobile

# .gitignore should include:
.env
.env.*
*.pem
*.key
google-service-account.json
```

### 8.2 API Security

```python
# backend/app/core/security.py

from fastapi import Security, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return await get_user(user_id)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

---

## 9. Scaling Considerations

### 9.1 When to Scale

| Metric | Threshold | Action |
|--------|-----------|--------|
| Response time | > 500ms avg | Add caching, optimize queries |
| Error rate | > 1% | Debug, add error handling |
| CPU usage | > 80% sustained | Upgrade instance |
| Memory | > 85% | Optimize or upgrade |
| Active users | > 1000 DAU | Consider horizontal scaling |

### 9.2 Scaling Path

```
Phase 1: Single Server (Railway)
├── 1 API instance
├── Managed PostgreSQL
├── Managed Redis
└── Handles: ~100-500 concurrent users

Phase 2: Basic Scaling
├── 2 API instances (load balanced)
├── Connection pooling (PgBouncer)
├── CDN for static assets
└── Handles: ~500-2000 concurrent users

Phase 3: Production Scale (if needed)
├── Kubernetes or managed containers
├── Read replicas for database
├── Dedicated Redis cluster
├── Multiple availability zones
└── Handles: 10,000+ concurrent users
```

For a disc golf club app, **Phase 1 is sufficient** for years.

---

*Document Version: 1.0*
*Last Updated: March 2026*
*Owner: RGDGC Tech Team*

# Railway Environment Variables

Set these in the Railway dashboard → Service → Variables:

## Required
```
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/rgdgc
REDIS_URL=redis://default:pass@host:6379
SECRET_KEY=<64-char-random-string>
JWT_SECRET=<64-char-random-string>
ENVIRONMENT=production
CORS_ORIGINS=https://rgdgc.com,https://admin.rgdgc.com
```

## LLM (pick one or more)
```
OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GEMINI_API_KEY=...
# GROQ_API_KEY=gsk_...
```

## Optional
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
OWNER_KEY=<strong-random-string>
```

## Railway provides automatically
```
PORT (auto-set by Railway)
RAILWAY_ENVIRONMENT
```

## Deploy steps
1. Connect GitHub repo (BlakeSan42/RGDGC)
2. Set root directory to `backend`
3. Add PostgreSQL plugin (Railway auto-provides DATABASE_URL)
4. Add Redis plugin (Railway auto-provides REDIS_URL)
5. Set the variables above
6. Deploy — Railway auto-builds from Dockerfile

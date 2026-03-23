# RGDGC — River Grove Disc Golf Club Platform

## What This Workspace Is
An ecosystem — not just an app — for River Grove Disc Golf Club:

### Core Projects
| Directory | What | Tech |
|-----------|------|------|
| `backend/` | REST API + business logic | FastAPI, SQLAlchemy 2.0, Alembic |
| `mobile/` | iOS + Android native app | React Native + Expo |
| `admin-dashboard/` | Web admin panel | React + Vite |
| `mcp-server/` | Claude MCP server | TypeScript, MCP SDK |
| `contracts/` | Smart contracts (P1) | Solidity, Hardhat |
| `ace-bot/` | AI chatbot (Telegram) | Clawd AI bot |

### Five Pillars
1. **Disc Golf Game** — Full playable mobile game with physics-based flight, career mode, 8 game modes, skill progression
2. **Putting Analytics** — Physics-based probability model (Gelman & Nolan), player parameter fitting, strokes gained
3. **AR Training** — ARKit/ARCore distance measurement, putting overlay, stance guide, practice challenges
4. **League Management** — Events, scoring, standings, prizes, $RGDG token payments
5. **AI Assistant** — In-app Clawd bot + Claude MCP server

## The Golden Rule
**PostgreSQL is the source of truth.** All league standings, scores, and player data
come from the database. The MCP server, Clawd bot, and mobile app all read/write
through the FastAPI backend — never directly to the database.

## Architecture Overview
```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
├──────────────┬──────────────┬──────────────┬────────────┤
│  Mobile App  │ Admin Dash   │  Clawd Bot   │  Claude    │
│ (Expo/RN)   │ (React Web)  │  (In-App)    │  MCP       │
└──────┬───────┴──────┬───────┴──────┬───────┴─────┬──────┘
       │              │              │             │
       ▼              ▼              ▼             ▼
┌─────────────────────────────────────────────────────────┐
│              FastAPI Backend (Railway)                    │
│         api.rgdgc.com  •  /api/v1/*                     │
├─────────────────────────────────────────────────────────┤
│  Auth  │ Scoring │ League │ Putting │ Blockchain (P1)   │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────┬──────────────────────────────────┐
│  PostgreSQL (Railway) │  Redis (Railway)                 │
└──────────────────────┴──────────────────────────────────┘
```

## Technology Stack
| Layer | Technology | Hosting |
|-------|-----------|---------|
| **Mobile** | React Native + Expo | App Store + Play Store |
| | ARKit (iOS) / ARCore (Android) | On-device |
| | ethers.js | MetaMask mobile (P1) |
| **Admin** | React + Vite + TailwindCSS | Vercel or Netlify |
| **Backend** | FastAPI (Python 3.11) | Railway (~$15/mo) |
| | SQLAlchemy 2.0 + Alembic | — |
| | Celery + Redis | Background tasks |
| **Database** | PostgreSQL 15 (managed) | Railway |
| | Redis 7 (managed) | Railway |
| **Storage** | S3 / Cloudflare R2 | AWS or Cloudflare |
| **Blockchain** | Solidity + Hardhat | Sepolia → Mainnet |
| | Infura / Alchemy | Ethereum RPC |
| **Bot** | Clawd (Python) | Railway or Fly.io |
| **MCP** | TypeScript MCP SDK | Local (Claude Code) |
| **CI/CD** | GitHub Actions + EAS Build | — |
| **Monitoring** | Sentry, UptimeRobot, PostHog | Free tiers |

## LLM Provider Fallback System
Three-tier resilience (adapted from MadWorld):
```bash
source scripts/switch_claude_provider.sh [anthropic|vertex|local|auto|status]
```

| Tier | Provider | Capabilities | When |
|------|----------|-------------|------|
| 1 | Anthropic API (default) | Full: MCP tools, multi-file, extended thinking | Normal ops |
| 2 | Google Vertex AI | Full: same Claude models via Google | Anthropic down |
| 3 | Local Ollama | Degraded: code gen, Q&A, scripts. No MCP/tools | All cloud down |

## MCP Server
One MCP server exposes club data tools:
- `rgdgc:*` — Query leaderboards, player stats, events, results, rules, course info, handicaps

### Tools Available
| Tool | Purpose |
|------|---------|
| `get_leaderboard` | Season standings for a league |
| `get_player_stats` | Individual player statistics |
| `get_upcoming_events` | Next scheduled league events |
| `get_event_results` | Results for a completed event |
| `lookup_rule` | Search PDGA rules by keyword |
| `get_course_info` | Course/layout details and hole data |
| `calculate_handicap` | Player handicap from round history |
| `get_player_rounds` | Recent round history |
| `get_event_checkins` | Who's checked in for an event |

## Tool Separation (CRITICAL)
- **Mobile App**: Player-facing. Scoring, game, AR, putting, leagues. React Native.
- **Admin Dashboard**: Admin-facing. Event management, results, treasury. React web.
- **Clawd Bot**: In-app AI assistant (Chat tab in mobile app).
- **Claude Code (this interface)**: ALL local development. Use MCP tools + direct DB.
- All interfaces share the same FastAPI backend. They are independent.

## Disc Golf Game

### Game Modes
| Mode | Description | Unlock |
|------|------------|--------|
| Quick Round | Random 9/18 holes, 5-15 min | Default |
| Career | Recreational → MA4/3/2/1 → MPO → Elite | Default |
| Practice Range | Free throw practice | Default |
| Putting Practice | Circle of Death, Ladder, 21, Free | Default |
| Challenge | Daily/weekly challenges | Level 2 |
| Pass-n-Play | Local multiplayer | Level 3 |
| Tournament | vs AI or online | Level 5 |
| Course Builder | Create custom courses | Level 15 |

### Throw Mechanics
- Drag to aim direction
- Swipe for power (0-100%)
- Swipe angle for release (hyzer/anhyzer/flat)
- Release timing for nose angle
- Real flight numbers (Speed/Glide/Turn/Fade)

### Skill Progression
| Branch | Upgrades |
|--------|----------|
| Power | +5% distance, faster meter, max power |
| Accuracy | Tighter release, trajectory preview, wind resist |
| Putting | Larger sweet spot, C2 makes, chain magnet |
| Mental | Mulligans, pressure resist, focus mode |

## Putting Physics Model
Based on Gelman & Nolan (2002) — "A Probability Model for Golf Putting"

```
P_success = P_angle × P_distance × (1 - ε)
θ₀ = arcsin((R - r) / x)    # R=basket, r=disc, x=distance
```

### Player Skill Parameters
| Level | σ_angle (rad) | σ_distance (m) | ε | C1X % | C2 % |
|-------|--------------|----------------|---|-------|------|
| Beginner | 0.08 | 1.2 | 0.10 | ~50% | ~10% |
| Recreational | 0.05 | 0.8 | 0.06 | ~65% | ~18% |
| Intermediate | 0.035 | 0.5 | 0.04 | ~75% | ~25% |
| Advanced | 0.025 | 0.35 | 0.03 | ~82% | ~32% |
| Pro (MPO) | 0.018 | 0.25 | 0.02 | ~88% | ~38% |
| Elite | 0.015 | 0.20 | 0.015 | ~92% | ~42% |

### Environmental Modifiers
- Wind: `windFactor = 1 - (windSpeed * distance * 0.002)`
- Elevation: increases σ_distance based on grade
- Obstacles: increases σ_angle by 1.2x-1.5x

## AR Features
| Feature | Priority | Platform |
|---------|----------|----------|
| Distance Measurement | P1 | ARKit + ARCore |
| Putting Overlay (probability, wind, trajectory) | P1 | ARKit + ARCore |
| Stance Guide (pose estimation) | P2 | ARKit + ARCore |
| Practice Mode (C1/C2 rings, drills) | P2 | ARKit + ARCore |
| Flight Path Visualization | P2 | ARKit + ARCore |

All AR features work **offline** with cached player parameters.

## Database Schema

### All Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | Player/admin accounts | email, username, role, wallet_address, handicap |
| `courses` | Course metadata | name, location, lat/lng |
| `layouts` | Course configurations | course_id, name, holes, total_par, difficulty |
| `holes` | Individual hole data | layout_id, hole_number, par, distance |
| `rounds` | Scoring sessions | user_id, layout_id, total_score, is_practice |
| `hole_scores` | Hole-by-hole scores | round_id, hole_id, strokes, putts, ob_strokes |
| `putt_attempts` | Individual putt tracking | round_id, distance, made, zone, wind, style |
| `leagues` | League definitions | name, season, league_type, points_rule, drop_worst |
| `events` | League match days | league_id, layout_id, event_date, status |
| `teams` | Doubles/team groupings | event_id, name |
| `team_members` | Team roster | team_id, user_id |
| `results` | Event outcomes | event_id, user_id, total_strokes, position, points_earned |
| `prizes` | Prize structure | league_id, position, amount_usd, amount_rgdg |
| `transactions` | Blockchain payments (P1) | user_id, tx_type, amount, tx_hash, status |
| `achievements` | Player badges/unlocks | user_id, achievement_type, earned_at |

### Critical Table Notes

**results:**
- `total_score` is relative to par (negative = under par)
- `total_strokes` is raw stroke count
- DNF/DQ players get 0 points
- Position ties: same position, same points, next position skips

**leagues:**
- `points_rule = 'field_size'` → Points = num_participants - position + 1
- `drop_worst` → Number of worst events excluded from season totals

**events:**
- Status flow: `upcoming` → `active` → `completed` (or `cancelled`)

**putt_attempts:**
- `zone`: c1 (0-10m), c1x (10m circle), c2 (10-20m)
- `style`: spin, push, spush, turbo
- `result_type`: center_chains, edge_chains, cage, miss_left, miss_right, miss_long, miss_short

## API Endpoints

### Authentication
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/auth/register` | Register (email/Apple/Google) |
| POST | `/api/v1/auth/login` | Login (email/password) |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Invalidate tokens |
| POST | `/api/v1/auth/web3/nonce` | Get MetaMask nonce (P1) |
| POST | `/api/v1/auth/web3/verify` | Verify wallet signature (P1) |

### Scoring
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/rounds` | Start a round |
| GET | `/api/v1/rounds/{id}` | Round details + scores |
| POST | `/api/v1/rounds/{id}/scores` | Submit hole score |
| PUT | `/api/v1/rounds/{id}/complete` | Finalize round |
| GET | `/api/v1/rounds` | User's round history |

### Putting Analytics
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/putting/attempt` | Log a putt attempt |
| POST | `/api/v1/putting/batch` | Sync offline putts |
| GET | `/api/v1/putting/stats` | Putting statistics by zone/distance |
| GET | `/api/v1/putting/probability` | Get make probability for distance |
| GET | `/api/v1/putting/strokes-gained` | Strokes gained putting analysis |

### Leagues & Events
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/leagues` | List active leagues |
| GET | `/api/v1/leagues/{id}/leaderboard` | Season standings |
| GET | `/api/v1/events/{id}` | Event details + results |
| POST | `/api/v1/events/{id}/checkin` | Check into event |
| POST | `/api/v1/events/{id}/results` | Submit results (admin) |
| PUT | `/api/v1/events/{id}/finalize` | Finalize + calc points (admin) |

### Admin
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/admin/users/{id}/role` | Change user role |
| GET | `/api/v1/admin/audit-log` | Audit trail |
| POST | `/api/v1/admin/announcements` | Club announcements |
| GET | `/api/v1/admin/analytics/dashboard` | Admin analytics |
| POST | `/api/v1/admin/cache/clear` | Clear Redis cache |

### Blockchain (P1)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/blockchain/balance` | RGDG token balance |
| POST | `/api/v1/blockchain/pay-fee` | Pay event fee |
| GET | `/api/v1/blockchain/transactions` | Transaction history |
| GET | `/api/v1/blockchain/treasury` | Treasury stats (admin) |

## Points Calculation
```
Points = num_participants - finish_position + 1

Example (8 players):
  1st = 8 pts, 2nd = 7 pts, ..., 8th = 1 pt
  DNF/DQ = 0 pts
  Ties: same position, same points, next position skips
```

## Design System
| Element | Value |
|---------|-------|
| Primary Font | Inter |
| Display Font | Poppins |
| Mono Font | JetBrains Mono (scores) |
| Primary Color | Forest Green #1B5E20 |
| CTA Color | Disc Orange #FF6B35 |
| Eagle | Purple #7B1FA2 |
| Birdie | Green #1B5E20 |
| Par | Gray #424242 |
| Bogey | Orange #E65100 |
| Double+ | Red #B71C1C |
| Min Touch Target | 44x44px |
| Accessibility | WCAG 2.1 AA |

## Mobile Navigation (5-Tab Bar)
| Tab | Sections |
|-----|----------|
| Play | Start Round, Recent Rounds, Game Modes |
| Stats | Overview, History, Putting, Trends |
| League | Standings, Events, My Points |
| Chat | General, @clawd bot |
| Profile | My Profile, Settings, Help |

## Issue Detection → Resolution Workflow
1. **Data first:** Query the database or API for hard numbers
2. **Logs second:** Check application logs (Railway dashboard / Sentry)
3. **Bot third:** Check Clawd for user complaints or failures
4. **Log the signal:** Write findings to `signals/active_issues.json`
5. **Propose the fix:** Specify changes in the relevant component

## Self-Questioning Protocol
- "Is this actually true or am I pattern-matching?" → Verify with data.
- "What would disprove this?" → Check the counter-evidence.
- "Is this the root cause or a symptom?" → Go one level deeper.
- "What changes if I'm wrong?" → Assess risk of acting on bad analysis.
- "Can someone act on this today?" → If not, make it actionable.

## Key Metrics to Watch
| Metric | Target | Alert |
|--------|--------|-------|
| API Response Time (P95) | <200ms | >500ms |
| API Error Rate | <1% | >5% |
| Active Players (weekly) | Growing | Declining 3 weeks |
| Event Check-in Rate | >80% | <60% |
| Round Completion Rate | >95% | <85% |
| Putting C1X (avg) | Improving | Declining |
| App Crash Rate | <1% | >3% |
| Bot Response Time | <2s | >5s |

## Signals Directory
- `signals/active_issues.json` — Current open issues
- `signals/resolution_log.md` — Issues found and fixed
- `signals/learning_ledger.jsonl` — Structured session learnings

## Terminology
- Players are **"players"** or **"members"** (not "users" in UI)
- Leagues: **"Dubs"** (doubles) and **"Sunday Singles"**
- Currency: **$RGDG** (River Grove Disc Golf Token)
- Location: **Kingwood, TX** (Houston metro, Harris County)
- Home course: **River Grove DGC**
- Layouts: **All 18 plus 3A** (default/tournament), **Standard 18**, **Ryne Theis Memorial**
- Putting zones: **C1** (0-10m), **C1X** (circle 1 exclusive), **C2** (10-20m)

## Skills
See `.claude/skills/` for workflows:
- `autopilot.md` — **Start here.** Autonomous work: read roadmap, claim task, execute, repeat.
- `coordinate.md` — Multi-session sync, messaging, task claiming
- `orchestrate.md` — Master reasoning for cross-system investigation
- `diagnose.md` — Step-by-step issue diagnosis
- `visualize.md` — Data visualization & architecture diagrams

## Multi-Terminal Team Protocol (MANDATORY)

Up to 6 Claude Code terminals work simultaneously. You are a team member.

### Rules (enforced by pre-commit hook)
1. **Never commit to main.** Work on a feature branch: `t<N>/<task-name>`
2. **Claim files before editing.** `./scripts/team.sh claim <path> "description"`
3. **Check in regularly.** `./scripts/team.sh checkin "what I'm doing"`
4. **Merge via script.** `./scripts/team.sh merge` (runs tests, rebases, merges)

### On Session Startup
```bash
./scripts/team.sh status          # See active terminals and claims
./scripts/team.sh init t<N>       # Register (pick unclaimed t1-t6)
git checkout -b t<N>/<task-name>  # Create feature branch
./scripts/team.sh claim <path>    # Claim your work area
./scripts/dev-server.sh start     # Shared backend on :8001
```

### Quick Reference
| Action | Command |
|--------|---------|
| See team | `./scripts/team.sh status` |
| See history | `./scripts/team.sh board` |
| Register | `./scripts/team.sh init t1` |
| Claim files | `./scripts/team.sh claim backend/app/tasks/ "celery"` |
| Release claim | `./scripts/team.sh release backend/app/tasks/` |
| Check who owns | `./scripts/team.sh check backend/app/tasks/` |
| Post update | `./scripts/team.sh checkin "finished X"` |
| Sync branch | `./scripts/team.sh sync` |
| Merge to main | `./scripts/team.sh merge` |

### Shared Resources (DO NOT duplicate)
- **PostgreSQL** on :5433 (Docker: rgdgc-db)
- **Redis** on :6381 (Docker: rgdgc-redis)
- **Dev server** on :8001 (`./scripts/dev-server.sh`)

## Autonomous Operation
When starting a session without specific instructions, enter **autopilot mode**:
1. Run `./scripts/team.sh status` — see who's active, what's claimed
2. Read `.claude/coordination/roadmap.md` for prioritized task queue
3. Pick the highest-priority unclaimed task
4. Create a branch, claim files, execute, merge, pick the next one

## Development Server (CRITICAL — READ THIS)

**DO NOT start your own uvicorn process.** Multiple terminals sharing one backend
is required — starting duplicate servers causes port conflicts, DB pool exhaustion,
and data corruption.

```bash
# Use the shared dev server manager:
./scripts/dev-server.sh start           # Start (or confirm already running)
./scripts/dev-server.sh status          # Health check + DB connections
./scripts/dev-server.sh restart         # After code changes (has --reload, rarely needed)
./scripts/dev-server.sh logs            # Tail server output
./scripts/dev-server.sh stop            # Only when done for the day
```

The dev server runs on **http://localhost:8001** with `--reload` enabled.
All terminals, scripts, and tests should hit this API — never start a second uvicorn.

**For seed scripts** that need direct DB access (e.g., `seed_elevation_profiles.py`),
the shared server can stay running — they use separate short-lived connections.
Just don't run multiple write-heavy scripts simultaneously.

## Deployment
```bash
# Local development
docker compose up -d                    # PostgreSQL + Redis
./scripts/dev-server.sh start           # Shared backend (ONE instance)
cd mobile && npx expo start             # Expo dev server

# Production (Railway)
git push origin main                    # Auto-deploys backend
npx expo publish                        # OTA update to mobile
eas build --platform all --profile production  # Native builds

# Health check
./scripts/health-check.sh
```

## Launch Strategy
| Phase | Action | Timeline |
|-------|--------|----------|
| 1 | Backend on Railway | 30 minutes |
| 2 | Mobile preview via Expo Go | 30 minutes |
| 3 | App Store + Play Store | 1-7 days |

Monthly cost: ~$15 (Railway). One-time: ~$125 (Apple $99 + Google $25).

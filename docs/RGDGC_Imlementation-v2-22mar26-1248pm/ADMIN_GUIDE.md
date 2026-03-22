# RGDGC Admin Operations Guide

## Overview

This guide covers how administrators maintain and control all components of the RGDGC disc golf app ecosystem. The system has multiple layers that require different levels of administrative access.

---

## 1. Admin Role Hierarchy

### 1.1 Role Definitions

| Role | Access Level | Responsibilities |
|------|--------------|------------------|
| **Super Admin** | Full system access | Infrastructure, deployments, database, all features |
| **League Admin** | League management | Events, results, prizes, player management |
| **Club Admin** | Club operations | Announcements, member verification, course info |
| **Moderator** | Content moderation | User reports, chat moderation, content review |

### 1.2 Permission Matrix

```
Feature                    | Super | League | Club | Mod
---------------------------|-------|--------|------|----
Deploy/Infrastructure      |   ✓   |        |      |
Database migrations        |   ✓   |        |      |
User role assignment       |   ✓   |   ✓    |      |
Create/edit events         |   ✓   |   ✓    |   ✓  |
Enter event results        |   ✓   |   ✓    |      |
Distribute prizes          |   ✓   |   ✓    |      |
Manage $RGDG treasury      |   ✓   |        |      |
Edit course information    |   ✓   |   ✓    |   ✓  |
Post announcements         |   ✓   |   ✓    |   ✓  |
Moderate users             |   ✓   |   ✓    |   ✓  |  ✓
View analytics             |   ✓   |   ✓    |   ✓  |
Access audit logs          |   ✓   |   ✓    |      |
```

---

## 2. Admin Dashboard

### 2.1 Dashboard Access

**URL:** `https://app.rgdgc.com/admin` (web) or Admin tab in mobile app

**Authentication:** 
- Standard login + 2FA required for admin roles
- Session timeout: 30 minutes inactive
- IP allowlisting optional for Super Admin

### 2.2 Dashboard Sections

```
┌─────────────────────────────────────────────────────────────┐
│  RGDGC ADMIN DASHBOARD                    👤 Blake (Super)  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 👥 MEMBERS   │  │ 🏆 EVENTS    │  │ 💰 TREASURY  │      │
│  │    127       │  │    3 Active  │  │   $2,450     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 📊 ANALYTICS │  │ 🤖 BOT       │  │ ⚙️ SETTINGS  │      │
│  │   Dashboard  │  │   Status: ✓  │  │   Configure  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  QUICK ACTIONS                                              │
│  ├─ Create New Event                                        │
│  ├─ Enter Today's Results                                   │
│  ├─ Send Announcement                                       │
│  └─ View Pending Approvals (3)                              │
│                                                             │
│  RECENT ACTIVITY                                            │
│  • Blake entered results for Sunday Singles (2 min ago)     │
│  • New member joined: @discgolfer42 (15 min ago)            │
│  • Prize distributed: $50 to @acemaker (1 hour ago)         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Component-by-Component Admin Controls

### 3.1 Backend API (FastAPI)

**Location:** Self-hosted or Railway/Render

**Admin Endpoints:**

```
POST   /api/v1/admin/users/{id}/role          # Assign role
DELETE /api/v1/admin/users/{id}               # Deactivate user
GET    /api/v1/admin/audit-log                # View audit trail
POST   /api/v1/admin/announcements            # Send announcement
GET    /api/v1/admin/analytics/dashboard      # Analytics data
POST   /api/v1/admin/cache/clear              # Clear Redis cache
GET    /api/v1/admin/health                   # System health check
```

**Environment Variables to Control:**

```bash
# .env (Super Admin manages)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SECRET_KEY=...                    # Rotate quarterly
JWT_EXPIRY_HOURS=24
ADMIN_EMAILS=blake@rgdgc.com      # Comma-separated
RATE_LIMIT_PER_MINUTE=60
MAINTENANCE_MODE=false            # Set true for maintenance
```

**Maintenance Mode:**
```bash
# Enable maintenance (returns 503 to all non-admin requests)
curl -X POST https://api.rgdgc.com/admin/maintenance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": true, "message": "Back in 30 minutes"}'
```

### 3.2 Database (PostgreSQL)

**Admin Tasks:**

| Task | Frequency | Method |
|------|-----------|--------|
| Backups | Daily (automated) | pg_dump via cron or Railway |
| Migrations | Per release | Alembic CLI |
| Index optimization | Monthly | VACUUM ANALYZE |
| Data export | On request | Admin endpoint + S3 |
| GDPR deletion | On request | Admin endpoint |

**Backup Commands:**
```bash
# Manual backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20260322.sql
```

**Migration Workflow:**
```bash
# Create migration
alembic revision --autogenerate -m "add_new_field"

# Review migration file in alembic/versions/

# Apply to staging
alembic upgrade head

# Apply to production (after testing)
alembic upgrade head
```

### 3.3 Mobile App (React Native)

**Admin Controls Within App:**

```typescript
// Admin-only features gated by role
const AdminRoutes = () => {
  const { user } = useAuth();
  
  if (!['super_admin', 'league_admin', 'club_admin'].includes(user.role)) {
    return <Redirect to="/home" />;
  }
  
  return (
    <Stack.Navigator>
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
      <Stack.Screen name="EventManagement" component={EventManagement} />
      <Stack.Screen name="ResultsEntry" component={ResultsEntry} />
      <Stack.Screen name="MemberManagement" component={MemberManagement} />
      <Stack.Screen name="Announcements" component={Announcements} />
    </Stack.Navigator>
  );
};
```

**App Store Management:**
- **iOS:** App Store Connect (apple.com/appstoreconnect)
- **Android:** Google Play Console (play.google.com/console)

| Task | Platform | Process |
|------|----------|---------|
| Push new version | Both | Build → Submit → Review (1-3 days) |
| Force update | Both | Set `min_version` in backend config |
| Disable version | Both | Remove from store or server-side block |
| View crash reports | iOS: Xcode Organizer, Android: Play Console | |
| A/B testing | Both | Firebase Remote Config |

**Over-the-Air Updates (CodePush):**
```bash
# Push JS-only update (bypasses app store)
appcenter codepush release-react -a RGDGC/rgdgc-ios -d Production
appcenter codepush release-react -a RGDGC/rgdgc-android -d Production
```

### 3.4 AI Bot (OpenClaw)

**Bot Admin Panel:** `https://bot.rgdgc.com/admin`

**Controls:**

| Setting | Description | Default |
|---------|-------------|---------|
| Enabled channels | Which platforms bot responds on | Discord, Telegram |
| Response delay | Min seconds before responding | 1s |
| Skills enabled | Which skills are active | All |
| Rate limit | Max responses per user per hour | 30 |
| Quiet hours | Hours bot doesn't send proactive messages | 10pm-8am |

**Skill Management:**
```bash
# Disable a skill temporarily
curl -X PATCH https://bot.rgdgc.com/admin/skills/standings \
  -H "Authorization: Bearer $BOT_ADMIN_TOKEN" \
  -d '{"enabled": false}'

# Update skill prompt
curl -X PUT https://bot.rgdgc.com/admin/skills/standings/prompt \
  -H "Authorization: Bearer $BOT_ADMIN_TOKEN" \
  -d '{"prompt": "Updated instructions..."}'
```

**Scheduled Jobs:**
```yaml
# jobs.yaml - Edit via admin panel or directly
jobs:
  weekly_standings:
    cron: "0 18 * * 0"  # Sunday 6pm
    skill: standings
    action: post_weekly_update
    channels: [discord_general, telegram_main]
    enabled: true
    
  event_reminder:
    cron: "0 10 * * 6"  # Saturday 10am
    skill: event-checkin
    action: send_reminder
    enabled: true
```

### 3.5 Blockchain / $RGDG Token

**Treasury Management:**

**Multi-sig Wallet:** Requires 2 of 3 signatures for transactions over $100
- Signer 1: Club President
- Signer 2: Treasurer  
- Signer 3: Tech Lead

**Admin Functions (Solidity):**
```solidity
// Only owner can call these
function pause() external onlyOwner;           // Emergency stop
function unpause() external onlyOwner;
function setLeagueFee(uint256 fee) external onlyOwner;
function setMembershipPrice(uint256 price) external onlyOwner;
function withdrawToTreasury(uint256 amount) external onlyOwner;
```

**Etherscan Verification:**
- Contract verified and public at: `etherscan.io/address/0x...`
- All transactions visible and auditable

**Treasury Dashboard:**
```
┌─────────────────────────────────────────────────────────────┐
│  $RGDG TREASURY                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Balance: 450,000 $RGDG ($2,250 USD)                        │
│  ETH for Gas: 0.15 ETH ($375)                               │
│                                                             │
│  PENDING TRANSACTIONS                                       │
│  ├─ Prize payout: 100 $RGDG to 0x1234... (needs 1 sig)     │
│  └─ Fee adjustment: $5 → $7 (needs 2 sigs)                  │
│                                                             │
│  RECENT                                                     │
│  • League fee collected: 20 $RGDG from 0xabcd...           │
│  • Prize distributed: 50 $RGDG to 0x5678...                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.6 Infrastructure Monitoring

**Recommended Stack:**
- **Uptime:** UptimeRobot or Better Uptime (free tier)
- **Logs:** Papertrail or Logtail
- **Errors:** Sentry
- **Analytics:** PostHog or Mixpanel
- **APM:** New Relic or Datadog (if budget allows)

**Health Check Endpoint:**
```json
GET /api/v1/health

{
  "status": "healthy",
  "version": "1.2.3",
  "components": {
    "database": "connected",
    "redis": "connected",
    "blockchain": "connected"
  },
  "uptime": "14d 3h 22m",
  "last_deploy": "2026-03-20T10:30:00Z"
}
```

**Alert Configuration:**
```yaml
# alerts.yaml
alerts:
  - name: API Down
    condition: health_check_fails > 2
    channels: [sms, email, slack]
    
  - name: High Error Rate
    condition: error_rate > 5%
    channels: [slack, email]
    
  - name: Database Connection Issues
    condition: db_connection_fails
    channels: [sms, slack]
    
  - name: Low Treasury Balance
    condition: treasury_eth < 0.05
    channels: [email]
```

---

## 4. Event Management Workflow

### 4.1 Creating an Event

```
Admin Dashboard → Events → Create New

┌─────────────────────────────────────────────────────────────┐
│  CREATE EVENT                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Event Type:    ○ Sunday Singles  ○ Dubs  ○ Tournament     │
│                                                             │
│  Date:          [March 24, 2026      ] [2:00 PM]           │
│  Course:        [River Grove Park    ▼]                    │
│  Layout:        [Longs              ▼]                     │
│                                                             │
│  Entry Fee:     [$10    ] □ Accept $RGDG tokens            │
│  Max Players:   [32     ]                                  │
│                                                             │
│  Prize Pool:                                                │
│  □ Auto-calculate from entries                             │
│  ○ Fixed:  1st [$50] 2nd [$30] 3rd [$20]                  │
│                                                             │
│  Notifications:                                             │
│  ☑ Send announcement when created                          │
│  ☑ Send reminder 24 hours before                           │
│  ☑ Send reminder 2 hours before                            │
│                                                             │
│              [Cancel]  [Create Event]                       │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Entering Results

```
Admin Dashboard → Events → [Select Event] → Enter Results

┌─────────────────────────────────────────────────────────────┐
│  ENTER RESULTS: Sunday Singles - March 24                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Entry Method:                                              │
│  ○ Manual Entry  ○ Import from UDisc  ○ Scan Scorecard     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Pos │ Player        │ Score │ +/-  │ Points │ Prize │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  1  │ @acemaker     │  52   │ -11  │   18   │ $50   │   │
│  │  2  │ @discgolfer42 │  54   │  -9  │   17   │ $30   │   │
│  │  3  │ @chainbanger  │  55   │  -8  │   16   │ $20   │   │
│  │  4  │ @treekicker   │  57   │  -6  │   15   │       │   │
│  │ ... │               │       │      │        │       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Total Participants: 18                                     │
│  Points Formula: 18 - position + 1                          │
│                                                             │
│  ☑ Auto-update season leaderboard                          │
│  ☑ Notify players of results                               │
│  ☑ Post to Discord/Telegram                                │
│                                                             │
│              [Save Draft]  [Publish Results]                │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Prize Distribution

```
After publishing results:

┌─────────────────────────────────────────────────────────────┐
│  DISTRIBUTE PRIZES                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Method:  ○ Cash (manual)  ○ Venmo  ○ $RGDG Token          │
│                                                             │
│  Recipients:                                                │
│  ☑ @acemaker     - $50  [0x1234...5678]  [Send]            │
│  ☑ @discgolfer42 - $30  [0xabcd...efgh]  [Send]            │
│  ☑ @chainbanger  - $20  [0x9876...5432]  [Send]            │
│                                                             │
│  Treasury Balance: 450 $RGDG (sufficient)                   │
│  Gas Estimate: 0.002 ETH                                    │
│                                                             │
│              [Send All]  [Mark as Paid (Cash)]              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. User Management

### 5.1 Member Verification

```
Admin Dashboard → Members → Pending Verification

┌─────────────────────────────────────────────────────────────┐
│  PENDING VERIFICATIONS (3)                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  @newplayer123                                              │
│  Joined: March 21, 2026                                     │
│  PDGA#: 123456 (verified ✓)                                │
│  Facebook: Connected (member of RGDGC group ✓)              │
│                     [Approve]  [Reject]  [Request Info]     │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  @discfan99                                                 │
│  Joined: March 20, 2026                                     │
│  PDGA#: Not provided                                        │
│  Facebook: Not connected                                    │
│                     [Approve]  [Reject]  [Request Info]     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 User Actions

| Action | How | When |
|--------|-----|------|
| Suspend user | Admin → Users → [user] → Suspend | Rule violations |
| Ban user | Admin → Users → [user] → Ban | Severe violations |
| Reset password | Admin → Users → [user] → Reset | User request |
| Change role | Admin → Users → [user] → Edit Role | Promotion/demotion |
| Merge accounts | Admin → Users → Merge | Duplicate accounts |
| Export user data | Admin → Users → [user] → Export | GDPR request |
| Delete user | Admin → Users → [user] → Delete | GDPR request |

---

## 6. Content Moderation

### 6.1 Moderation Queue

```
Admin Dashboard → Moderation

┌─────────────────────────────────────────────────────────────┐
│  MODERATION QUEUE (5 items)                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🚩 REPORTED: Comment by @angryplayer                       │
│  "This course is [expletive] garbage..."                    │
│  Reported by: 2 users | Reason: Inappropriate language      │
│                     [Remove]  [Warn User]  [Dismiss]        │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  🚩 FLAGGED: Profile photo by @newuser                      │
│  [Thumbnail] Auto-flagged: Potential inappropriate content  │
│                     [Approve]  [Remove]  [Ban User]         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Moderation Actions

```typescript
// Moderation action types
type ModerationAction = 
  | { type: 'warn', message: string }
  | { type: 'remove_content', contentId: string }
  | { type: 'suspend', duration: '24h' | '7d' | '30d' }
  | { type: 'ban', reason: string }
  | { type: 'dismiss', reason: string };

// All actions logged to audit trail
interface AuditLogEntry {
  timestamp: Date;
  admin: string;
  action: ModerationAction;
  targetUser: string;
  targetContent?: string;
  notes?: string;
}
```

---

## 7. Analytics & Reporting

### 7.1 Key Metrics Dashboard

```
Admin Dashboard → Analytics

┌─────────────────────────────────────────────────────────────┐
│  ANALYTICS DASHBOARD                    [This Week ▼]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  USERS                           ENGAGEMENT                 │
│  ┌─────────────────────┐        ┌─────────────────────┐    │
│  │ Total: 127          │        │ DAU: 34 (27%)       │    │
│  │ New this week: 8    │        │ WAU: 89 (70%)       │    │
│  │ Active: 112 (88%)   │        │ Avg session: 8 min  │    │
│  └─────────────────────┘        └─────────────────────┘    │
│                                                             │
│  EVENTS                          REVENUE                    │
│  ┌─────────────────────┐        ┌─────────────────────┐    │
│  │ This week: 3        │        │ Entry fees: $540    │    │
│  │ Participants: 52    │        │ Memberships: $150   │    │
│  │ Avg turnout: 17     │        │ Token sales: $75    │    │
│  └─────────────────────┘        └─────────────────────┘    │
│                                                             │
│  ROUNDS LOGGED                                              │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░ 67% of members             │
│  This week: 89 rounds | Avg score: +4.2                     │
│                                                             │
│  [Export Report]  [Schedule Weekly Email]                   │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Automated Reports

| Report | Frequency | Recipients | Content |
|--------|-----------|------------|---------|
| Weekly Summary | Sunday 8pm | All admins | Events, members, revenue |
| Monthly Report | 1st of month | Super admin | Full analytics, trends |
| Event Report | After each event | League admins | Results, attendance, feedback |
| Financial Report | Weekly | Treasurer | Revenue, expenses, treasury |

---

## 8. Backup & Recovery

### 8.1 Backup Schedule

| Component | Frequency | Retention | Storage |
|-----------|-----------|-----------|---------|
| PostgreSQL | Daily | 30 days | S3/Backblaze |
| Redis | Daily | 7 days | S3 |
| User uploads | Real-time | Indefinite | S3 |
| Blockchain state | N/A | On-chain | Ethereum |

### 8.2 Recovery Procedures

**Database Recovery:**
```bash
# List available backups
aws s3 ls s3://rgdgc-backups/postgres/

# Download specific backup
aws s3 cp s3://rgdgc-backups/postgres/backup_20260322.sql.gz .

# Restore
gunzip backup_20260322.sql.gz
psql $DATABASE_URL < backup_20260322.sql
```

**Rollback Deployment:**
```bash
# Railway
railway rollback

# Docker
docker-compose down
docker-compose up -d --build
```

---

## 9. Security Checklist

### 9.1 Regular Security Tasks

| Task | Frequency | Owner |
|------|-----------|-------|
| Rotate API keys | Quarterly | Super Admin |
| Review admin access | Monthly | Super Admin |
| Audit login attempts | Weekly | Auto + review |
| Update dependencies | Monthly | Tech Lead |
| Penetration testing | Annually | External |
| Review audit logs | Weekly | League Admin |

### 9.2 Incident Response

```
1. DETECT
   - Automated alerts trigger
   - User reports issue
   
2. ASSESS
   - Determine severity (1-4)
   - Identify affected systems
   
3. CONTAIN
   - Enable maintenance mode if needed
   - Revoke compromised credentials
   
4. REMEDIATE
   - Fix vulnerability
   - Restore from backup if needed
   
5. RECOVER
   - Verify fix
   - Disable maintenance mode
   - Monitor closely
   
6. REVIEW
   - Document incident
   - Update procedures
   - Notify affected users if required
```

---

## 10. Quick Reference

### 10.1 Important URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Admin Dashboard | app.rgdgc.com/admin | Main admin interface |
| API Docs | api.rgdgc.com/docs | Swagger documentation |
| Bot Admin | bot.rgdgc.com/admin | OpenClaw management |
| Monitoring | status.rgdgc.com | Uptime & health |
| Analytics | analytics.rgdgc.com | PostHog dashboard |

### 10.2 Emergency Contacts

| Role | Contact | When |
|------|---------|------|
| Tech Lead | [phone/signal] | System down, security incident |
| Club President | [phone] | Major decisions, PR issues |
| Treasurer | [phone] | Financial issues, treasury |

### 10.3 Common Commands

```bash
# Check system status
curl https://api.rgdgc.com/health

# View recent logs
railway logs --tail 100

# Clear cache
curl -X POST https://api.rgdgc.com/admin/cache/clear \
  -H "Authorization: Bearer $TOKEN"

# Enable maintenance
curl -X POST https://api.rgdgc.com/admin/maintenance \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"enabled": true}'
```

---

*Document Version: 1.0*
*Last Updated: March 2026*
*Owner: RGDGC Tech Team*

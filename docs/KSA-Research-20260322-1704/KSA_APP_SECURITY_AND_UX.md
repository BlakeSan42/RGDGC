# KSA Knowledge Base & Tow Alert — Security Model & UX Design

## Security: Three-Tier Access Control

```
┌─────────────────────────────────────────────────────────┐
│                    PUBLIC (No Login)                      │
│  Nothing. All KSA endpoints require authentication.      │
│  This prevents scraping and ensures player accountability │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    PLAYER (Logged In)                     │
│                                                          │
│  READ:                                                   │
│  ✓ Browse KSA knowledge base articles                   │
│  ✓ Search articles by category / keyword                │
│  ✓ View KSA timeline                                    │
│  ✓ View parking info & your rights                      │
│  ✓ View active tow alerts                               │
│  ✓ View tow incident stats (aggregate only)             │
│                                                          │
│  WRITE:                                                  │
│  ✓ Report tow truck sighting (creates alert)            │
│  ✓ Respond to tow alert (heading there, resolved)       │
│  ✓ Report towing incident (builds evidence)             │
│                                                          │
│  CANNOT:                                                 │
│  ✗ Create/edit/delete articles                          │
│  ✗ View unpublished drafts                              │
│  ✗ Manage parking knowledge entries                     │
│  ✗ See individual incident details (only aggregates)    │
│  ✗ Access admin analytics                               │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                 ADMIN (admin / super_admin)               │
│                                                          │
│  Everything a player can do, PLUS:                       │
│                                                          │
│  KNOWLEDGE BASE:                                         │
│  ✓ Create articles (with citations & key facts)         │
│  ✓ Edit / update articles                               │
│  ✓ Unpublish / pin articles                             │
│  ✓ View article read analytics                          │
│  ✓ Manage timeline entries                              │
│  ✓ Manage parking knowledge per park                    │
│                                                          │
│  TOW SYSTEM:                                             │
│  ✓ View all individual tow incidents (full detail)      │
│  ✓ Export tow data for legal use                        │
│  ✓ Override false tow alerts                            │
│  ✓ View tow analytics dashboard                        │
│                                                          │
│  SENSITIVE CONTENT:                                      │
│  ✓ Articles tagged "admin-only" are only visible here   │
│  ✓ Legal strategy docs (governance, fraud analysis)     │
│  ✓ Financial forensics (990 data, surplus calculations) │
│  ✓ RGPC proposal internal strategy                      │
└─────────────────────────────────────────────────────────┘
```

### How It Works in Code

| Endpoint | Auth Required | Guard | Who Can Access |
|----------|:----:|:-----:|:------:|
| `GET /ksa/articles` | Yes | `get_current_user` | Any player |
| `GET /ksa/articles/{slug}` | Yes | `get_current_user` | Any player |
| `GET /ksa/categories` | Yes | `get_current_user` | Any player |
| `GET /ksa/timeline` | Yes | `get_current_user` | Any player |
| `POST /ksa/articles` | Yes | **`get_admin_user`** | Admin only |
| `POST /tow-alerts` | Yes | `get_current_user` | Any player |
| `GET /tow-alerts` | Yes | `get_current_user` | Any player |
| `POST /tow-alerts/{id}/respond` | Yes | `get_current_user` | Any player |
| `POST /tow-incidents` | Yes | `get_current_user` | Any player |
| `GET /tow-incidents/stats` | Yes | `get_current_user` | Any player (aggregates only) |
| `GET /parking/{park_name}` | Yes | `get_current_user` | Any player |

### Sensitive Content Strategy

Articles about legal strategy, financial forensics, and RGPC internal planning use a dual-layer approach:

1. **Published articles** (visible to all players) contain:
   - KSA history facts (public record)
   - Parking rules and your rights (public knowledge)
   - How governance works (publicly available structure)
   - General information about the conservancy proposal

2. **Admin-only articles** (unpublished, `is_published=false`) contain:
   - Legal strategy details (attorney-client context)
   - Financial forensic analysis (990 deep dives)
   - Political playbook (coalition building tactics)
   - Settlement frameworks and leverage points

Admins see all articles. Players see only published ones. The query filter `KSAArticle.is_published == True` enforces this at the database level.

---

## UX Design: Player Journey

### First Time at River Grove

```
Player downloads RGDGC app → registers → sees "Know Your Park" section

  ┌─────────────────────────────────┐
  │  "Playing River Grove?"          │  ← Quick card on home screen
  │  K-sticker rules, where to      │
  │  park, tow fees, your rights    │
  └───────────────┬─────────────────┘
                  │ tap
  ┌───────────────▼─────────────────┐
  │  PARKING INFO SCREEN            │
  │                                  │
  │  ⚠️ K-STICKER REQUIRED          │
  │  Vehicles without sticker       │
  │  WILL be towed ($272)           │
  │                                  │
  │  🅿️ WHERE TO PARK               │
  │  ✓ WITH sticker: main lot       │
  │  ✓ WITHOUT: Woodland Hills Dr   │
  │    churches (map shows GPS pin)  │
  │                                  │
  │  📋 YOUR RIGHTS                  │
  │  • Drop fee max: $135           │
  │  • Not hooked? Must release FREE│
  │  • Contest: JP Court, 14 days   │
  │  • TDLR complaint: tdlr.texas.gov│
  │                                  │
  │  🚨 [REPORT TOW TRUCK] button   │
  └──────────────────────────────────┘
```

### Tow Truck Spotted (Emergency Flow)

```
Player on hole 7 sees tow truck enter parking lot

  ┌──────────────────────────────────┐
  │  Taps "Report Tow Truck" button  │
  │  (prominent red button in app)   │
  └───────────────┬──────────────────┘
                  │ 1 tap
  ┌───────────────▼──────────────────┐
  │  REPORT TOW SCREEN               │
  │                                   │
  │  📍 Location captured (GPS)       │
  │                                   │
  │  What did you see?                │
  │  ┌─────────────────────────┐     │
  │  │ 🔍 Tow Truck Spotted    │ ← tap│
  │  └─────────────────────────┘     │
  │  ┌─────────────────────────┐     │
  │  │ 🚨 Car Being Towed!     │     │
  │  └─────────────────────────┘     │
  │  ┌─────────────────────────┐     │
  │  │ 👀 Enforcement Patrol   │     │
  │  └─────────────────────────┘     │
  │                                   │
  │  Optional: "near boat ramp"       │
  │                                   │
  │  [🔴 ALERT ALL PLAYERS]          │
  └───────────────┬──────────────────┘
                  │ 2nd tap (confirm)
  ┌───────────────▼──────────────────┐
  │  Backend: push notification sent  │
  │  to ALL players with the app      │
  └───────────────┬──────────────────┘
                  │
  ┌───────────────▼──────────────────┐
  │  EVERY player's phone buzzes:    │
  │                                   │
  │  ⚠️ TOW TRUCK SPOTTED!           │
  │  River Grove Park —               │
  │  near boat ramp                   │
  │  Check your car NOW               │
  └──────────────────────────────────┘
```

**Two taps. That's it.** GPS auto-captured. Push sent to everyone.

### Receiving a Tow Alert

```
Player on hole 14 gets push notification

  ┌──────────────────────────────────┐
  │  ⚠️ TOW TRUCK SPOTTED!           │
  │  River Grove Park — near boat    │
  │  ramp. Check your car NOW.       │
  │  ───────────────────────         │
  │  [View Details]                   │
  └───────────────┬──────────────────┘
                  │ tap notification
  ┌───────────────▼──────────────────┐
  │  TOW ALERT DETAIL                 │
  │                                   │
  │  🔴 ACTIVE — Tow Truck Spotted   │
  │  River Grove Park                 │
  │  Reported 3 min ago               │
  │  Near boat ramp parking lot       │
  │                                   │
  │  📍 MAP showing alert location    │
  │                                   │
  │  💬 RESPONSES (2)                 │
  │  "I'm heading there now" — Jake   │
  │  "False alarm, they left" — Mike  │
  │                                   │
  │  [I'm heading there]              │
  │  [Mark as resolved]               │
  │  [False alarm]                    │
  │                                   │
  │  ──── KNOW YOUR RIGHTS ────       │
  │  Not hooked up? → FREE release   │
  │  Hooked but on lot? → $135 max   │
  │  Already towed? → Call EMC:      │
  │  (281) 399-5100                   │
  └──────────────────────────────────┘
```

### Learning Journey (Knowledge Base)

```
Player curious about "who runs this park?"

  ┌──────────────────────────────────┐
  │  KNOW YOUR PARK (main screen)    │
  │                                   │
  │  🔍 Search articles...           │
  │                                   │
  │  Categories:                      │
  │  [Parking] [Rights] [Finances]   │
  │  [Governance] [History] [Legal]  │
  │  [RGPC Proposal] [Parks]         │
  │                                   │
  │  📌 PINNED                        │
  │  ┌─────────────────────────┐     │
  │  │ How KSA Actually Works   │     │
  │  │ The governance structure │     │
  │  │ you need to understand   │     │
  │  │ 📖 245 reads             │     │
  │  └─────────────────────────┘     │
  │                                   │
  │  RECENT                           │
  │  ┌─────────────────────────┐     │
  │  │ The 2024 Expense Spike   │     │
  │  │ 55% increase — what we   │     │
  │  │ know and don't know      │     │
  │  │ 💰 Finances • 89 reads   │     │
  │  └─────────────────────────┘     │
  └──────────────────────────────────┘
```

### Admin Experience

```
Admin (Blake or designated admins) sees additional features:

  ┌──────────────────────────────────┐
  │  ADMIN: KSA Knowledge Base       │
  │                                   │
  │  📊 DASHBOARD                     │
  │  Articles: 24 published, 8 drafts│
  │  Total reads: 1,847               │
  │  Top article: "Parking Rules"     │
  │                                   │
  │  🚨 TOW STATS                     │
  │  Total incidents: 14              │
  │  Disc golfers towed: 9 (64%)     │
  │  Contested: 5 (36%)              │
  │  Hearings won: 3 (60%)           │
  │  Avg tow fee: $268               │
  │  TDLR exceeded: 2 cases          │
  │                                   │
  │  📝 MANAGE ARTICLES               │
  │  [+ New Article]                  │
  │  [📋 Edit Parking Info]          │
  │  [📅 Edit Timeline]              │
  │                                   │
  │  🔒 ADMIN-ONLY ARTICLES           │
  │  • Legal Strategy (draft)         │
  │  • Financial Forensics (draft)    │
  │  • Coalition Contacts (draft)     │
  └──────────────────────────────────┘
```

---

## Data Flow: What Gets Stored, Who Sees It

```
┌─────────────────────────────────────────────────────────┐
│  PLAYER ACTIONS → DATABASE → WHO SEES WHAT               │
├──────────────────┬──────────────────┬───────────────────┤
│  Player reads    │ ksa_articles     │ Player sees body  │
│  an article      │ read_count++     │ Admin sees stats  │
├──────────────────┼──────────────────┼───────────────────┤
│  Player reports  │ tow_alerts       │ ALL players get   │
│  tow truck       │ (GPS, type, desc)│ push notification │
│                  │                  │ Admin sees full DB│
├──────────────────┼──────────────────┼───────────────────┤
│  Player responds │ tow_alert_       │ Reporter notified │
│  to alert        │ responses        │ All can see count │
├──────────────────┼──────────────────┼───────────────────┤
│  Player reports  │ tow_incidents    │ Player sees own   │
│  past towing     │ (fee, outcome,   │ Admin sees all +  │
│                  │  sticker status) │ aggregate stats   │
│                  │                  │ Players see stats │
├──────────────────┼──────────────────┼───────────────────┤
│  Admin creates   │ ksa_articles     │ Published → all   │
│  article         │ (published or    │ Unpublished →     │
│                  │  draft)          │ admin only        │
├──────────────────┼──────────────────┼───────────────────┤
│  Admin updates   │ parking_         │ All players see   │
│  parking info    │ knowledge        │ updated rules     │
└──────────────────┴──────────────────┴───────────────────┘
```

---

## Mobile Navigation: Where It Lives

```
Tab Bar (5 tabs):
  Play │ Stats │ League │ Chat │ Profile
                                    │
                              More menu or
                              dedicated section
                                    │
                         ┌──────────▼──────────┐
                         │  Know Your Park      │  ← New section
                         │  (ksa/index.tsx)     │     accessible from
                         │                      │     Profile tab or
                         │  • Category browser  │     dedicated nav
                         │  • Article list      │
                         │  • Search            │
                         │  • Tow alert banner  │
                         │  • Quick parking card│
                         └──────────┬───────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
    ┌─────────▼────────┐ ┌─────────▼────────┐ ┌──────────▼─────────┐
    │ ksa/article/     │ │ ksa/report-tow   │ │ ksa/parking-info   │
    │ [slug].tsx       │ │ .tsx             │ │ .tsx               │
    │                  │ │                  │ │                    │
    │ Full article     │ │ 2-tap emergency  │ │ K-sticker rules    │
    │ reader with      │ │ tow alert with   │ │ Alt parking GPS    │
    │ markdown,        │ │ GPS auto-capture │ │ Your rights        │
    │ citations,       │ │ + push to all    │ │ TDLR limits        │
    │ key facts        │ │ players          │ │ Tow company info   │
    └──────────────────┘ └──────────────────┘ └────────────────────┘
              │
    ┌─────────▼──────────┐
    │ ksa/admin.tsx       │  ← Admin only (role check in UI)
    │                     │
    │ • Article CRUD      │
    │ • Tow stats dashboard│
    │ • Parking info editor│
    │ • Unpublished drafts │
    └─────────────────────┘
```

---

## Anti-Abuse Measures

| Risk | Mitigation |
|------|-----------|
| **False tow alerts** | Alerts tied to authenticated user. Repeated false reports → admin review → account warning. Alert history is auditable. |
| **Alert spam** | Rate limit: max 3 alerts per user per hour (enforced server-side via slowapi). |
| **Sensitive article leaks** | Admin-only content stored as `is_published=false`. Query filter enforces at DB level, not just UI. |
| **Tow incident fabrication** | Incidents are evidence, not enforcement. False reports don't trigger any action — they just add to a dataset that admins review. |
| **Scraping/bulk access** | All endpoints require JWT auth. No public API. Rate limited. |
| **GPS spoofing on alerts** | Cross-reference with user's recent round/check-in data. Flag alerts from users not near the park. |

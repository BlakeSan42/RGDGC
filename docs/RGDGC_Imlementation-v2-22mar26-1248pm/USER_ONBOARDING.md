# RGDGC User Onboarding & First-Time Experience

## Overview

This document details how new users discover, understand, and start using the RGDGC app within their first few minutes. The goal is zero confusion — users should be scoring rounds within 3 minutes of opening the app.

---

## 1. Onboarding Philosophy

### 1.1 Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Progressive Disclosure** | Show only what's needed now, reveal features as relevant |
| **Learn by Doing** | Interactive tutorials, not walls of text |
| **Escape Hatches** | Skip buttons on everything, never trap users |
| **Contextual Help** | Help appears where needed, not in a manual |
| **Quick Wins** | Users accomplish something meaningful in first session |

### 1.2 Time Targets

| Milestone | Target Time |
|-----------|-------------|
| App open → first screen understood | 5 seconds |
| Create account or skip | 30 seconds |
| Understand core value proposition | 1 minute |
| Complete first meaningful action | 3 minutes |
| Feel competent with basics | 5 minutes |

---

## 2. App Store Presence

### 2.1 App Store Listing

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [RGDGC Logo - disc golf basket with chain splash]          │
│                                                             │
│  RGDGC - Disc Golf Tracker                                  │
│  River Grove Disc Golf Club                                 │
│  ★★★★★ (4.8) · Sports · Free                               │
│                                                             │
│  [GET]                                                      │
│                                                             │
│  Screenshots:                                               │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                   │
│  │Score│ │Lead-│ │Put- │ │Event│ │AR   │                   │
│  │Card │ │board│ │ting │ │Check│ │Dist │                   │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                   │
│                                                             │
│  Track your disc golf rounds, compete in leagues,          │
│  and improve your game with River Grove Disc Golf Club.    │
│                                                             │
│  ✓ Score rounds at any course                              │
│  ✓ Track putting stats & strokes gained                    │
│  ✓ Join RGDGC league events                                │
│  ✓ AR distance measurement                                 │
│  ✓ Compete on leaderboards                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 First Launch (Before Account)

**The "Zero State" Problem:** App is empty on first launch. Solution: Immediate value.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                     🥏                                      │
│              Welcome to RGDGC                               │
│                                                             │
│      Track rounds • Compete in leagues • Get better        │
│                                                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │        [  Start Scoring a Round  ]                  │   │
│  │               (no account needed)                   │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │        [  Create Account  ]                         │   │
│  │          Save rounds & join leagues                 │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                                             │
│              [ Already have an account? Log in ]            │
│                                                             │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key insight:** Let users score a round WITHOUT an account. Prompt to save at the end.

---

## 3. Account Creation Flow

### 3.1 Streamlined Signup (30 seconds)

```
Screen 1: Choose Method
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    Create Account                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🍎  Continue with Apple                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  G   Continue with Google                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✉️   Continue with Email                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                                             │
│           [ Skip for now - I'll create one later ]          │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Screen 2: Quick Profile (only if email signup)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    Almost there!                            │
│                                                             │
│  What should we call you?                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Blake                                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Pick a username                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  @discgolfer_blake                        ✓ Available│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           [  Let's Go!  ]                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  PDGA number? Add later in settings                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**What we DON'T ask during signup:**
- Phone number
- Address
- PDGA number (optional, add later)
- Profile photo (prompted later)
- Payment info (only when needed)

---

## 4. First-Time Tutorial

### 4.1 Interactive Walkthrough

After account creation, a 4-screen interactive tutorial:

```
Tutorial Screen 1/4: Score a Round
┌─────────────────────────────────────────────────────────────┐
│                                                      [Skip] │
│                                                             │
│               ┌─────────────────────────┐                   │
│               │    📍 Score Round       │                   │
│               │  ─────────────────────  │                   │
│               │  River Grove Park       │                   │
│               │  Hole 1 - Par 3         │                   │
│               │                         │                   │
│               │   [3] [4] [5] [6]       │                   │
│               │                         │                   │
│               └─────────────────────────┘                   │
│                          │                                  │
│                          │                                  │
│               ┌──────────▼──────────┐                       │
│               │                     │                       │
│               │  Tap your score     │                       │
│               │  for each hole      │                       │
│               │                     │                       │
│               └─────────────────────┘                       │
│                                                             │
│  ○ ○ ○ ○                                           [Next →] │
└─────────────────────────────────────────────────────────────┘

Tutorial Screen 2/4: Track Your Progress
┌─────────────────────────────────────────────────────────────┐
│                                                      [Skip] │
│                                                             │
│               ┌─────────────────────────┐                   │
│               │    📊 Your Stats        │                   │
│               │  ─────────────────────  │                   │
│               │                         │                   │
│               │  Rounds: 0              │                   │
│               │  Best: --               │                   │
│               │  Avg: --                │                   │
│               │  Putting: --%           │                   │
│               └─────────────────────────┘                   │
│                          │                                  │
│               ┌──────────▼──────────┐                       │
│               │                     │                       │
│               │  Watch your stats   │                       │
│               │  improve over time  │                       │
│               │                     │                       │
│               └─────────────────────┘                       │
│                                                             │
│  ● ○ ○ ○                                           [Next →] │
└─────────────────────────────────────────────────────────────┘

Tutorial Screen 3/4: Join Events
┌─────────────────────────────────────────────────────────────┐
│                                                      [Skip] │
│                                                             │
│               ┌─────────────────────────┐                   │
│               │    🏆 League Events     │                   │
│               │  ─────────────────────  │                   │
│               │                         │                   │
│               │  Sunday Singles         │                   │
│               │  Mar 24 @ 2pm           │                   │
│               │  18 players signed up   │                   │
│               │                         │                   │
│               │  [ Check In ]           │                   │
│               └─────────────────────────┘                   │
│                          │                                  │
│               ┌──────────▼──────────┐                       │
│               │                     │                       │
│               │  Join weekly events │                       │
│               │  and compete for    │                       │
│               │  prizes & points    │                       │
│               │                     │                       │
│               └─────────────────────┘                       │
│                                                             │
│  ● ● ○ ○                                           [Next →] │
└─────────────────────────────────────────────────────────────┘

Tutorial Screen 4/4: Ready to Play!
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                          🥏                                 │
│                                                             │
│                    You're all set!                          │
│                                                             │
│                                                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           [  Start My First Round  ]                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           [  Explore the App  ]                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                                             │
│  ● ● ● ●                                                    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Contextual Tooltips

Instead of front-loading information, show tooltips when users encounter features:

```typescript
const CONTEXTUAL_TIPS = {
  // First time user taps on Stats
  'first_stats_view': {
    title: "Your Stats Dashboard",
    message: "Track your progress here. More data appears as you play more rounds!",
    showOnce: true,
    position: 'bottom'
  },
  
  // First time user sees leaderboard
  'first_leaderboard': {
    title: "League Standings",
    message: "Play in Sunday Singles or Dubs events to earn points and climb the leaderboard.",
    showOnce: true,
    position: 'top'
  },
  
  // First time user sees putting zone
  'first_putting_entry': {
    title: "Putting Stats",
    message: "Tap the zone where your putt landed to track C1/C2 percentages.",
    showOnce: true,
    position: 'center'
  },
  
  // First time entering score
  'first_score_entry': {
    title: "Quick Tip",
    message: "Swipe left/right on holes to navigate. Tap the score to change it.",
    showOnce: true,
    position: 'bottom'
  }
};
```

---

## 5. Main App Navigation

### 5.1 Tab Bar (Always Visible)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                        [Main Content]                       │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   🥏          📊          🏆          💬          👤        │
│  Play       Stats      League       Chat      Profile      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Tab 1: Play (Home)
├─ Start New Round
├─ Continue Round (if in progress)
├─ Recent Rounds
└─ Quick Actions (AR Measure, Practice Putting)

Tab 2: Stats  
├─ Overview Dashboard
├─ Round History
├─ Putting Analysis
└─ Trends & Progress

Tab 3: League
├─ Current Standings
├─ Upcoming Events
├─ Event Results
└─ My Points & Prizes

Tab 4: Chat
├─ General Chat
├─ Event Discussions
└─ AI Bot (@clawd)

Tab 5: Profile
├─ My Profile
├─ Settings
├─ Notifications
└─ Help & Support
```

### 5.2 First-Time Empty States

Every screen has a helpful empty state:

```
Stats Tab (No Rounds Yet)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         📊                                  │
│                                                             │
│                  No stats yet!                              │
│                                                             │
│         Play your first round to start                      │
│         tracking your progress.                             │
│                                                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           [  Play a Round  ]                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                                             │
│  What you'll see here:                                      │
│  • Scoring averages by course                               │
│  • Putting percentages (C1, C2)                             │
│  • Personal bests and trends                                │
│  • Strokes gained analysis                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

League Tab (Not Joined Yet)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         🏆                                  │
│                                                             │
│              Join the RGDGC League!                         │
│                                                             │
│       Play in weekly events, earn points,                   │
│       and compete for cash prizes.                          │
│                                                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           [  View This Week's Event  ]              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                                             │
│  UPCOMING                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Sunday Singles                                     │   │
│  │  Mar 24 @ 2pm • River Grove Longs                   │   │
│  │  Entry: $10 • 15 players registered                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Scoring a Round (Core Flow)

### 6.1 Course Selection

```
Screen: Start Round
┌─────────────────────────────────────────────────────────────┐
│  ←  Start Round                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📍 Nearby Courses                                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🏆 River Grove Park                    0.3 mi      │   │
│  │  Kingwood, TX • 21 holes • ★★★★☆                    │   │
│  │  [Shorts] [Longs] [Championship]                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Bear Creek Park                        4.2 mi      │   │
│  │  Houston, TX • 18 holes • ★★★★☆                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  TC Jester Park                         8.1 mi      │   │
│  │  Houston, TX • 18 holes • ★★★☆☆                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                                             │
│  🔍 Search all courses...                                   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Don't see your course?                                     │
│  [ Add a Custom Course ]                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Scorecard Interface

```
Screen: Scoring (Hole by Hole)
┌─────────────────────────────────────────────────────────────┐
│  ←  River Grove - Longs                            ⋯       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │            Hole 7                                   │   │
│  │            Par 3 • 285 ft                           │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │    [2]      [3]      [4]      [5]      [6]         │   │
│  │   Eagle    Birdie    Par    Bogey   Double         │   │
│  │                  ✓                                  │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Putt from:  ○ C1 (< 33ft)   ○ C2 (33-66ft)        │   │
│  │              ○ Made it   ○ Missed                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                                             │
│  ◀ Hole 6          ○ ○ ○ ○ ○ ● ○ ...        Hole 8 ▶       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Through 7:  +2  (23 total)                                │
│                              [View Full Scorecard]          │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Round Complete

```
Screen: Round Complete
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         🎉                                  │
│                                                             │
│                   Round Complete!                           │
│                                                             │
│              River Grove Park - Longs                       │
│                    March 22, 2026                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │              SCORE: 57 (+4)                         │   │
│  │                                                     │   │
│  │  🐦 Birdies: 3    ⚪ Pars: 8    🟡 Bogeys: 4        │   │
│  │                                                     │   │
│  │  Putting: C1 85% (6/7) • C2 33% (1/3)              │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Personal Best at River Grove Longs: 54 (+1)               │
│                                                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           [  Save Round  ]                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [ Share ]     [ Add Notes ]     [ Discard ]               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Help System

### 7.1 Help Access Points

```typescript
const HELP_TOUCHPOINTS = [
  // Always accessible
  { location: 'Profile Tab → Help & Support', type: 'full_help_center' },
  
  // Contextual
  { location: 'Any screen → ⓘ icon', type: 'screen_specific_help' },
  { location: 'Shake device', type: 'quick_feedback_form' },
  
  // AI-powered
  { location: 'Chat Tab → @clawd', type: 'ask_bot' },
  
  // In-app
  { location: 'Settings → Tutorial', type: 'replay_onboarding' },
];
```

### 7.2 Help Center Structure

```
Help & Support
├─ Getting Started
│   ├─ Creating your account
│   ├─ Scoring your first round
│   ├─ Understanding your stats
│   └─ Joining league events
│
├─ Features
│   ├─ Scoring rounds
│   ├─ Putting analysis
│   ├─ AR distance measurement
│   ├─ League competitions
│   └─ Chat & community
│
├─ Account
│   ├─ Managing your profile
│   ├─ Notification settings
│   ├─ Privacy settings
│   └─ Deleting your account
│
├─ Troubleshooting
│   ├─ App not loading
│   ├─ Lost round data
│   ├─ Login issues
│   └─ Report a bug
│
├─ FAQ
│   ├─ How are league points calculated?
│   ├─ What is C1/C2 putting?
│   ├─ How do I earn $RGDG tokens?
│   └─ Can I import from UDisc?
│
└─ Contact Us
    ├─ Email support
    ├─ Discord community
    └─ Report an issue
```

### 7.3 AI Help (Clawd Bot)

```
Chat → Ask Clawd

┌─────────────────────────────────────────────────────────────┐
│  Ask Clawd                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🤖 Hey! I'm Clawd, your disc golf assistant.              │
│     Ask me anything about the app or disc golf!            │
│                                                             │
│  Quick questions:                                           │
│  • How do I score a round?                                  │
│  • When is the next event?                                  │
│  • What are my putting stats?                               │
│  • How do league points work?                               │
│                                                             │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  [User]: How do I check in to Sunday Singles?              │
│                                                             │
│  [Clawd]: To check in to Sunday Singles:                   │
│                                                             │
│  1. Go to the League tab                                    │
│  2. Find "Sunday Singles - Mar 24"                         │
│  3. Tap "Check In"                                         │
│  4. Pay the $10 entry fee                                  │
│                                                             │
│  Check-in opens Saturday at noon and closes                │
│  30 minutes before the event.                              │
│                                                             │
│  Want me to take you there? [Go to League →]               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Type a message...                              [Send]      │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Notification Strategy

### 8.1 Permission Request (Delayed)

Don't ask for notifications immediately. Wait until there's a reason:

```
Trigger: User checks into their first event

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         🔔                                  │
│                                                             │
│              Stay in the loop!                              │
│                                                             │
│     Get notified about event updates, results,              │
│     and when it's your turn to tee off.                     │
│                                                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           [  Enable Notifications  ]                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│              [ Maybe Later ]                                │
│                                                             │
│  You can always change this in Settings.                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Notification Types

| Type | When | Default |
|------|------|---------|
| Event reminders | 24h and 2h before events | On |
| Results posted | When event results are published | On |
| Leaderboard updates | Weekly standings change | Off |
| New achievements | When you earn a badge | On |
| Friend activity | When friends complete rounds | Off |
| Chat mentions | When someone @mentions you | On |

---

## 9. Gamification & Engagement

### 9.1 Achievement System

```
First Session Achievements (Easy Wins)

🏅 "First Steps"
   - Create an account ✓

🏅 "On the Tee"  
   - Start your first round ✓

🏅 "Putt for Dough"
   - Record a made putt ✓

🏅 "Card Complete"
   - Finish a full round ✓

🏅 "Social Butterfly"
   - Send a message in chat

🏅 "Event Ready"
   - Check in to your first event
```

### 9.2 Progress Indicators

```
Profile → Progress

┌─────────────────────────────────────────────────────────────┐
│  YOUR JOURNEY                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Rounds Played                                              │
│  ▓▓▓▓▓▓▓▓░░░░░░░░░░░░ 8/20                                 │
│  Next milestone: "Regular" badge at 20 rounds              │
│                                                             │
│  Events Participated                                        │
│  ▓▓░░░░░░░░░░░░░░░░░░ 2/10                                 │
│  Next milestone: "Competitor" badge at 10 events           │
│                                                             │
│  Putting Accuracy (C1)                                      │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░ 72%                                  │
│  Next milestone: "Putt Machine" at 80%                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Recovery & Error Handling

### 10.1 Graceful Errors

```
When something goes wrong:

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         😕                                  │
│                                                             │
│              Oops, something went wrong                     │
│                                                             │
│     Don't worry - your round is saved locally.              │
│     We'll sync it when you're back online.                  │
│                                                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           [  Try Again  ]                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [ Contact Support ]    [ Go Home ]                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Offline Mode

```
When offline:

┌─────────────────────────────────────────────────────────────┐
│  📡 You're offline                               [Dismiss]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  You can still:                                             │
│  ✓ Score rounds (syncs when online)                        │
│  ✓ View cached stats                                       │
│  ✓ Practice putting drills                                 │
│                                                             │
│  Waiting for connection:                                    │
│  • Send chat messages (3 pending)                          │
│  • View live leaderboard                                   │
│  • Check in to events                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Implementation Checklist

### 11.1 Onboarding Screens

- [ ] Welcome screen with immediate value proposition
- [ ] Social/email signup options
- [ ] 4-screen interactive tutorial
- [ ] Skip buttons on all tutorial screens
- [ ] Empty states for all major sections
- [ ] First achievement unlocks

### 11.2 Contextual Help

- [ ] Tooltip system for first-time feature use
- [ ] ⓘ icons with tap-to-learn
- [ ] Error messages with recovery actions
- [ ] Offline mode indicators and guidance

### 11.3 Navigation

- [ ] 5-tab bottom navigation
- [ ] Consistent back buttons
- [ ] Pull-to-refresh on all lists
- [ ] Swipe navigation in scorecard

### 11.4 Help System

- [ ] Searchable help center
- [ ] AI bot integration
- [ ] Replay tutorial option
- [ ] Bug report form

---

*Document Version: 1.0*
*Last Updated: March 2026*
*Owner: RGDGC Product Team*

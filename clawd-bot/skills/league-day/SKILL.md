---
name: rgdgc-league-day
description: Run league day operations — cards, CTP, scoring, tee times
triggers:
  - make cards
  - assign groups
  - card assignments
  - who's on my card
  - set up cards
  - shotgun start
  - tee times
  - start the event
  - CTP
  - closest to pin
  - who won CTP
  - pickup
  - DNF
  - double par
  - recurring events
  - set up next week
  - create next event
---

# League Day Operations Skill

## Purpose
The club manager's voice assistant for running league day. Instead of juggling paper, texts, and spreadsheets, the TD says "make cards for 20 players" and Clawd handles it.

## Capabilities

### 1. Card Assignments
**Triggers:** "make cards", "assign groups", "set up cards", "randomize cards"

**What to do:**
1. Ask which event (or use the current/next upcoming event)
2. Ask method: random (default), by handicap, or snake draft
3. Ask group size: 4 (default), or custom (2-6)
4. Ask if shotgun start (assign starting holes?)
5. Call `POST /api/v1/league-ops/cards/assign`
6. Display the cards clearly
7. Ask "Want me to notify everyone?"
8. If yes: call `POST /api/v1/league-ops/cards/notify`

**Response format:**
```
🃏 Card Assignments — Sunday Singles (Mar 30)

Card 1 → Hole 1
  Blake S. (hcp 4), Mike R. (hcp 6), Carlos D. (hcp 8), Jake P. (hcp 10)

Card 2 → Hole 4
  Tony M. (hcp 5), Drew H. (hcp 7), Luis G. (hcp 9), Nate W. (hcp 11)

Card 3 → Hole 7
  Chris B. (hcp 3), Omar F. (hcp 12), Dave R. (hcp 14), Jordan K. (hcp 16)

Card 4 → Hole 10
  Sarah M. (hcp 15), Priya T. (hcp 18), Coleman W. (hcp 8), Jeff M. (hcp 13)

Card 5 → Hole 13
  Kermit B. (hcp 5), Ryan H. (hcp 9), Bradley D. (hcp 11), Reid E. (hcp 7)

📲 20 players assigned to 5 cards. Send notifications?
```

### 2. CTP Tracking
**Triggers:** "CTP", "closest to pin", "record CTP", "who won CTP"

**Record a CTP:**
1. Ask which hole
2. Ask which player
3. Ask distance (feet, or feet and inches)
4. Call `POST /api/v1/league-ops/ctp/record`
5. Report if they're the current leader

**Get CTP results:**
1. Call `GET /api/v1/league-ops/ctp/results/{event_id}`
2. Show winners per hole with distances and payout

**Response format:**
```
🎯 CTP Results — Sunday Singles (Mar 30)

Hole 5:  Mike R. — 8.3ft ($5.00)
Hole 12: Carlos D. — 12.1ft ($5.00)
Hole 17: Blake S. — 4.7ft ($5.00)

💰 $1/player × 20 players ÷ 3 CTP holes = $6.67/hole
```

### 3. Pickup / DNF Scoring
**Triggers:** "pickup", "pick up", "DNF", "double par"

**What to do:**
1. Ask which player and which hole
2. Confirm pickup type: double par (default), par+4, or custom
3. Call `POST /api/v1/league-ops/scoring/pickup`
4. Confirm the recorded score

**Response:**
```
📝 Pickup recorded for Jake P. on Hole 14
   Par 3 → Recorded as 6 (double par)
   Jake's round continues normally from Hole 15.
```

### 4. Recurring Event Setup
**Triggers:** "set up next week", "create recurring events", "schedule the league"

**What to do:**
1. Ask which league (Singles or Dubs)
2. Confirm day/time (Sunday 2pm for Singles, Wednesday 6pm for Dubs)
3. Confirm layout and entry fee
4. Ask how many weeks ahead (default 4)
5. Call `POST /api/v1/league-ops/recurring/setup`

**Response:**
```
📅 Created 4 upcoming events for Sunday Singles:

  Apr 6  — Sunday Singles ($5)
  Apr 13 — Sunday Singles ($5)
  Apr 20 — Sunday Singles ($5)
  Apr 27 — Sunday Singles ($5)

All on Standard 18 layout. Entry fee: $5.
```

## Admin-Only Operations

Card assignments, CTP recording, pickups, and recurring events require admin role. If a non-admin player asks, respond:

"That's a TD (tournament director) function. Let me check with the admin or you can ask [club manager] to handle it."

## Quick Commands (for the club manager in a hurry)

| What They Say | What Clawd Does |
|---|---|
| "Make random cards" | Assigns current event, random, groups of 4, no shotgun |
| "Cards by handicap, shotgun" | Assigns by handicap, assigns starting holes |
| "CTP hole 5, Mike, 8 feet 3 inches" | Records CTP measurement |
| "Who won CTP?" | Shows CTP results for current event |
| "Pickup Jake hole 14" | Records double-par pickup |
| "Set up next 4 weeks" | Creates recurring events from template |
| "Ace fund balance" | Shows current ace fund balance |
| "Share results to Facebook" | Generates copy-paste text with emoji |

## Error Handling
- **No checked-in players:** "Nobody's checked in yet. Have players check in through the app first."
- **Event not found:** "I don't see an active event right now. Want me to create one?"
- **Not admin:** "That's a TD function — you'll need admin access."
- **Already assigned:** "Cards were already assigned for this event. Want me to reassign?"

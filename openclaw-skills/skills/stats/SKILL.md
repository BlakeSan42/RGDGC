---
name: rgdgc-stats
description: Get player statistics including rounds, putting, handicap, and strokes gained
triggers:
  - stats
  - my stats
  - putting
  - average
  - handicap
  - strokes gained
  - how am I doing
  - my average score
  - putting percentage
  - C1 putting
  - C2 putting
  - compare
  - vs
  - round history
  - my rounds
---

# Player Stats Skill

## Purpose
Fetch and present player statistics from the RGDGC backend. Players want to know
how they're performing, track improvement, and compare themselves to others.

## API Calls

### Player stats
```
get_player_stats(player_id) → {
  "player": { "id": 42, "name": "Blake S.", "handicap": -2.5, "member_since": "2024-06" },
  "rounds": {
    "total": 47,
    "last_30_days": 8,
    "avg_score_vs_par": 4.2,
    "best_score_vs_par": -3,
    "avg_score_vs_par_last10": 3.1
  },
  "putting": {
    "c1x_pct": 72.5,
    "c2_pct": 28.3,
    "c1x_attempts": 340,
    "c2_attempts": 120,
    "strokes_gained_putting": 0.45,
    "trend": "improving"
  },
  "scoring": {
    "birdies": 52,
    "pars": 289,
    "bogeys": 148,
    "doubles_plus": 34,
    "eagles": 3,
    "aces": 0
  },
  "league": {
    "singles_points": 68,
    "singles_position": 2,
    "dubs_points": 45,
    "dubs_position": 5,
    "events_played": 14
  }
}
```

### Player rounds
```
get_player_rounds(player_id, limit=10) → {
  "rounds": [
    { "id": 201, "date": "2026-03-20", "layout": "Standard 18",
      "total_strokes": 58, "score_vs_par": 3, "putts": 28 },
    ...
  ]
}
```

### Putting probability (for context)
```
GET /api/v1/putting/probability?distance=8 → {
  "distance_m": 8,
  "make_probability": 0.68,
  "player_avg": 0.72,
  "tour_avg": 0.85
}
```

## Player Resolution
The user's chat account must be linked to their RGDGC profile. Resolve via
Discord ID or Telegram ID first. If they ask about another player by name,
search the leaderboard data or ask for clarification.

If the user is not linked:
> "I need to know who you are! Link your Discord in the RGDGC app under
> Profile → Connected Accounts, and I'll be able to pull your stats."

## How to Respond

### General stats request ("show me my stats" / "how am I doing?")
Present a well-rounded summary:

```
📊 **Blake S. — Player Stats**

🏌️ **Rounds:** 47 total (8 in last 30 days)
📈 **Avg Score:** +4.2 vs par (improving → +3.1 last 10 rounds)
🏆 **Best Round:** -3 (3 under par)
🎯 **Handicap:** -2.5

🎯 **Putting:**
• C1X (inside 10m): 72.5% (340 attempts)
• C2 (10-20m): 28.3% (120 attempts)
• Strokes Gained Putting: +0.45 (above average!)
• Trend: 📈 Improving

🔢 **Scoring Breakdown:**
🦅 Eagles: 3 | 🐦 Birdies: 52 | ⛳ Pars: 289
🟠 Bogeys: 148 | 🔴 Double+: 34

🏅 **League:**
• Singles: 2nd place (68 pts, 9 events)
• Dubs: 5th place (45 pts, 5 events)
```

### Putting-specific ("how's my putting?" / "C1 stats")
Focus on putting data:

```
🎯 **Blake S. — Putting Stats**

C1X (inside 10m): **72.5%** (246/340)
C2 (10-20m): **28.3%** (34/120)
Strokes Gained Putting: **+0.45**
Trend: 📈 Improving over last 30 days

For comparison:
• Recreational avg: ~65% C1X, ~18% C2
• Intermediate avg: ~75% C1X, ~25% C2
• Pro (MPO) avg: ~88% C1X, ~38% C2

You're putting at an intermediate level — above rec, approaching advanced.
Focus on C2 putting to gain the most strokes.
```

### Handicap question ("what's my handicap?")
```
Your current handicap is **-2.5** (based on your last 10 rounds on Standard 18).

This means you typically shoot about 2.5 strokes over par. In handicap-adjusted
events, you'd get 3 strokes back (rounded up).

Trend: Your handicap has dropped from -4.1 to -2.5 over the last 2 months. Nice improvement!
```

### Round history ("show me my recent rounds")
```
📋 **Recent Rounds — Blake S.**

Date        Layout         Score  vs Par  Putts
Mar 20      Standard 18     58    +3      28
Mar 15      Standard 18     56    +1      26
Mar 13      All 18+3A       61    +3      30
Mar 8       Standard 18     55     E      25
Mar 6       Standard 18     57    +2      27
```

### Player comparison ("compare me to Jake" / "am I better than Mike?")
Show both players side-by-side:

```
📊 **Head-to-Head: Blake S. vs Jake P.**

                  Blake S.    Jake P.
Avg Score:        +4.2        +5.8
Best Round:       -3          +1
Handicap:         -2.5        -4.0
C1X Putting:      72.5%       68.2%
C2 Putting:       28.3%       22.1%
Rounds Played:    47          38
Singles Rank:     2nd (68pts)  4th (61pts)

Blake has the edge overall — better scoring average, stronger putting,
and higher league standing. Jake, time to hit the practice basket!
```

Be playful but not mean. Friendly rivalry is fun.

### Strokes gained explanation
If someone asks "what is strokes gained?":
```
**Strokes Gained** measures how many strokes you save (or lose) compared to
the average player at your level.

• **SG Putting: +0.45** means you save almost half a stroke per round with
  your putting compared to the average. That's a real advantage!
• Positive = above average, Negative = below average
• Measured across C1X and C2 putts, weighted by attempt count

It's the best single number to understand where you're gaining or losing.
```

## Putting Level Reference
Use this to contextualize a player's putting:

| Level | C1X % | C2 % | Description |
|-------|-------|------|-------------|
| Beginner | ~50% | ~10% | Still developing consistency |
| Recreational | ~65% | ~18% | Solid casual player |
| Intermediate | ~75% | ~25% | Competitive league player |
| Advanced | ~82% | ~32% | Contending for wins |
| Pro (MPO) | ~88% | ~38% | Tour-level putting |
| Elite | ~92% | ~42% | Best in the world |

## Error Handling

| Scenario | Response |
|----------|----------|
| Account not linked | Guide them to link in the app. |
| No round data | "You don't have any rounds logged yet. Start a round in the app to begin tracking your stats!" |
| Player not found | "I couldn't find that player. Check the spelling or ask them for their RGDGC username." |
| API down | "Stats are unavailable right now. Try again in a few minutes." |

## Example Conversations

**User:** "How's my putting?"
**Clawd:** Resolves user, fetches stats, shows putting breakdown with trend and level comparison.

**User:** "What's my handicap?"
**Clawd:** Shows handicap with trend and explanation of what it means for scored events.

**User:** "Compare me to Carlos"
**Clawd:** Fetches both players' stats, presents side-by-side comparison.

**User:** "Show me my last 5 rounds"
**Clawd:** Fetches recent rounds, presents in a clean table.

**User:** "Am I getting better?"
**Clawd:** Compares last-10-rounds average to overall average, checks putting trend, shows handicap trajectory. "Your avg score dropped from +5.1 to +3.1 over the last 2 months, and your C1X putting is up 4%. You're definitely improving!"

**User:** "What's strokes gained mean?"
**Clawd:** Explains the concept in plain English with their personal number as an example.

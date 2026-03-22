---
name: rgdgc-standings
description: Get RGDGC league standings, leaderboards, and season points
triggers:
  - standings
  - leaderboard
  - points
  - who's winning
  - rankings
  - season standings
  - dubs standings
  - singles standings
---

# RGDGC Standings Skill

## Purpose
Fetch and present current season league standings from the RGDGC backend API.
Players frequently ask "who's winning?" or "how many points do I have?" — this
skill answers those questions with live data.

## Leagues

| League | ID | Schedule | Format |
|--------|----|----------|--------|
| Sunday Singles | 1 | Sundays | Individual stroke play |
| Dubs | 2 | Varies | Doubles (best shot / alternating) |

If the user does not specify a league, **default to Sunday Singles** (league_id=1).
If they say "dubs", "doubles", or "Wednesday" → league_id=2.
If they say "both" or "all standings" → fetch both leagues and show them together.

## Points System
```
Points = num_participants - finish_position + 1

Example with 12 players:
  1st place = 12 pts
  2nd place = 11 pts
  ...
  12th place = 1 pt
  DNF / DQ = 0 pts

Ties: Same position → same points → next position skips.
  Example: Two players tie for 2nd → both get 11 pts, next player is 4th (9 pts).
```

Each league has a `drop_worst` setting — the N worst event scores are excluded
from the season total. Always mention how many drops remain if the data includes it.

## API Call
```
get_leaderboard(league_id) → {
  "league": { "id": 1, "name": "Sunday Singles", "season": "2026", "drop_worst": 2 },
  "standings": [
    { "position": 1, "player_name": "...", "player_id": 42, "total_points": 68,
      "events_played": 9, "points_dropped": 4, "gross_points": 72 },
    ...
  ]
}
```

## How to Respond

### Full standings request ("show me the standings")
1. Call `get_leaderboard(league_id)`.
2. Show the **top 10** by default. If there are 15 or fewer players total, show all.
3. Format with podium emojis for the top 3:
   - 🥇 1st place
   - 🥈 2nd place
   - 🥉 3rd place
4. Use a clean columnar layout.

### Top-N request ("who's in the top 5?")
Show only the requested number of entries.

### Specific player request ("how many points does Blake have?")
1. Call `get_leaderboard(league_id)`.
2. Find the player by name (case-insensitive partial match).
3. Show their position, points, events played, and how far behind the leader.
4. If not found, say so and suggest checking the spelling.

### Comparison request ("am I ahead of Jake?")
Show both players' positions and the point gap between them.

## Formatting Template

```
📊 **Sunday Singles Standings** — 2026 Season

🥇  Blake S.        72 pts  (9 events)
🥈  Mike R.         68 pts  (9 events)
🥉  Carlos D.       65 pts  (8 events)
 4. Jake P.         61 pts  (9 events)
 5. Tony M.         58 pts  (8 events)
 6. Drew H.         55 pts  (7 events)
 7. Luis G.         52 pts  (9 events)
 8. Nate W.         48 pts  (8 events)
 9. Chris B.        45 pts  (7 events)
10. Omar F.         42 pts  (8 events)

📌 Drop worst 2 events • 9 of 16 events completed
```

Keep it tight — this is a chat message, not a spreadsheet.

## Error Handling
- **API unavailable:** "I can't reach the standings right now. Check back in a few minutes or try the mobile app."
- **Empty standings:** "No standings data yet for this season. The first event hasn't been scored."
- **Unknown league:** "I know about Sunday Singles and Dubs. Which one did you mean?"

## Example Conversations

**User:** "Who's winning dubs?"
**Clawd:** Calls `get_leaderboard(2)`, shows top standings for Dubs.

**User:** "Leaderboard"
**Clawd:** Calls `get_leaderboard(1)`, shows Sunday Singles top 10 (default).

**User:** "How many points does Carlos have in singles?"
**Clawd:** Calls `get_leaderboard(1)`, finds Carlos, responds:
"Carlos D. is in 3rd place with 65 points across 8 events. He's 7 points behind the leader."

**User:** "Show me both leaderboards"
**Clawd:** Calls `get_leaderboard(1)` and `get_leaderboard(2)`, shows top 5 of each.

**User:** "Am I in the top 5?"
**Clawd:** Resolves the user's player profile, searches the standings, and answers with their exact position.

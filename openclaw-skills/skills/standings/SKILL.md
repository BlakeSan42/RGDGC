---
name: rgdgc-standings
description: Get RGDGC league standings and leaderboards
triggers:
  - standings
  - leaderboard
  - points
  - who's winning
  - who is winning
  - season standings
  - league standings
---

# RGDGC Standings Skill

## What This Does
Fetches and presents current league standings from the RGDGC backend API.

## How to Respond

1. Determine which league the user is asking about:
   - "Singles" / "Sunday Singles" → league_id = 1
   - "Dubs" / "Doubles" → league_id = 2
   - If unclear, show both or ask which league.

2. Call `get_leaderboard(league_id)` to fetch standings.

3. Present the standings in a formatted table showing:
   - Position
   - Player name
   - Total points
   - Events played

4. If the API is unavailable, respond with:
   "I can't reach the standings right now. Check back in a few minutes or visit the app."

## Example Interactions

**User:** "Who's winning dubs?"
**Action:** Call `get_leaderboard(2)`, format and display top standings.

**User:** "Show me the leaderboard"
**Action:** Ask which league, or show Sunday Singles by default.

**User:** "What are the current points standings?"
**Action:** Call `get_leaderboard(1)` for Singles, present results.

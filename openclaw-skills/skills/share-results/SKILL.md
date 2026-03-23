---
name: rgdgc-share-results
description: Generate shareable event results and standings for Facebook, iMessage, Discord
triggers:
  - share results
  - post results
  - share to facebook
  - post to facebook
  - share standings
  - results for facebook
  - text me the results
  - imessage results
---

# Share Results Skill

## Purpose
After league day, the club manager needs to post results to the Facebook Group. Instead of typing it manually, they say "share today's results" and Clawd generates copy-paste-ready text with emoji formatting.

## API Calls

| Action | Endpoint |
|--------|----------|
| Event results | `GET /api/v1/league-ops/share/event-results/{event_id}` |
| Season standings | `GET /api/v1/league-ops/share/standings/{league_id}` |

## Conversations

**TD:** "Share today's results"
**Clawd:** Finds the most recent completed event, calls the share endpoint, returns:

```
🥏 Sunday Singles Results
📅 March 30, 2026
🏆 Sunday Singles | 20 players

🥇 Blake S. — 52 (-6) | 20 pts
🥈 Mike R. — 54 (-4) | 19 pts
🥉 Carlos D. — 55 (-3) | 18 pts
 4. Jake P. — 56 (-2) | 17 pts
 5. Tony M. — 57 (-1) | 16 pts
 6. Drew H. — 58 (E) | 15 pts
 7. Luis G. — 59 (+1) | 14 pts
 8. Kermit B. — 59 (+1) | 14 pts
 9. Nate W. — 60 (+2) | 12 pts
10. Chris B. — 61 (+3) | 11 pts

🎯 CTP Winners:
  Hole 5: Mike R. (8.3ft)
  Hole 12: Carlos D. (12.1ft)
  Hole 17: Blake S. (4.7ft)

💰 Ace Fund: $65.00

📱 River Grove Disc Golf Club
#RGDGC #DiscGolf #RiverGrove #Kingwood
```

Then says:
"Here are the results, formatted and ready. Copy the text above and paste it into the Facebook Group. Or I can send it to Discord/Telegram."

**TD:** "Share the current standings"
**Clawd:** Calls standings share endpoint:

```
🏆 Sunday Singles — 2026 Standings

 1. Blake S. — 156 pts (12 events)
 2. Mike R. — 148 pts (12 events)
 3. Carlos D. — 142 pts (11 events)
 4. Jake P. — 139 pts (12 events)
 5. Tony M. — 135 pts (11 events)
...

📱 River Grove Disc Golf Club
#RGDGC #DiscGolf #LeagueStandings
```

## Facebook Integration Note
The Facebook Groups API was deprecated in April 2024. Automated posting is not possible. This skill generates text that the admin copies and pastes into the Facebook Group manually. The text includes hashtags and emoji formatting optimized for Facebook's rendering.

The `facebook_deep_link` field in the API response (`fb://group/500404870098909`) can be used to open the Facebook Group directly from the mobile app for easy pasting.

## Cross-Platform Formatting
The same text works for:
- **Facebook Group** — paste directly
- **iMessage** — share as text message
- **Discord** — paste into channel (emoji render natively)
- **Telegram** — paste into group chat
- **Instagram Story** — screenshot the formatted text

## MCP Server Integration
The MCP server tool `get_event_results` already returns raw data. This skill formats that data for human sharing, adding emoji, CTP results, ace fund balance, and hashtags.

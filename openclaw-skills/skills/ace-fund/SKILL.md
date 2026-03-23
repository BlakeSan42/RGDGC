---
name: rgdgc-ace-fund
description: Track the ace fund balance, collect contributions, pay out aces
triggers:
  - ace fund
  - ace pot
  - how much is in the ace fund
  - ace fund balance
  - someone hit an ace
  - ace payout
  - collect ace fund
---

# Ace Fund Skill

## Purpose
Every player wants to know "how much is in the ace fund?" This skill answers that instantly and handles collections/payouts for the TD.

## API Calls

| Action | Endpoint | Auth |
|--------|----------|------|
| Check balance | `GET /api/v1/league-ops/ace-fund/balance` | Any player |
| Collect from event | `POST /api/v1/league-ops/ace-fund/collect` | Admin only |
| Pay out ace | `POST /api/v1/league-ops/ace-fund/payout` | Admin only |

## Conversations

**Player:** "How much is in the ace fund?"
**Clawd:**
```
💰 Ace Fund Balance: $47.00

Collected: $52.00 (52 contributions)
Paid out: $5.00 (1 ace)
Hit an ace to claim it! 🎯
```

**TD:** "Collect ace fund for today's event"
**Clawd:** Calls collect endpoint with current event ID, $1/player.
```
✅ Ace fund collected: $1 × 18 players = $18.00
New balance: $65.00
```

**TD:** "Blake hit an ace on hole 7!"
**Clawd:**
```
🎉🎉🎉 ACE!!! 🎉🎉🎉

Blake S. aced Hole 7!
Ace fund payout: $65.00 💰

(All players notified via push)
New ace fund balance: $0.00
```

---
name: orchestrate
description: Master reasoning skill — HOW to think across API, database, and bot systems for RGDGC
---

# RGDGC Master Reasoning

## When to use this skill
Before any investigation or analysis. This governs HOW to think.

## Causal Chain Thinking
Every RGDGC problem is a chain. Find the weak link:

1. **Player Registration** → Profile complete? → Wallet connected?
2. **Event Check-in** → Player found? → Event exists? → Already checked in? → Fee paid?
3. **Score Entry** → Round started? → Layout correct? → Scores valid? → Round finalized?
4. **Points Calculation** → All results in? → Positions correct? → Ties handled? → Points match field size?
5. **Leaderboard** → All events counted? → Drop-worst applied? → Cache current?

## Delta Thinking
When a metric changes, ask: "What changed between the good state and the bad state?"
- Compare event-over-event, week-over-week
- Check for: rule changes, data gaps, new edge cases, code deployments

## Cross-System Analysis
Every issue may span multiple systems:

| Symptom | Check API | Check DB | Check Bot |
|---------|-----------|----------|-----------|
| Wrong standings | Leaderboard endpoint response | Results table, points_earned values | Bot formatting, cache staleness |
| Check-in fails | Event status, auth token | Event exists, player exists | Bot message parsing, skill config |
| Score discrepancy | Round endpoint, score submission | hole_scores vs total, par values | Score input parsing |
| Payment failure | Blockchain endpoints | Transaction status, wallet address | Payment skill flow |

## Automatic Triggers
- **Leaderboard shows 0 pts for active player** → Check results table joins, DNF/DQ flags
- **Event has 0 check-ins day-of** → Check event status (upcoming vs active), cron job ran?
- **Bot gives wrong standings** → Cache TTL, API response format changed?
- **Points don't add up** → Check field_size rule, tie handling, drop_worst config

## Output Format
Always conclude with:
1. **What we found** (data-backed)
2. **Root cause** (not symptoms)
3. **Fix** (specific changes in specific files)
4. **Verification** (how to confirm the fix worked)

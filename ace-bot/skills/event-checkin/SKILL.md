---
name: rgdgc-event-checkin
description: Check into upcoming RGDGC league events via chat
triggers:
  - check in
  - checkin
  - sign up
  - register for event
  - im coming
  - i'll be there
  - count me in
  - who's playing
  - who's coming
  - who is checked in
---

# RGDGC Event Check-in Skill

## Purpose
Allow players to check into upcoming league events directly from chat (Discord,
Telegram, or WhatsApp). Also answers "who's coming?" and "what's the next event?"

## Prerequisites
The user's chat account must be linked to their RGDGC player profile. The bot
resolves this via Discord ID or Telegram ID. If the user is not linked, tell them:

> "Your account isn't linked yet. Open the RGDGC app → Profile → Connected Accounts
> and link your Discord/Telegram to check in from chat."

## Event Resolution

When a user says "check me in" without specifying an event:

1. Call `get_upcoming_events()` to fetch all upcoming events.
2. If there is exactly **one** event in the next 7 days, use that one.
3. If there are **multiple** upcoming events, ask the user which one:
   - "I see two upcoming events: **Sunday Singles** (Mar 29) and **Dubs** (Apr 1). Which one?"
4. If there are **no** upcoming events:
   - "There are no events scheduled right now. Check the app for updates."

### Matching by day or league name
- "Check me in for Sunday" → find the next event on a Sunday (likely Singles).
- "Check me in for dubs" → find the next Dubs event (league_id=2).
- "Check me in for event 42" → use event_id=42 directly.

## API Calls

### Find events
```
get_upcoming_events(league_id?) → {
  "events": [
    { "id": 42, "league_id": 1, "league_name": "Sunday Singles",
      "event_date": "2026-03-29T09:00:00", "layout_name": "Standard 18",
      "status": "upcoming", "checkin_count": 8 }
  ]
}
```

### Check in
```
checkin_event(event_id, user_id) → {
  "success": true,
  "event_id": 42,
  "message": "Checked in successfully"
}
```

### View who's checked in
```
get_event_checkins(event_id) → {
  "event_id": 42,
  "checkins": [
    { "player_name": "Blake S.", "checked_in_at": "2026-03-27T14:30:00" },
    ...
  ]
}
```

## How to Respond

### Check-in flow
1. Resolve the user's player profile from their chat account.
2. Identify the target event (see Event Resolution above).
3. Show event details and ask for confirmation:
   ```
   ✅ Found it — **Sunday Singles** on Mar 29 at River Grove DGC (Standard 18).
   8 players already checked in. Want me to check you in?
   ```
4. On confirmation, call `checkin_event(event_id, user_id)`.
5. Confirm success:
   ```
   🎯 You're in! Checked in for Sunday Singles (Mar 29).
   You're player #9. See you on the course!
   ```

### "Who's coming?" / "Who's checked in?"
1. Identify the event (same resolution logic).
2. Call `get_event_checkins(event_id)`.
3. List the checked-in players:
   ```
   📋 **Sunday Singles — Mar 29** (9 checked in)
   1. Blake S.
   2. Mike R.
   3. Carlos D.
   4. Jake P.
   5. Tony M.
   6. Drew H.
   7. Luis G.
   8. Nate W.
   9. Chris B.
   ```

### Quick confirmation (no back-and-forth)
If the user says something definitive like "count me in for Sunday" or "I'll be
there Sunday," skip the confirmation step and check them in directly. Only ask for
confirmation when the intent or target event is ambiguous.

## Error Handling

| Error | Response |
|-------|----------|
| Account not linked | "Your chat account isn't linked to RGDGC. Link it in the app under Profile → Connected Accounts." |
| Already checked in | "You're already checked in for this event! See you there." |
| Event not open | "Check-in isn't open yet for that event. It usually opens 3 days before." |
| Event not found | "I couldn't find that event. Use `/events` to see what's coming up." |
| API error | "I'm having trouble reaching the server. Try again in a minute or check in through the app." |

## Example Conversations

**User:** "Check me in for Sunday"
**Clawd:** Finds next Sunday Singles event, checks user in.
→ "🎯 You're in! Checked in for Sunday Singles (Mar 29). You're player #9."

**User:** "Who's playing this week?"
**Clawd:** Finds next event, fetches check-ins, lists players.

**User:** "Count me in"
**Clawd:** Only one event upcoming → checks user in directly.
If multiple → "Which event? Sunday Singles (Mar 29) or Dubs (Apr 1)?"

**User:** "I can't make it Sunday, can you remove me?"
**Clawd:** "I can't remove check-ins from chat yet. Open the app to update your status, or let a league admin know."

**User:** "Is there a dubs event coming up?"
**Clawd:** Calls `get_upcoming_events(2)` → shows next Dubs event with date, layout, and check-in count.

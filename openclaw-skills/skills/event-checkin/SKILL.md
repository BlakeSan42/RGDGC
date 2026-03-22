---
name: rgdgc-event-checkin
description: Check players into upcoming RGDGC events
triggers:
  - check in
  - checkin
  - sign up
  - register for event
  - i'm playing
  - count me in
---

# RGDGC Event Check-in Skill

## What This Does
Allows players to check into upcoming league events through the chat bot.

## How to Respond

1. The user needs to be linked (Discord ID or Telegram ID mapped to an RGDGC player).
   - If not linked, tell them to connect their account in the mobile app.

2. If no event ID is specified:
   - Call `get_upcoming_events()` to find the next event.
   - Show the event details and ask for confirmation.

3. If an event ID is provided:
   - Call `checkin_event(event_id, user_id)`.
   - Confirm the check-in on success.

4. On failure:
   - "Event not found" → Tell the user the event ID may be wrong.
   - "Already checked in" → Let them know they're already set.
   - "Event not open" → The event isn't accepting check-ins yet.

## Example Interactions

**User:** "Check me in for Sunday"
**Action:** Find next Sunday Singles event, confirm, then call `checkin_event`.

**User:** "/checkin 42"
**Action:** Call `checkin_event(42, user_id)`, confirm result.

**User:** "I'm playing this week"
**Action:** Find next event, check them in, confirm.

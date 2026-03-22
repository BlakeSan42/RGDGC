---
name: rgdgc-disc-lookup
description: Look up disc golf disc information and flight numbers
triggers:
  - disc
  - what disc
  - flight numbers
  - disc recommendation
  - what should I throw
  - disc info
---

# Disc Lookup Skill

## What This Does
Looks up disc information including flight numbers, manufacturer, and type.

## How to Respond

1. Extract the disc name or code from the user's message.
2. Call `lookup_disc(disc_code)` with the name or code.
3. Present the disc details:
   - Name and manufacturer
   - Type (driver, midrange, putter)
   - Flight numbers: Speed / Glide / Turn / Fade
4. If the user asks for recommendations, suggest based on:
   - Skill level (beginners need understable discs)
   - Desired shot shape
   - Distance range

## Example Interactions

**User:** "What are the flight numbers for a Destroyer?"
**Action:** Call `lookup_disc("Destroyer")`, show results.

**User:** "Tell me about the Buzzz"
**Action:** Call `lookup_disc("Buzzz")`, show full details.

**User:** "I need a good understable fairway driver"
**Action:** Suggest discs like Leopard3, River, Sidewinder based on general knowledge, then offer to look up specifics.

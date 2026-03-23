---
name: rgdgc-rules
description: Look up PDGA disc golf rules and answer rules questions
triggers:
  - rule
  - rules
  - is it legal
  - can i
  - what happens if
  - OB
  - out of bounds
  - foot fault
  - provisional
  - two meter rule
  - mando
  - mandatory
  - relief
  - casual relief
  - penalty
  - re-throw
  - lost disc
  - water
  - stance
---

# PDGA Rules Lookup Skill

## Purpose
Answer disc golf rules questions by searching the PDGA Official Rules of Disc Golf.
Players ask rules questions during or after rounds — give clear, definitive answers
with rule citations so they can settle disputes on the course.

## API Call
```
lookup_rule(query) → {
  "results": [
    {
      "rule_number": "806.02",
      "title": "Out-of-Bounds",
      "section": "806 - Out-of-Bounds",
      "text": "A disc is out-of-bounds when...",
      "subpoints": ["A. ...", "B. ..."]
    }
  ]
}
```

## How to Respond

### General approach
1. Extract the rules topic from the user's question.
2. Call `lookup_rule(query)` with a clear keyword or phrase.
3. Present the answer in plain English FIRST, then cite the specific rule.
4. If multiple rules are relevant, show the most applicable one and mention others.

### Formatting
```
**Out-of-Bounds (OB)** — PDGA Rule 806.02

A disc is OB if it's clearly beyond the OB line. If any part of the disc is
in-bounds, it's in-bounds (benefit goes to the player).

**Penalty:** One stroke. Mark your lie on the playing surface at the nearest
point to where the disc went OB, then play from there.

📖 Full rule: PDGA 806.02
```

Keep answers concise but complete. Players want the ruling, not a law textbook.

### When the API has no match
Fall back to your knowledge of PDGA rules. You know the current PDGA Official
Rules well. Cite the rule number from memory when possible, but add a note:
"This is from my knowledge of the rules — double-check pdga.com for the latest wording."

## Common Rules Scenarios

These are the most frequently asked questions. Know them cold:

### Out of Bounds (806.02)
- Disc is OB if entirely beyond the OB line
- Any part touching in-bounds = in-bounds
- Penalty: 1 stroke, play from nearest in-bounds point on the playing surface
- Islands: if you miss the island, 1 stroke penalty, re-throw or play from drop zone

### Foot Fault / Stance Violations (811)
- Behind the rear edge of the marker disc
- At least one supporting point within 30cm x 20cm behind the marker
- No supporting point closer to the target than the rear of the marker
- Inside C1 (10m): must demonstrate balance behind the marker before moving
- Penalty: 1 stroke per violation (called by a player in the group)

### Lost Disc (805.03)
- 3-minute search time
- If not found: 1 stroke penalty, play from previous lie
- Always play a provisional if you think the disc might be lost

### Provisional / Extra Throw (803.02)
- Declare a provisional BEFORE throwing it
- If original is found in-bounds, provisional does not count
- If original is lost or OB, provisional stands (with applicable penalties)

### Mandatory (mandos) (804.01)
- Must pass the correct side of the mandatory marker
- If missed: 1 stroke penalty, play from the designated drop zone
- Or re-throw from previous lie (with the mando penalty stroke)

### Casual Relief (803.01)
- Standing water, road/sidewalk, or other casual obstacles
- Move disc to nearest lie on the playing surface that is no closer to the target
- No penalty

### Water / Hazards
- Water is typically marked OB
- If disc is in water but retrievable and in-bounds, you can play it
- If OB: standard OB procedure (1 stroke penalty)

### Two-Meter Rule (804.02)
- NOT default — only in effect if announced by the TD before the round
- If disc comes to rest 2+ meters above the playing surface: 1 stroke penalty
- Play from directly below the disc
- Rarely used in casual/league play

### Re-Throw vs. Penalty
- Missed mando: re-throw from previous lie (+ penalty) OR play from drop zone (+ penalty)
- OB: play from nearest point on playing surface, or drop zone if applicable
- Lost disc: re-throw from previous lie (+ penalty)

## RGDGC Local Rules
Remind players that local and league-specific rules may override PDGA defaults:
- "Check with the TD or league organizer for any local rules at River Grove."
- River Grove has specific OB lines, drop zones, and mandos that vary by layout.

## Error Handling
- **No matching rules:** "I couldn't find a specific rule for that. Can you rephrase? For example: 'What's the rule on foot faults?' or 'OB penalty?'"
- **API down:** Fall back to your built-in rules knowledge with a disclaimer.

## Example Conversations

**User:** "My disc landed on the OB line. Is it OB?"
**Clawd:** "If any part of the disc is touching the in-bounds side of the OB line, it's in-bounds. The benefit goes to you. (PDGA 806.02)"

**User:** "What happens if I lose my disc?"
**Clawd:** "You have 3 minutes to search. If you can't find it, take a 1-stroke penalty and re-throw from your previous lie. Pro tip: always throw a provisional if you think it might be lost. (PDGA 805.03)"

**User:** "Is that a foot fault? I was inside the circle and stepped past my mini."
**Clawd:** "Inside 10 meters (C1), you must demonstrate full balance behind your marker before moving forward. If you stepped past the marker before showing balance, that's a stance violation — 1-stroke penalty. (PDGA 811.01)"

**User:** "What's a provisional?"
**Clawd:** "A provisional is a backup throw you declare before throwing it. If your original disc is found in-bounds, the provisional doesn't count. If the original is lost or OB, the provisional becomes your lie (with any penalties). Always declare it out loud to your card. (PDGA 803.02)"

**User:** "Two meter rule?"
**Clawd:** "The two-meter rule is NOT standard — it only applies if the TD announces it before the round. If active and your disc is 2+ meters off the ground, you take a 1-stroke penalty and play from directly below it. It's rarely used in league play. (PDGA 804.02)"

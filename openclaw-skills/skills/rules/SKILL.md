---
name: rgdgc-rules
description: Look up PDGA disc golf rules
triggers:
  - rule
  - rules
  - pdga
  - penalty
  - OB
  - out of bounds
  - mandatory
  - casual relief
  - foot fault
  - re-throw
---

# PDGA Rules Lookup Skill

## What This Does
Searches the PDGA Official Rules of Disc Golf and returns relevant rule text.

## How to Respond

1. Extract the rule topic from the user's message.
2. Call `lookup_rule(query)` with the extracted keyword(s).
3. Present the matching rule(s) with:
   - Rule number (e.g., 806.02)
   - Rule title
   - Full rule text
4. If multiple rules match, show the top 3 most relevant.
5. If no rules match, suggest alternative search terms.

## Example Interactions

**User:** "What's the rule on OB?"
**Action:** Call `lookup_rule("out of bounds")`, show results.

**User:** "Is that a foot fault?"
**Action:** Call `lookup_rule("foot fault")` or `lookup_rule("stance violations")`.

**User:** "What happens if my disc goes in the water?"
**Action:** Call `lookup_rule("water hazard")` or `lookup_rule("OB relief")`.

## Notes
- Always cite the specific rule number so players can reference it.
- For ambiguous questions, provide the most common interpretation first.
- Remind users that local/league rules may override PDGA rules in some cases.

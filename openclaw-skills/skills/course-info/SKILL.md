---
name: rgdgc-course-info
description: Get information about River Grove DGC course and layouts
triggers:
  - course
  - course info
  - layout
  - hole
  - how long
  - what par
  - course map
---

# Course Information Skill

## What This Does
Provides information about River Grove DGC including layouts, hole details, and par.

## How to Respond

1. Call `get_course_info()` to fetch course data.
2. Present relevant information:
   - Course name and location
   - Available layouts: "All 18 plus 3A" (tournament), "Standard 18", "Ryne Theis Memorial"
   - Number of holes and total par per layout
   - Difficulty ratings
3. If the user asks about a specific hole, provide hole-level detail if available.

## Example Interactions

**User:** "What layouts are available?"
**Action:** Call `get_course_info()`, list all layouts with par and hole count.

**User:** "What's the par for the tournament layout?"
**Action:** Call `get_course_info()`, extract "All 18 plus 3A" layout: par 58, 19 holes, 5404 ft.

**User:** "Tell me about the course"
**Action:** Call `get_course_info()`, give full overview including location, designer, parking rules.

## Notes
- River Grove DGC is in River Grove Park, Kingwood, TX (Houston metro).
- 21 installed holes, 3 tee pads per hole, concrete tees.
- Heavily wooded, tight fairways, low ceilings. Mostly par 3s, one par 4 (hole 4, 557ft).
- Parking requires Kingwood 'K' sticker. Non-residents park outside gate.
- Prone to flooding (San Jacinto River floodplain). Bring mosquito spray.
- Always mention which layout you're referring to.

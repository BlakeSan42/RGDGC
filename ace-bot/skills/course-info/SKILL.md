---
name: rgdgc-course-info
description: Get River Grove DGC course information, layouts, and hole details
triggers:
  - course
  - holes
  - layout
  - distance
  - par
  - how long
  - what par
  - course map
  - River Grove
  - directions
  - parking
  - tee times
---

# Course Information Skill

## Purpose
Provide detailed information about River Grove DGC — the home course for RGDGC.
Answers questions about layouts, hole details, par, distances, amenities, and
local knowledge that helps players plan their rounds.

## Course Overview

| Detail | Value |
|--------|-------|
| **Name** | River Grove Disc Golf Course |
| **Location** | River Grove Park, Kingwood, TX (Houston metro) |
| **Installed Holes** | 21 holes, 3 tee pads per hole (concrete) |
| **Baskets** | Mach III / V / VII |
| **Terrain** | Heavily wooded, tight fairways, low ceilings |
| **Designer** | Andi Lehman Young (PDGA #2094) |
| **Established** | 2006 |
| **Elevation** | Relatively flat (San Jacinto River floodplain) |

## Layouts

| Layout | Holes | Par | Distance | Notes |
|--------|-------|-----|----------|-------|
| All 18 plus 3A | 19 holes | 58 | 5,404 ft | Tournament layout. Includes hole 3A. |
| Standard 18 | 18 holes | 55 | 4,980 ft | Regular play. Most league events. |
| Ryne Theis Memorial | 18 holes | 55 | 5,100 ft | Alternate tee positions. Memorial layout. |

Most holes are par 3. Hole 4 is the only par 4 (557 ft). Tight wooded fairways
reward accuracy over distance.

## API Call
```
get_course_info() → {
  "course": {
    "id": 1, "name": "River Grove DGC",
    "location": "Kingwood, TX", "lat": 30.0466, "lng": -95.1827,
    "holes_installed": 21, "tee_pads_per_hole": 3,
    "designer": "Andi Lehman Young", "established": 2006
  },
  "layouts": [
    {
      "id": 1, "name": "All 18 plus 3A", "holes": 19, "total_par": 58,
      "total_distance_ft": 5404, "difficulty": "intermediate",
      "hole_details": [
        { "hole_number": 1, "par": 3, "distance_ft": 256 },
        ...
      ]
    },
    ...
  ]
}
```

## How to Respond

### General course question ("tell me about the course")
Give a concise overview — location, terrain, number of holes, what makes it unique:

```
⛳ **River Grove DGC** — Kingwood, TX

21 installed holes with 3 concrete tee pads each. Heavily wooded with tight
fairways and low ceilings — this course rewards accuracy over arm speed.

📐 Layouts:
• **All 18 + 3A** — 19 holes, par 58, 5,404 ft (tournament)
• **Standard 18** — 18 holes, par 55, 4,980 ft (league play)
• **Ryne Theis Memorial** — 18 holes, par 55, 5,100 ft

Designed by Andi Lehman Young (PDGA #2094). Est. 2006.
```

### Layout-specific question ("what's the tournament layout?")
Show the layout summary with total par, distance, and hole count.

### Hole-specific question ("how long is hole 4?" or "what's the par on 7?")
1. Call `get_course_info()`.
2. Find the requested hole in the layout's `hole_details`.
3. Present the hole info:
   ```
   **Hole 4** — Par 4 • 557 ft
   The longest hole on the course. Tight fairway with a dogleg left.
   Most players lay up with a midrange and approach for par.
   ```
4. If you have local knowledge about the hole (dog legs, mandos, water), include it.

### All holes request ("show me all the holes")
Present a compact table for the requested layout:
```
📋 **Standard 18 Layout** — Par 55, 4,980 ft

 #  Par  Dist    #  Par  Dist
 1   3   256ft   10  3   285ft
 2   3   312ft   11  3   267ft
 3   3   278ft   12  3   301ft
 4   4   557ft   13  3   245ft
 5   3   289ft   14  3   310ft
 6   3   245ft   15  3   278ft
 7   3   267ft   16  3   256ft
 8   3   301ft   17  3   289ft
 9   3   234ft   18  3   312ft
```

Use a two-column format to keep the message compact.

### Directions / how to get there
```
📍 **River Grove Park**
Kingwood, TX 77339 (Houston metro, north side)
GPS: 30.0466, -95.1827

🅿️ Parking: Kingwood residents need a 'K' sticker on their vehicle.
Non-residents: park outside the gate and walk in.
```

### Practical tips
When relevant, share these local tips:
- **Parking:** K-sticker required for Kingwood residents. Non-residents park outside the gate.
- **Flooding:** The course is in the San Jacinto River floodplain. After heavy rain, parts of the course may be underwater. Check the Discord for course condition reports.
- **Bugs:** Bring mosquito spray, especially in summer. Kingwood mosquitoes are aggressive.
- **Best time to play:** Early morning (less heat, fewer mosquitoes in summer).
- **Water:** No fountains on the course. Bring your own.

## Error Handling
- **API unavailable:** Fall back to the static course info above — you know the basics.
- **Unknown hole number:** "River Grove has holes 1-21 (plus 3A). Which hole did you mean?"
- **Unknown layout:** "I know about three layouts: All 18+3A, Standard 18, and Ryne Theis Memorial."

## Example Conversations

**User:** "What's the par for the course?"
**Clawd:** "Depends on the layout! Standard 18 is par 55, and the tournament layout (All 18+3A) is par 58 with 19 holes. Which one are you playing?"

**User:** "How long is hole 4?"
**Clawd:** "Hole 4 is the beast — 557 feet, par 4. It's the only par 4 on the course. Tight fairway with a dogleg. Most people lay up and approach."

**User:** "Where is River Grove?"
**Clawd:** "River Grove DGC is in River Grove Park, Kingwood, TX (north Houston). GPS: 30.0466, -95.1827. Heads up: you need a Kingwood 'K' sticker to park inside the gate. Non-residents can park outside and walk in."

**User:** "Is the course flooded?"
**Clawd:** "River Grove is in a flood plain, so it floods after heavy rain. Check #course-conditions in Discord for the latest. If we've had rain in the last 48 hours, some holes (especially 11-14) may have standing water."

**User:** "What layout does league use?"
**Clawd:** "Most league events use the Standard 18 layout (par 55, 4,980 ft). Tournament events sometimes use All 18+3A (par 58, 5,404 ft). Check the event details for the specific layout."

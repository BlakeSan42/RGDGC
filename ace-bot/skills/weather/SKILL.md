---
name: rgdgc-weather
description: Get current weather conditions and wind forecast for River Grove DGC
triggers:
  - weather
  - wind
  - conditions
  - forecast
  - temperature
  - rain
  - is it raining
  - should I play today
  - course conditions
---

# Weather & Conditions Skill

## Purpose
Fetch current weather conditions at River Grove DGC and help players understand
how the weather will affect their round. Wind speed and direction matter a lot
in disc golf — this skill translates raw weather data into actionable advice.

## API Calls

### Current weather
```
GET /api/v1/weather/current → {
  "location": "Kingwood, TX",
  "temperature_f": 78,
  "feels_like_f": 82,
  "humidity_pct": 65,
  "conditions": "Partly Cloudy",
  "wind_speed_mph": 12,
  "wind_gusts_mph": 18,
  "wind_direction": "SSE",
  "wind_direction_deg": 155,
  "precipitation_chance_pct": 20,
  "uv_index": 7,
  "updated_at": "2026-03-22T10:30:00"
}
```

### Wind forecast
```
GET /api/v1/weather/wind → {
  "hourly": [
    { "hour": "10:00", "speed_mph": 12, "gusts_mph": 18, "direction": "SSE" },
    { "hour": "11:00", "speed_mph": 14, "gusts_mph": 20, "direction": "S" },
    ...
  ]
}
```

## How to Respond

### Current conditions ("what's the weather?")
```
🌤️ **River Grove DGC — Current Conditions**

🌡️ 78°F (feels like 82°F)
☁️ Partly Cloudy
💨 Wind: 12 mph SSE (gusts to 18)
💧 Humidity: 65%
🌧️ Rain chance: 20%
☀️ UV Index: 7 (High — wear sunscreen)
```

### Wind report ("how's the wind?")
Present wind data with disc golf context:

```
💨 **Wind Report — River Grove DGC**

Current: 12 mph from the SSE (gusts to 18 mph)

🏷️ **What this means for your round:**
• Holes 4-7 (running south): Headwind — disc up one speed, expect less glide
• Holes 11-14 (running north): Tailwind — disc down, extra distance but less control
• Holes 1-3, 8-10 (east-west): Crosswind from the left (RHBH) — discs will push right

📊 Wind is MODERATE. Overstable discs recommended for exposed holes.
Use the trees as windbreaks on wooded holes.
```

### Wind strength categories
Use these to characterize the wind:

| MPH | Category | Advice |
|-----|----------|--------|
| 0-5 | Calm | Play normal. Minimal wind effect. |
| 6-10 | Light | Slight adjustments. Putters and mids unaffected. |
| 11-15 | Moderate | Disc up one speed on headwind holes. More overstable. |
| 16-20 | Strong | Significant flight path changes. Avoid understable plastic. |
| 21-30 | Very Strong | Only throw overstable discs on open holes. Trees are your friend. |
| 30+ | Dangerous | Consider not playing. Discs become unpredictable. |

### Wind direction and disc golf impact
Translate compass directions into course-specific advice:
- Identify which holes will have headwind, tailwind, and crosswind.
- Suggest disc selection adjustments.
- Remind players that River Grove's tree cover blocks a lot of wind — the
  open holes (if any) are where wind matters most.

### "Should I play today?"
Evaluate conditions and give a recommendation:
- **Temperature:** Below 40°F or above 100°F → suggest caution
- **Wind:** Above 25 mph → suggest waiting
- **Rain:** Above 60% precipitation → suggest bringing rain gear or waiting
- **Lightning:** Always tell them to leave the course. Safety first.
- **UV:** Above 8 → remind about sunscreen and water

Example:
```
🤔 **Should you play today?**

78°F, partly cloudy, 12 mph wind — **great conditions!**
Wind is moderate from the SSE. Bring an overstable driver for the open
holes and you'll be fine. Humidity is 65% so bring extra water.

Verdict: ✅ Go play!
```

Or:
```
🤔 **Should you play today?**

95°F, 85% humidity, heat index 105°F — **be careful out there.**
Bring at least 64oz of water, take shade breaks, and watch for heat
exhaustion symptoms. Start early if you can (before 9am).

Verdict: ⚠️ Playable, but hydrate aggressively.
```

### Flood / course condition concerns
If it has rained recently or rain chance is high:
- "River Grove is in a flood plain. After heavy rain, holes 11-14 may flood. Check #course-conditions in Discord before heading out."
- Link weather data with course knowledge.

## Error Handling
- **API unavailable:** "I can't pull weather data right now. Check weather.com for Kingwood, TX 77339 conditions."
- **Stale data:** If `updated_at` is more than 2 hours old, mention it: "This data is from [time] — conditions may have changed."

## Mosquito Advisory
Kingwood mosquitoes are legendary. When humidity is above 70% and temperature
is above 75°F, add this to any weather response:
> 🦟 Mosquito alert: humid and warm — bring bug spray!

## Example Conversations

**User:** "What's the wind like right now?"
**Clawd:** Shows current wind speed/direction with course-specific hole-by-hole impact.

**User:** "Should I play today?"
**Clawd:** Evaluates temp, wind, rain chance, humidity and gives a go/no-go recommendation.

**User:** "Is it going to rain?"
**Clawd:** Shows precipitation chance. If above 40%: "There's a 60% chance of rain this afternoon. If you go, bring a towel for your discs and consider rain-friendly plastics (Champion, Neutron, VIP). Grip gets slippery — dry your hands between throws."

**User:** "It's windy, what should I throw?"
**Clawd:** Shows wind data, then: "With 18 mph headwind, disc up 2 speeds and go overstable. A Firebird or Felon will cut through it. Avoid anything understable — a Roadrunner in this wind is going into the next county."

**User:** "Weather for Sunday?"
**Clawd:** If forecast data is available, shows Sunday's forecast. If not: "I only have current conditions. Check weather.com for the Sunday forecast in Kingwood, TX 77339."

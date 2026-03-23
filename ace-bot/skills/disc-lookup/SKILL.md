---
name: rgdgc-disc-lookup
description: Look up registered disc information by QR code or disc code, and general disc info
triggers:
  - disc
  - found disc
  - lost disc
  - whose disc
  - RGDG-
  - scan
  - QR
  - flight numbers
  - what disc
  - disc recommendation
  - what should I throw
---

# Disc Lookup Skill

## Purpose
Two related functions in one skill:
1. **Registered disc lookup** — Look up a club-registered disc by its RGDG code
   (e.g., RGDG-0042) to identify the owner and facilitate lost/found disc returns.
2. **General disc info** — Look up any disc golf disc by name to get flight numbers,
   manufacturer, type, and recommendations.

## API Calls

### Registered disc lookup (by code)
```
lookup_disc("RGDG-0042") → {
  "disc_code": "RGDG-0042",
  "owner": { "name": "Blake S.", "phone_last4": "1234", "contact_pref": "discord" },
  "disc": { "name": "Destroyer", "manufacturer": "Innova", "color": "Star Pink",
            "flight_numbers": { "speed": 12, "glide": 5, "turn": -1, "fade": 3 } },
  "status": "active",
  "registered_at": "2025-11-15"
}
```

### General disc lookup (by name)
```
lookup_disc("Destroyer") → {
  "name": "Destroyer",
  "manufacturer": "Innova",
  "type": "Distance Driver",
  "plastic_types": ["Star", "Champion", "GStar", "Halo"],
  "flight_numbers": { "speed": 12, "glide": 5, "turn": -1, "fade": 3 },
  "description": "High-speed overstable distance driver...",
  "similar_discs": ["DD3", "Zeus", "Nuke"]
}
```

## How to Respond

### Found a disc (lost & found)
When someone says "I found a disc" or provides an RGDG code:

1. Ask for the code if not provided: "What's the code on the disc? Look for an RGDG sticker or QR code (format: RGDG-XXXX)."
2. Call `lookup_disc(code)` with the RGDG code.
3. If found, show the owner info (but protect privacy):
   ```
   🏷️ **Disc Found: RGDG-0042**
   Owner: Blake S.
   Disc: Star Destroyer (Pink)
   Preferred contact: Discord

   I'll notify the owner. In the meantime, please drop it in the lost & found
   bin at the park or hold onto it and we'll connect you two.
   ```
4. **Never share full phone numbers or emails** — only the contact preference
   and last 4 digits of the phone number.

### Lost a disc
When someone says "I lost a disc":

1. Ask which disc and where: "Which disc did you lose and on what hole? I'll flag it in the system."
2. If they have the code, log it as lost.
3. Suggest: "Post in #lost-and-found with a description. If someone finds it and scans the QR code, you'll be notified automatically."

### No code / no sticker
If the disc has no RGDG code:
- "That disc isn't registered in our system. Post a photo in #lost-and-found with the disc details (color, stamp, plastic type) and someone might recognize it."
- Suggest the owner register their discs: "Tell them about our disc registration — scan the QR at the kiosk or register in the app."

### General disc info request
When someone asks about a disc by name (not an RGDG code):

1. Call `lookup_disc(disc_name)`.
2. Present the info cleanly:
   ```
   🥏 **Innova Destroyer**
   Type: Distance Driver
   Flight Numbers: 12 / 5 / -1 / 3
   Plastics: Star, Champion, GStar, Halo

   High-speed overstable driver. Needs a lot of arm speed to get full
   flight — not recommended for beginners. Great for headwind drives
   and dependable fade finishes.

   Similar discs: DD3, Zeus, Nuke
   ```

### Disc recommendations
When someone asks "what disc should I throw?" or "I need an understable midrange":

1. If the API has a recommendation endpoint, use it.
2. Otherwise, use your disc golf knowledge to suggest 2-3 options.
3. Consider the player's skill level:
   - **Beginners:** Understable, lower speed (Leopard, Buzzz, Aviar)
   - **Intermediate:** Neutral stability, mid-speed (Teebird, Roc3, Envy)
   - **Advanced:** Full range, high speed (Destroyer, Zeus, Force)
4. Always explain WHY you're recommending each disc.

### Flight numbers explanation
If someone asks "what do flight numbers mean?":
```
Flight numbers describe how a disc flies:
• **Speed** (1-14): How fast you need to throw it for proper flight
• **Glide** (1-7): How well it stays in the air
• **Turn** (-5 to +1): High-speed curve (negative = turns right for RHBH)
• **Fade** (0-5): Low-speed hook at the end (always goes left for RHBH)

For a right-hand backhand (RHBH) thrower:
- Negative turn = disc goes right early
- Positive fade = disc goes left late
```

## Error Handling

| Scenario | Response |
|----------|----------|
| Code not found | "I couldn't find disc RGDG-XXXX in our system. Double-check the code — it should be on the QR sticker." |
| Disc name not found | "I don't have info on that disc. Try the full name (e.g., 'Innova Destroyer' or just 'Destroyer')." |
| API down | Fall back to general disc knowledge for common discs. |

## Example Conversations

**User:** "I found a disc with RGDG-0042 on it"
**Clawd:** Looks up RGDG-0042, shows owner info, offers to help return it.

**User:** "What are the flight numbers for a Buzzz?"
**Clawd:** "The Discraft Buzzz is a midrange: 5 / 4 / -1 / 1. Super straight flyer, great for tunnel shots and approaches. One of the most popular midranges in the game."

**User:** "I'm new, what putter should I get?"
**Clawd:** "For a new player, I'd recommend: **Discraft Luna** (3/3/-1/1) — straight and forgiving, **Innova Aviar** (2/3/0/1) — the classic, reliable and cheap, or **MVP Atom** (3/3/-0.5/1) — great feel and glide. Pick whichever feels best in your hand!"

**User:** "Lost my orange Teebird on hole 7"
**Clawd:** "Sorry to hear that! Post in #lost-and-found with the details (orange Teebird, hole 7). If it has an RGDG sticker, anyone who finds it can scan it and you'll be notified. If not, consider registering your discs in the app to make future returns easier."

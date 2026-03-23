# Club Manager Assessment — What We Have, What's Missing

> Written from the perspective of a club leader who runs weekly leagues, manages money, coordinates volunteers, deals with KSA, and tries to grow the community — all while having a day job.

---

## What We Have (166 endpoints, 38 screens, 14 admin pages)

### The Stuff That Actually Runs a League Day

| Task | Tool Available | Status |
|------|---------------|--------|
| Create events with entry fees | Admin dashboard + API | Built |
| Check players in | Mobile app + API | Built |
| Score rounds hole-by-hole | Mobile scorecard (1,067 LOC) | Built |
| Calculate points (field-size rule) | Backend points service | Built |
| Show live leaderboard | Mobile + admin | Built |
| Submit results and finalize | Admin dashboard | Built |
| Collect entry fees | Treasury/payments API | Built |
| Pay out prizes | Treasury ledger | Built |
| Track who owes money | Analytics unpaid endpoint | Built |
| Export financials CSV | Treasury export | Built |

### The Money Side

| Task | Tool Available | Status |
|------|---------------|--------|
| Record cash/Venmo/Zelle payments | Ledger API (12 entry types) | Built |
| See P&L by month | Analytics financial summary | Built |
| Cash flow trend chart | Analytics cashflow endpoint | Built |
| Per-event financial breakdown | Analytics event-breakdown | Built |
| Budget vs actual | Treasury budget tracking | Built |
| Season summary | Season rollup model | Built |
| Revenue forecast | Analytics strategic forecast | Built |

### Player Management

| Task | Tool Available | Status |
|------|---------------|--------|
| Player profiles | User model + API | Built |
| Handicap calculation | Stats service | Built |
| Player segments (core/casual/lapsed) | Analytics membership | Built |
| Churn risk detection | Analytics churn-risk | Built |
| Retention cohort analysis | Analytics retention | Built |
| Role management (admin/player) | Admin dashboard | Built |
| Push notifications | Expo push service | Built |

### Course & Play

| Task | Tool Available | Status |
|------|---------------|--------|
| Course/layout/hole data | Course models + geo | Built |
| GPS mapping with satellite | PostGIS + Mapbox | Built |
| Putting analytics (C1/C1X/C2) | Physics model (Gelman & Nolan) | Built |
| Scoring trends | Analytics performance | Built |
| Offline scoring | Offline queue + sync | Built |
| Weather integration | Weather service | Built |

### Community Tools

| Task | Tool Available | Status |
|------|---------------|--------|
| KSA knowledge base | Articles API + mobile screen | Built |
| Tow alert system | Real-time push to all players | Built |
| Disc registration + lost disc | QR code system | Built |
| AI chatbot (Claude) | OpenClaw + MCP server | Built |
| Discord/Telegram bot | Bot with 6 slash commands | Built |
| Announcements | Admin broadcast system | Built |

---

## What's Missing — The Club Manager's Honest List

### CRITICAL — Things That Make League Day Chaotic

**1. Player Groups / Card Assignments**
We have no way to assign players to cards (groups of 4). Every league day, the TD manually writes cards on paper or texts them out. The `RoundGroup` model exists but there's no UI or assignment logic.

**What we need:** Auto-grouping algorithm (random, by handicap, snake draft) + ability to manually adjust + share card assignments via push notification and in-app display before tee time.

**2. Tee Time / Shotgun Start Management**
No way to assign starting holes for shotgun starts or stagger tee times. The TD stands at hole 1 and waves groups through.

**What we need:** Shotgun start assignment (group → hole), tee time scheduler, "your group starts on hole X" notification pushed to each player.

**3. CTP (Closest to Pin) Tracking**
CTP is collected at most events ($1-2 per player, separate from entry fee) and paid out to whoever is closest on designated holes. Currently tracked on a Post-it note stuck to the basket.

**What we need:** CTP hole designation per event, distance logging (manual entry or GPS), automatic payout calculation, integrated with treasury.

**4. Ace Fund Tracking**
Monthly ace fund ($1/player/event collected, rolls over, paid out when someone hits an ace). Currently tracked in a spreadsheet or someone's head.

**What we need:** Ace fund balance visible in treasury, auto-collection tracking per event, payout trigger when ace is scored, running balance displayed to players.

**5. DNF / Pickup Rule**
Players who are struggling can "pick up" after double-par on a hole. There's no clean way to record this — the scorecard requires a number for every hole.

**What we need:** "Pickup" option in scoring (records as par+4 or double-par per league rules, configurable), DNF flag on round, scoring handles partial rounds gracefully.

### HIGH — Things That Waste the Club Manager's Time

**6. Recurring Event Scheduling**
Every week, the TD has to manually create the next event. "Sunday Singles, March 30, Standard 18, $5 entry."

**What we need:** Recurring event template — "Every Sunday at 2pm, this layout, this fee, auto-create 4 weeks ahead." One setup, runs itself.

**7. Waitlist / Capacity Management**
If a tournament fills up (field capped at 36), there's no waitlist. Players text the TD who maintains a mental list.

**What we need:** Max field size per event, auto-waitlist when full, auto-promote when someone drops, notification to waitlisted players.

**8. Player Communication Beyond Push**
Push notifications are fire-and-forget. No way to know who read them. No way to send targeted messages to specific groups (just this league, just checked-in players).

**What we need:** Read receipts on announcements, targeted messaging (by league, by segment, by event), message templates ("Rain delay — pushed to 3pm").

**9. Volunteer Coordination**
No way to track who volunteers, what they do, or how many hours they contribute. All volunteer work is invisible.

**What we need:** Volunteer sign-up per event (scorekeeper, spotter, setup crew), hour logging, total hours report (for KSA/grant reporting), volunteer leaderboard.

**10. Equipment Inventory**
No tracking of club-owned equipment: practice baskets, banners, first aid kit, folding table, scorecards, pencils, mini markers.

**What we need:** Simple inventory list with location, condition, and check-out system. "Who has the practice basket?"

### MEDIUM — Things That Would Make the Club Better

**11. Player Handicap Visible in App**
Handicap is calculated in the backend but isn't prominently displayed or used for event grouping. Players constantly ask "what's my handicap?"

**12. Head-to-Head History**
The compare screen exists (924 LOC) but doesn't show "you've played against this person 14 times, you're 8-6."

**13. Course Condition Reports**
No way for players to report "hole 7 is flooded" or "tree down on hole 12 fairway" other than posting on Facebook.

**14. Season Awards / End-of-Season**
No automated end-of-season summary: champion, most improved, best putter, most rounds played, sportsmanship award.

**15. Guest / Substitute Player Handling**
When a regular can't make it and brings a friend, there's no clean way to register a one-time guest who doesn't have an account.

### NICE TO HAVE — Things That Make It Special

**16. Live Scoring Feed**
During league play, a public scoreboard that updates as scores are submitted — displayed on a tablet at the clubhouse or shared via link.

**17. Photo Gallery Per Event**
Players take photos during rounds. No way to attach them to events or share them within the app.

**18. Sponsor Management**
Hole sponsors pay for signage. No way to track who sponsors what hole, how much they paid, when it expires.

**19. Multi-Course Support**
River Grove is home but the club sometimes plays other courses. The system should handle "away events" cleanly.

**20. Practice Round vs League Round Distinction**
Practice rounds and league rounds are distinguished by `is_practice` flag but the UX doesn't make this obvious enough when starting a round.

---

## Priority Matrix

```
                    HIGH IMPACT
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   1. Card/Groups  2. Tee Times   6. Recurring
   3. CTP Tracking  4. Ace Fund      Events
        │               │               │
LOW ────┼───────────────┼───────────────┼──── HIGH
EFFORT  │               │               │   EFFORT
        │               │               │
   5. DNF/Pickup  11. Handicap   7. Waitlist
   8. Messaging    Display       9. Volunteers
        │               │               │
        └───────────────┼───────────────┘
                        │
                    LOW IMPACT
```

### The "Build This Week" List

1. **Card assignments** (groups of 4) — This is the #1 time-waster on league day
2. **CTP tracking** — Money is involved, currently on Post-it notes
3. **Recurring events** — Club manager creates the same event every single week
4. **DNF/pickup scoring** — Every league has players who need this
5. **Ace fund balance** — Players always ask "how much is in the ace fund?"

### The "Build This Month" List

6. Shotgun start / tee time assignment
7. Waitlist with auto-promotion
8. Volunteer hour tracking
9. Targeted messaging by league/segment
10. Course condition reports

---

## The Honest Assessment

The platform is **remarkably complete for a v1**. 166 endpoints, 38 screens, full financial tracking, putting physics, blockchain tokens, AI chatbot, GIS mapping — this is more infrastructure than most disc golf clubs will ever need.

But the **day-to-day league operations** have gaps that matter every single Sunday. A club manager standing at hole 1 at 1:55pm needs to:

1. Know who's checked in (have it)
2. Assign them to cards of 4 (DON'T HAVE IT)
3. Tell each group their starting hole (DON'T HAVE IT)
4. Collect $5 from everyone (have it)
5. Collect $1 CTP (DON'T HAVE IT)
6. Run the round (have it)
7. Record CTP distances (DON'T HAVE IT)
8. Finalize results (have it)
9. Pay out prizes and CTP (have CTP gap)
10. Create next week's event (MANUAL EVERY WEEK)

Five of those ten steps have gaps. That's where the next sprint should focus.

The analytics, KSA intel, tow alerts, and community features are **strategic differentiators** — they're what make this app different from UDisc or PDGA. But the **tactical league operations** are what determine whether the club manager actually uses the app every Sunday or falls back to paper and texts.

**Build the Sunday operations first. The strategy follows.**

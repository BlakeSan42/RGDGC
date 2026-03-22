---
name: diagnose
description: Step-by-step investigation protocol for RGDGC issues
---

# RGDGC Diagnosis Protocol

## 7-Step Investigation

### 1. Do I know what this metric/feature measures?
- What table(s) does it come from?
- What calculations are involved?
- What are the edge cases (ties, DNF, drop-worst)?

### 2. What does the data say?
- Query the database or API directly
- Get actual numbers, not assumptions
- Compare to expected values

### 3. Where exactly is the problem?
- Is it in the data (DB), the logic (backend), or the display (frontend/bot)?
- Narrow down to a specific endpoint, query, or component

### 4. What are players experiencing?
- Check bot conversations for complaints
- Look at recent check-in/scoring patterns
- Any error responses in API logs?

### 5. Does the points system support this?
- Verify field_size → points mapping
- Check tie handling logic
- Confirm drop_worst is applied correctly

### 6. What's the fix across all systems?
- Backend: API endpoint or service logic change
- Frontend: Display or interaction fix
- Bot: Skill or response format update
- Database: Schema or data correction

### 7. Team-actionable output
- Write findings to signals/active_issues.json
- Propose specific code changes
- Include verification steps

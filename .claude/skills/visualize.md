---
name: visualize
description: Chart types and data source mappings for RGDGC analytics
---

# RGDGC Visualization Guide

## Chart Types → Data Sources

| Chart | Data Source | API Endpoint |
|-------|-----------|--------------|
| Season Standings Bar | League leaderboard | `GET /api/v1/leagues/{id}/leaderboard` |
| Points Over Time | Event results by date | `GET /api/v1/leagues/{id}/events` + results |
| Player Score Trend | Round history | `GET /api/v1/rounds?user_id={id}` |
| Event Participation | Event check-ins over time | `GET /api/v1/events` with player counts |
| Score Distribution | All round scores for a layout | `GET /api/v1/rounds?layout_id={id}` |
| Head-to-Head | Two players' results in shared events | Cross-query results table |
| Layout Difficulty | Average scores per layout | Aggregate from rounds table |
| Handicap Progression | Player handicap over time | Historical rounds + calculation |
| Prize Pool Growth | Accumulated entry fees | Events + entry_fee columns |
| Token Circulation (P1) | Blockchain transactions | `GET /api/v1/blockchain/transactions` |

## Rendering
- Use Chart.js 4.4.1 from cdnjs for React artifacts
- All charts must include `data_as_of` timestamp
- Mobile-first: charts must be readable on 375px width
- Use club colors: primary green (#2D5016), accent gold (#D4A017)

# RGDGC Port Architecture

## Production Preview (Blake's view)
| Port | Service | Start Command |
|------|---------|---------------|
| **9000** | Backend API | `./scripts/start-prod.sh` |
| **9001** | Mobile Web | `./scripts/start-prod.sh` |

**Only `start-prod.sh` uses these ports. This is what you demo and test on.**

## Development (Terminal sessions)
| Port | Service | Who |
|------|---------|-----|
| 8001 | Backend API (dev) | Any terminal doing backend work |
| 8082 | Mobile Web (dev) | Any terminal doing frontend work |
| 5173 | Admin Dashboard (dev) | Terminal working on admin |

## Infrastructure (Docker — always running)
| Port | Service |
|------|---------|
| 5433 | PostgreSQL |
| 6381 | Redis |

## MadWorld (separate project — do not touch)
| Port | Service |
|------|---------|
| 8000 | MW Agents Backend |
| 6379 | Redis (flood) |
| 6380 | MW Redis |

## Rules
1. **Never run dev servers on 9000/9001** — those are production preview only
2. **`start-prod.sh` kills anything on 9000/9001 before starting** — always clean
3. **Dev terminals use 8001/8082** — if they collide, that's fine, they share
4. **`verify.sh` checks production ports (9000/9001)** — not dev ports

#!/usr/bin/env bash
# Start RGDGC backend API on port 8001
# Requires: Docker running (PostgreSQL 5433, Redis 6381)

set -e
cd "$(dirname "$0")/../backend"

# Ensure Docker services are up
echo "Starting Docker services..."
docker compose -f ../docker-compose.yml up -d 2>/dev/null

# Wait for PostgreSQL
echo "Waiting for PostgreSQL (port 5433)..."
for i in {1..15}; do
  pg_isready -h localhost -p 5433 -U rgdgc -q 2>/dev/null && break
  sleep 1
done

# Activate venv
if [ -f venv/bin/activate ]; then
  source venv/bin/activate
elif [ -f .venv/bin/activate ]; then
  source .venv/bin/activate
else
  echo "ERROR: No Python venv found. Run: python3 -m venv venv && pip install -r requirements.txt"
  exit 1
fi

# Kill any existing backend on 8001
lsof -ti:8001 | xargs kill -9 2>/dev/null || true

echo "Starting backend on http://localhost:8001"
echo "Swagger docs: http://localhost:8001/docs"
exec uvicorn app.main:app --reload --port 8001

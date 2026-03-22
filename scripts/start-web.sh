#!/usr/bin/env bash
# Start RGDGC mobile app in web mode on port 8082

set -e
cd "$(dirname "$0")/../mobile"

# Kill any existing Expo on 8082
lsof -ti:8082 | xargs kill -9 2>/dev/null || true
sleep 1

# Clear stale Metro cache
rm -rf /tmp/metro-* /tmp/haste-* .expo node_modules/.cache 2>/dev/null

echo "Starting mobile web on http://localhost:8082"
exec npx expo start --web --port 8082 --clear

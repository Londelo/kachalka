#!/usr/bin/env bash
set -e

PORT="${PORT:-3111}"
export NODE_ENV="${NODE_ENV:-development}"
export DATABASE_PATH="${DATABASE_PATH:-$(pwd)/data/kachalka.db}"

mkdir -p "$(dirname "$DATABASE_PATH")"

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "Wiping test data..."
node scripts/cleanup-test-data.js

# Test data setup is handled within each test file

echo "Starting dev server on port $PORT..."
npx next dev -p "$PORT" &
SERVER_PID=$!

echo "Waiting for server on port $PORT..."
for i in $(seq 1 60); do
  STATUS="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT" 2>/dev/null || true)"
  if [ "$STATUS" = "200" ]; then
    echo "Server ready."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Timed out waiting for server (last HTTP status: ${STATUS:-none})."
    exit 1
  fi
  sleep 1
done

echo "Running Playwright tests..."
npx playwright test "$@"

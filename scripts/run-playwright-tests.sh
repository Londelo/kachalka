#!/usr/bin/env bash
set -e

PORT="${PORT:-3111}"
NODE_ENV="${NODE_ENV:-development}"

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
for i in $(seq 1 30); do
  if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
    echo "Server ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Timed out waiting for server."
    exit 1
  fi
  sleep 1
done

echo "Running Playwright tests..."
npx playwright test "$@"

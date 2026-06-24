#!/usr/bin/env bash
set -e

PORT="${PORT:-3000}"
export NODE_ENV="${NODE_ENV:-development}"

cleanup() {
  echo "Shutting down dev server..."
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Seeding database..."
node scripts/seed-bruno-data.js

echo "Starting dev server on port $PORT..."
npx next dev -p "$PORT" &
SERVER_PID=$!
wait "$SERVER_PID"

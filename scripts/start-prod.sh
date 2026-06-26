#!/usr/bin/env bash
set -e

DB_DIR="$HOME/.kachalka"
DB_FILE="$DB_DIR/prod.db"
export NODE_ENV="${NODE_ENV:-production}"
export DATABASE_PATH="$DB_FILE"
PORT="${PORT:-3016}"

# Ensure database directory exists
mkdir -p "$DB_DIR"

# Always rebuild to ensure fresh code and no stale caches
echo "Cleaning old build..."
rm -rf .next
echo "Building production bundle..."
npx next build

# Prevent sleep while server is running
echo "Preventing system sleep (caffeinate)..."
caffeinate -i &
CAFFEINATE_PID=$!

cleanup() {
  echo "Shutting down..."
  kill "$CAFFEINATE_PID" 2>/dev/null || true
  wait "$CAFFEINATE_PID" 2>/dev/null || true
  lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT INT TERM

# Start production server
echo "Starting production server on port $PORT..."
npx next start -H 127.0.0.1 -p "$PORT" &
SERVER_PID=$!
wait "$SERVER_PID"

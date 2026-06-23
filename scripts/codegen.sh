#!/usr/bin/env bash
# Playwright codegen script
# Starts the app on port 3111, launches codegen, then cleans up.
# Usage: ./scripts/codegen.sh [output-file]

set -e

PORT=3111
OUTPUT="${1:-tests/e2e/recorded.spec.ts}"
PID_FILE=$(mktemp)

cleanup() {
  echo "Shutting down dev server..."
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
  rm -f "$PID_FILE"
}
trap cleanup EXIT

# Start the app on port 3111
echo "Starting dev server on port $PORT..."
npx next dev -p "$PORT" &
PID=$!
echo "$PID" > "$PID_FILE"

# Wait for server to be ready
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

# Launch codegen
echo "Launching Playwright codegen..."
npx playwright codegen "http://localhost:$PORT"

# Clean up is handled by the trap
echo "Done. Interactions saved to $OUTPUT."

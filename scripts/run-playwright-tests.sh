#!/usr/bin/env bash
set -euo pipefail

CHECKOUT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENDPOINT_MODULE="$CHECKOUT_ROOT/tests/harness/e2e-endpoint.mjs"
READINESS_TIMEOUT_SECONDS=180
READINESS_POLL_INTERVAL_SECONDS=1
SHUTDOWN_TIMEOUT_SECONDS=15
SERVER_LOG_TAIL_LINES=40

export NODE_ENV="${NODE_ENV:-development}"
export DATABASE_PATH="${DATABASE_PATH:-$CHECKOUT_ROOT/data/kachalka.db}"

mkdir -p "$(dirname "$DATABASE_PATH")"

SERVER_PID=""
SERVER_LOG="$(mktemp "${TMPDIR:-/tmp}/kachalka-e2e-server.XXXXXX")"

die() {
  printf '%s\n' "$1" >&2
  exit 1
}

teardown() {
  if [ -z "$SERVER_PID" ]; then
    return 0
  fi

  kill -TERM -- "-$SERVER_PID" 2>/dev/null || true

  local deadline=$(( $(date +%s) + SHUTDOWN_TIMEOUT_SECONDS ))
  while kill -0 -- "-$SERVER_PID" 2>/dev/null; do
    if [ "$(date +%s)" -ge "$deadline" ]; then
      break
    fi
    sleep 1
  done

  kill -KILL -- "-$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  SERVER_PID=""
}

trap teardown EXIT
trap 'teardown; exit 130' INT
trap 'teardown; exit 143' TERM

if [ -n "${PORT:-}" ]; then
  RESOLVED_PORT="$PORT"
else
  RESOLVED_PORT="$(node "$ENDPOINT_MODULE" port "$CHECKOUT_ROOT")" ||
    die "Could not derive an end-to-end port from $ENDPOINT_MODULE."
fi

export PORT="$RESOLVED_PORT"
export E2E_BASE_URL="http://localhost:$PORT"

echo "Checking that port $PORT is free..."
node "$ENDPOINT_MODULE" guard "$PORT" "$$" ||
  die "Refusing to start a server: port $PORT is already held. The holder is named above."

echo "E2E endpoint: $E2E_BASE_URL"

echo "Wiping test data..."
node "$CHECKOUT_ROOT/scripts/cleanup-test-data.js"

echo "Starting dev server on port $PORT (log: $SERVER_LOG)..."
setsid --wait npx next dev -p "$PORT" >"$SERVER_LOG" 2>&1 </dev/null &
SERVER_PID=$!

echo "Waiting up to ${READINESS_TIMEOUT_SECONDS}s for a cold dev server compile on port $PORT..."
ready="no"
deadline=$(( $(date +%s) + READINESS_TIMEOUT_SECONDS ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    break
  fi

  status="$(curl -s -o /dev/null -w '%{http_code}' "$E2E_BASE_URL" 2>/dev/null || true)"
  if [ "$status" = "200" ]; then
    ready="yes"
    break
  fi

  sleep "$READINESS_POLL_INTERVAL_SECONDS"
done

if [ "$ready" != "yes" ]; then
  {
    echo "The dev server this run started (pid ${SERVER_PID:-none}) never answered $E2E_BASE_URL with HTTP 200"
    echo "within ${READINESS_TIMEOUT_SECONDS}s. Last HTTP status: ${status:-none}."
    echo "--- tail of the server log ($SERVER_LOG) ---"
    tail -n "$SERVER_LOG_TAIL_LINES" "$SERVER_LOG" 2>/dev/null || echo "(no server log was written)"
    echo "--- end of server log ---"
  } >&2
  exit 1
fi

echo "Proving the listener on port $PORT belongs to this run..."
node "$ENDPOINT_MODULE" guard "$PORT" "$SERVER_PID" ||
  die "Refusing to run the suite: the server answering on port $PORT is not the one this run started."

echo "Server ready."

echo "Running Playwright tests..."
set +e
npx playwright test "$@"
PLAYWRIGHT_STATUS=$?
set -e

exit "$PLAYWRIGHT_STATUS"

#!/usr/bin/env bash
set -euo pipefail

CHECKOUT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENDPOINT_MODULE="$CHECKOUT_ROOT/tests/harness/e2e-endpoint.mjs"
READINESS_TIMEOUT_SECONDS=180
READINESS_POLL_INTERVAL_SECONDS=1
READINESS_PATH="/"
READINESS_MARKER='id="user-selection-main"'
SHUTDOWN_TIMEOUT_SECONDS=15
SURVIVOR_GRACE_SECONDS=5
SERVER_LOG_TAIL_LINES=40

export NODE_ENV="${NODE_ENV:-development}"
export DATABASE_PATH="${DATABASE_PATH:-$CHECKOUT_ROOT/data/kachalka.db}"

mkdir -p "$(dirname "$DATABASE_PATH")"

SERVER_PID=""
TEARDOWN_STATUS=0
SERVER_LOG="$(mktemp "${TMPDIR:-/tmp}/kachalka-e2e-server.XXXXXX")"
READINESS_BODY="$(mktemp "${TMPDIR:-/tmp}/kachalka-e2e-readiness.XXXXXX")"

die() {
  printf '%s\n' "$1" >&2
  exit 1
}

live_group_members() {
  ps -eo pid=,pgid=,stat=,args= 2>/dev/null | awk -v group="$1" '$2 == group && $3 !~ /Z/' || true
}

teardown() {
  if [ -z "$SERVER_PID" ]; then
    return 0
  fi

  local server_pid="$SERVER_PID"
  SERVER_PID=""

  local term_status=0 kill_status=0 term_error="" kill_error=""
  term_error="$(kill -TERM -- "-$server_pid" 2>&1)" || term_status=$?

  local deadline=$(( $(date +%s) + SHUTDOWN_TIMEOUT_SECONDS ))
  while kill -0 -- "-$server_pid" 2>/dev/null; do
    if [ "$(date +%s)" -ge "$deadline" ]; then
      break
    fi
    sleep 1
  done

  kill_error="$(kill -KILL -- "-$server_pid" 2>&1)" || kill_status=$?

  local survivors grace
  grace=$(( $(date +%s) + SURVIVOR_GRACE_SECONDS ))
  survivors="$(live_group_members "$server_pid")"
  while [ -n "$survivors" ] && [ "$(date +%s)" -lt "$grace" ]; do
    sleep 1
    survivors="$(live_group_members "$server_pid")"
  done

  if [ -z "$survivors" ]; then
    wait "$server_pid" 2>/dev/null || true
    return 0
  fi

  {
    echo "Teardown failed: the server group this run started is still alive after SIGTERM and SIGKILL."
    echo "  pid:  $server_pid"
    echo "  pgid: $server_pid"
    echo "  kill -TERM status $term_status: ${term_error:-no diagnostic}"
    echo "  kill -KILL status $kill_status: ${kill_error:-no diagnostic}"
    echo "  surviving processes (pid pgid state command line):"
    printf '%s\n' "$survivors" | sed 's/^/    /'
  } >&2
  TEARDOWN_STATUS=1
}

finish() {
  local status="$1"
  teardown
  if [ "$TEARDOWN_STATUS" -ne 0 ]; then
    status="$TEARDOWN_STATUS"
  fi
  exit "$status"
}

trap 'finish "$?"' EXIT
trap 'finish 130' INT
trap 'finish 143' TERM

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

  status="$(curl -s -o "$READINESS_BODY" -w '%{http_code}' "$E2E_BASE_URL$READINESS_PATH" 2>/dev/null || true)"
  if [ "$status" = "200" ] && grep -qF "$READINESS_MARKER" "$READINESS_BODY" 2>/dev/null; then
    ready="yes"
    break
  fi

  sleep "$READINESS_POLL_INTERVAL_SECONDS"
done

if [ "$ready" != "yes" ]; then
  {
    echo "The dev server this run started (pid ${SERVER_PID:-none}) never answered GET $E2E_BASE_URL$READINESS_PATH"
    echo "with HTTP 200 carrying this app's own ${READINESS_MARKER} within ${READINESS_TIMEOUT_SECONDS}s."
    echo "Last HTTP status: ${status:-none}. The last answer is kept in $READINESS_BODY."
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

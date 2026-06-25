# Prod Setup — Local Server Script

## Goal

Add a `npm run prod` command that builds and runs Kachalka in production mode, bound to localhost. The database lives at `~/.kachalka/prod.db`. Uses `caffeinate` to keep the Mac awake.

## No seeding

**Production must never seed or wipe data.** The script does NOT call `seed-bruno-data.js` or any seed/seeders. The database is used as-is — it should already contain the production data. The layout only calls `runMigrations()`, which is idempotent (skips if tables exist).

## What changes

| File | Action | Description |
|------|--------|-------------|
| `scripts/start-prod.sh` | **Create** | Main entry script: env setup, build, caffeinate, server |
| `package.json` | **Edit** | Add `"prod": "bash scripts/start-prod.sh"` script |

## Script: `scripts/start-prod.sh`

```bash
#!/usr/bin/env bash
set -e

DB_DIR="$HOME/.kachalka"
DB_FILE="$DB_DIR/prod.db"
export NODE_ENV="${NODE_ENV:-production}"
export DATABASE_PATH="$DB_FILE"
PORT="${PORT:-3000}"

# Ensure database directory exists
mkdir -p "$DB_DIR"

# Build if not already built
if [ ! -d ".next" ]; then
  echo "Building production bundle..."
  npx next build
fi

# Prevent sleep while server is running
echo "Preventing system sleep (caffeinate)..."
caffeinate -i &
CAFFEINATE_PID=$!

cleanup() {
  echo "Shutting down..."
  kill "$CAFFEINATE_PID" 2>/dev/null || true
  wait "$CAFFEINATE_PID" 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT INT TERM

# Start production server
echo "Starting production server on port $PORT..."
npx next start -H 127.0.0.1 -p "$PORT" &
SERVER_PID=$!
wait "$SERVER_PID"
```

## Details

- **`set -e`** — exit on any error
- **`NODE_ENV=production`** — required by `validateEnv()`
- **`DATABASE_PATH=~/.kachalka/prod.db`** — database outside the project, survives project wipes
- **`mkdir -p`** — create the DB directory if it doesn't exist
- **Build check** — only runs `next build` if `.next` doesn't exist (avoids rebuilding on every start)
- **`caffeinate -i`** — prevents system sleep, runs in background, cleaned up on exit
- **`-H 127.0.0.1`** — localhost only (Wi-Fi devices cannot reach; change to `0.0.0.0` if needed)
- **Trap cleanup** — kills `caffeinate` on exit/interrupt/term
- **No seeding** — does NOT call `seed-bruno-data.js` or any seed script. Database is used as-is.

## Implementation order

1. Create `scripts/start-prod.sh`
2. Add `prod` script to `package.json`
3. Make the script executable (`chmod +x`)

# kachalka — Project Overview

## What is this?

A Next.js weightlifting workout tracker called **IRON COMMAND**. Users create accounts, build weekly exercise routines, log sets/reps/weight on scheduled days, and view progress charts.

## Tech Stack

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **Database:** better-sqlite3 (single-file SQLite) + Drizzle ORM
- **Styling:** Tailwind CSS with a military/tactical theme
- **Charts:** Recharts (bar charts for volume progression)
- **Testing:** Vitest
- **Fonts:** Epilogue, Space Grotesk, Inter, Material Symbols Outlined

## Directory Structure

```
kachalka/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (Header + NavWrapper)
│   │   ├── page.tsx                  # User selection page (login)
│   │   ├── (main)/                   # Authenticated route group
│   │   │   ├── today/page.tsx        # Today's workout — log sets
│   │   │   ├── plan/page.tsx         # My Battle Plan — assign exercises to days
│   │   │   ├── history/page.tsx      # War Logs — workout history
│   │   │   ├── progress/page.tsx     # Force Progression — volume charts
│   │   │   └── config/               # Empty (removed)
│   │   └── components/
│   │       ├── header.tsx            # Top nav bar
│   │       ├── bottom-nav.tsx        # Bottom tab bar
│   │       ├── nav-wrapper.client.tsx # Client-side nav wrapper
│   │       ├── user-selection.client.tsx # User picker with cookie set
│   │       └── add-exercise-button.tsx # Inline exercise add button
│   │
│   ├── config/
│   │   ├── db.ts                     # SQLite connection + Drizzle setup
│   │   └── env.ts                    # Env var validation
│   │
│   ├── db/
│   │   ├── schema.ts                 # Drizzle table definitions
│   │   ├── migrate.ts                # Migration runner
│   │   ├── seed.ts                   # Seed script
│   │   └── migrations/               # Drizzle migration SQL files
│   │
│   ├── features/                     # Deep feature modules (Clean Architecture)
│   │   ├── user/                     # User management
│   │   ├── exercise/                 # Exercise pool (create, rename, delete, list)
│   │   ├── routine/                  # Per-user exercise-to-day assignments
│   │   ├── workout/                  # Log workouts, history, volume calc
│   │   └── chart/                    # Progress chart data aggregation
│   │
│   ├── shared/
│   │   ├── errors/app-error.ts       # Base error type
│   │   ├── types/day-of-week.ts      # DayOfWeek type
│   │   └── utils/                    # Date helpers, volume calc
│   │
│   └── app/plan/plan-utils.ts        # Plan page utility functions
│
├── tests/                            # Vitest tests mirroring src/
├── data/kachalka.sqlite              # SQLite database file
├── plans/                            # Implementation plans
├── scripts/seed-bruno-data.js        # Seed script (runs on dev start)
└── drizzle.config.ts                 # Drizzle Kit config
```

## Database Schema

**users** — id, name (unique), email, created_at, is_active

**exercises** — id, name, user_id (owner), created_at, updated_at

**user_routines** — id, user_id, exercise_id, day_of_week (0=Sun..6=Sat), created_at
  - Unique constraint on (user_id, exercise_id, day_of_week)

**workout_logs** — id, user_id, exercise_id, date (YYYY-MM-DD), sets (JSON), created_at, updated_at

## Feature Architecture

Each feature follows Clean Architecture with inward dependency flow:

```
server-actions.ts (interface adapter — Next.js specific)
       ↓
use-cases/*.ts (business logic)
       ↓
*-repository.ts (interface — contracts only)
       ↓
*-entity.ts (domain types — zero dependencies)

*-repo-impl.ts (implementation — Drizzle + SQLite)
```

### Features

| Feature | Purpose |
|---------|---------|
| **user** | Create users, list users, select active user (stored in cookie `kachalka.userId`) |
| **exercise** | Shared global exercise pool. Owned by creator; only owner can rename/delete. Rename cascades to routines. |
| **routine** | Per-user exercise-to-day-of-week assignments. One exercise per day per user. |
| **workout** | Log sets (reps x weight), update/delete logs, get today's exercises, calculate volume, view history |
| **chart** | Aggregated volume data for Recharts bar charts. Supports 6M/1Y/ALL range and session/week/month granularity |

## User Flow

1. **Landing page** — Select or create a user account
2. **Today's Battle** — See exercises scheduled for today, log sets (auto-save with debounce)
3. **My Battle Plan** — Assign exercises to days of the week, create new exercises inline
4. **War Logs** — Browse workout history grouped by date, drill into exercise details
5. **Force Progression** — Volume bar chart filtered by exercise, time range, and granularity

## Key Implementation Details

- **User identity** stored in cookie `kachalka.userId` (set on user selection)
- **Auto-seed on dev start** — `scripts/seed-bruno-data.js` runs migrations, creates a "Bruno" user, and seeds Mon/Wed/Fri workout routines
- **Root layout** calls `runMigrations()` + `seedDatabase()` + `seedProgressData()` on every request (dev only)
- **Debounce auto-save** on Today page — 500ms debounce per exercise, filters empty sets (both weight and reps = 0)
- **Day mapping** — JS `getDay()` returns 0=Sun..6=Sat, app uses 0=Mon..6=Sun internally, conversion in `jsDayToAppIndex()`
- **crypto.randomUUID replaced** with `generateId()` using `crypto.getRandomValues()` for Edge Runtime compatibility

## Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | User Selection | Pick or create user, set cookie |
| `/today` | Today's Battle | Log today's workout, auto-save sets |
| `/plan` | My Battle Plan | Assign exercises to days, create exercises |
| `/history` | War Logs | Browse workout history |
| `/progress` | Force Progression | Volume charts with filters |

## Git History Highlights

- Initial architecture and roadmap planning (plan-0/)
- Feature branches: `feat/history`, `feat/progress`, `feat/polish`
- Merged PRs: `design-tune-up` (major UI overhaul), `remove-add-exercise-btn` (UX cleanup)
- Recent: crypto.randomUUID → generateId compatibility fix

## Testing

Vitest with jsdom environment. Tests mirror the src/ structure under tests/. Each feature has entity, repository impl, use case, and server action tests.

## Known Quirks

- Config page directory exists but is empty (page was removed)
- `data/kachalka.db-shm` and `data/kachalka.db-wal` are SQLite journal files (keep alongside `.sqlite`)
- No Docker/containerization — runs directly via `npm run dev`
- Seed script runs migrations + creates Bruno user on every `dev` start

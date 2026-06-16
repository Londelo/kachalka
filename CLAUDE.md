# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**kachalka** — A Next.js weightlifting workout tracker. Users create accounts, build weekly exercise routines, log sets/reps/weight on scheduled days, and view progress charts. Military/tactical themed UI (codename: IRON COMMAND).

## Commands

```bash
npm run dev          # Start dev server (auto-runs seed script: creates Bruno user + Mon/Wed/Fri routine + 7 months of workout data)
npm run build        # Production build
npm start            # Start production server
npm run seed         # Run seed script only (creates Bruno user + workout data)
npm run typecheck    # TypeScript type checking (tsc --noEmit)
npm test             # Run all tests (vitest run)
npm run test:watch   # Watch mode tests (vitest)
```

### Database / Migrations

```bash
npx drizzle-kit generate   # Generate migration SQL from schema changes
npx drizzle-kit push        # Push schema changes directly to DB
npx drizzle-kit migrate     # Run pending migrations
```

Schema lives in `src/db/schema.ts`, migrations in `src/db/migrations/`.

## Architecture

### Framework & Stack

- Next.js 15 App Router with React 19 + TypeScript (strict mode)
- better-sqlite3 (single-file SQLite) + Drizzle ORM
- Tailwind CSS, Recharts for charts, Ramda for data transformation
- Vitest (node environment, jsdom for DOM tests)

### Path Alias

`@/*` → `./src/*` (configured in tsconfig.json and vitest.config.ts alias)

### Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout — runs migrations + seed on every request
│   ├── page.tsx                  # Landing: user selection/login
│   ├── (main)/                   # Authenticated route group (requires active user cookie)
│   │   ├── today/page.tsx        # Today's workout — log sets with auto-save
│   │   ├── plan/page.tsx         # My Battle Plan — assign exercises to days
│   │   ├── history/page.tsx      # War Logs — workout history
│   │   └── progress/page.tsx     # Force Progression — volume charts
│   └── components/               # Shared UI components
│       ├── header.tsx
│       ├── bottom-nav.tsx
│       ├── nav-wrapper.client.tsx
│       ├── user-selection.client.tsx
│       └── add-exercise-button.tsx
├── config/
│   ├── db.ts                     # SQLite singleton (better-sqlite3 + Drizzle)
│   └── env.ts                    # Env var validation
├── db/
│   ├── schema.ts                 # Drizzle table definitions
│   ├── migrate.ts                # Migration runner
│   ├── seed.ts                   # Seed script
│   └── migrations/               # SQL migration files
├── features/                     # Clean Architecture feature modules
│   ├── user/                     # User management (CRUD, selection, cookie)
│   ├── exercise/                 # Exercise pool (create, rename, delete, list)
│   ├── routine/                  # Per-user exercise-to-day assignments
│   ├── workout/                  # Log workouts, history, volume calculation
│   └── chart/                    # Progress chart data aggregation
└── shared/
    ├── errors/app-error.ts       # Base error type
    ├── types/day-of-week.ts      # DayOfWeek type + conversion utilities
    └── utils/                    # Date helpers, volume calc
```

### Feature Module Pattern (Clean Architecture)

Each feature follows inward dependency flow:

```
server-actions.ts   →  interface adapter (Next.js-specific, handles try/catch, gets DB)
         ↓
use-cases/*.ts      →  business logic (pure functions, no framework deps)
         ↓
*-repository.ts     →  interface (contracts only, no implementation)
         ↓
*-entity.ts         →  domain types (zero dependencies, value objects)

*-repo-impl.ts      →  implementation (Drizzle + SQLite)
```

Every feature has these layers:
- **Entity** (`*-entity.ts`): Domain types with validation (e.g., `createUser()`, `ExerciseId.make()`). Uses value objects for IDs (e.g., `{ value: number }`) to prevent mixing up IDs.
- **Repository interface** (`*-repository.ts`): TypeScript interface defining data operations.
- **Repository impl** (`*-repo-impl.ts`): Concrete SQLite/Drizzle implementation. Factory function that takes a DB instance.
- **Use cases** (`*-use-case.ts`): Business logic functions that compose repository calls.
- **Server actions** (`*-server-actions.ts`): `@server` entry points that wire up DB → repo → use case.

### Database Schema

| Table | Key Fields | Notes |
|-------|-----------|-------|
| `users` | id, name (unique), email, is_active | User accounts |
| `exercises` | id, name, user_id (owner) | Shared global pool; owned by creator |
| `user_routines` | id, user_id, exercise_id, day_of_week | Per-user exercise scheduling; unique on (user_id, exercise_id, day_of_week) |
| `workout_logs` | id, user_id, exercise_id, date, sets (JSON) | Logged sets with reps/weight |

### Key Implementation Details

- **User identity**: Stored in cookie `kachalka.userId` (set via `user-selection.client.tsx`)
- **Auto-seed**: `scripts/seed-bruno-data.js` runs on every `dev` start — creates a "Bruno" user with Mon/Wed/Fri routine (barbell curls, pull-ups, squats) and 7 months of workout history
- **Root layout**: Calls `runMigrations()` + `seedDatabase()` + `seedProgressData()` on every request
- **Debounce auto-save**: Today page debounces by 500ms per exercise; filters empty sets (both weight and reps = 0)
- **Day mapping**: JS `getDay()` returns 0=Sun..6=Sat; app uses 0=Mon..6= internally via `dayOfWeekToNumber()`/`numberToDayOfWeek()` conversion
- **ID generation**: `crypto.randomUUID` was replaced with `generateId()` using `crypto.getRandomValues()` for Edge Runtime compatibility
- **Database singleton**: `getDatabase()` in `config/db.ts` returns a singleton SQLite instance with WAL mode and foreign keys enabled

### Testing

Tests mirror `src/` structure under `tests/`. Run with `npm test` (all) or `npm run test:watch` (watch mode). Vitest config in `vitest.config.ts` uses node environment with globals enabled and `@/*` alias.

### Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | User Selection | Pick or create user, sets cookie |
| `/today` | Today's Battle | Log today's workout, auto-save sets |
| `/plan` | My Battle Plan | Assign exercises to days, create exercises inline |
| `/history` | War Logs | Browse workout history |
| `/progress` | Force Progression | Volume bar charts with filters (6M/1Y/ALL, session/week/month) |

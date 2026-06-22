# kachalka — Project Overview

## What is this?

A Next.js weightlifting workout tracker called **Kachalka** (code name: **IRON COMMAND**). Users create accounts, build weekly exercise routines, log sets/reps/weight on scheduled days, and view progress charts. Military/tactical UI theme with neo-brutalism styling (hard shadows, sharp corners, no border-radius).

## Tech Stack

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **Database:** better-sqlite3 (single-file SQLite) + Drizzle ORM
- **Styling:** Tailwind CSS with neo-brutalism (hard shadows, sharp corners, military palette)
- **Charts:** Recharts (bar charts for volume progression)
- **Functional helpers:** Ramda — heavy use throughout (`R.map`, `R.filter`, `R.reduce`, `R.groupBy`, `R.flatten`, `R.concat`, `R.sum`, `R.toPairs`, `R.prop`, `R.cond`, `R.equals`, `R.isEmpty`)
- **Testing:** Vitest (unit + integration) + Playwright (E2E)
- **Fonts:** Epilogue (headings), Space Grotesk (labels), Inter (body), Material Symbols Outlined (icons)

## Directory Structure

```
kachalka/
├── src/
│   ├── app/                          # Next.js App Router (flat routes, no route groups)
│   │   ├── layout.tsx                # Root layout — runs migrations + seeds, wraps AppShell
│   │   ├── page.tsx                  # User selection page (login) — SSR, calls getUsersAction
│   │   ├── globals.css               # Tailwind directives + neo-brutalism CSS vars
│   │   ├── history/                  # War Logs
│   │   │   ├── page.tsx              # SSR shell (dynamic = 'force-dynamic')
│   │   │   └── HistoryPageClient.tsx # Client-side history viewer + detail modal + delete
│   │   ├── plan/
│   │   │   ├── page.tsx              # My Battle Plan — full client page
│   │   │   └── utils.ts              # Plan page helpers (day selection, assignment lookup)
│   │   ├── progress/page.tsx         # Force Progression — Recharts bar chart with filters
│   │   └── today/page.tsx            # Today's workout — log sets with auto-save + debounce
│   │
│   ├── components/                   # Shared UI components (moved out of app/)
│   │   ├── add-user-modal.tsx        # Modal for creating new users
│   │   ├── app-shell.client.tsx      # Shell: Header + SideDrawer + children
│   │   ├── header.tsx                # Top nav bar (title + account link + menu button)
│   │   ├── loading-context.tsx       # Loading state context (Set-based, multi-key)
│   │   ├── loading-provider.client.tsx  # Provider wrapper
│   │   ├── loading-screen.tsx        # Hourglass loading overlay
│   │   ├── side-drawer.tsx           # Slide-out navigation drawer (4 tabs)
│   │   └── user-selection.client.tsx  # User cards + cookie management
│   │
│   ├── config/
│   │   ├── db.ts                     # SQLite singleton + Drizzle instance (WAL + FK pragma)
│   │   └── env.ts                    # Env var validation (NODE_ENV, DATABASE_PATH)
│   │
│   ├── db/
│   │   ├── schema.ts                 # Drizzle table definitions (4 tables)
│   │   ├── migrate.ts                # Migration runner — checks required tables, runs all .sql files
│   │   ├── seed.ts                   # Bruno seed + progress data (runs on module load)
│   │   └── migrations/               # Drizzle migration SQL files
│   │       ├── 0000_square_shadowcat.sql
│   │       ├── 0001_init.sql          # Full schema with constraints
│   │       └── meta/                   # Drizzle Kit snapshots
│   │
│   ├── features/                     # Clean Architecture feature modules
│   │   ├── user/                     # User management (create, list, delete)
│   │   │   ├── user-entity.ts        # UserId value object + createUser (name validation)
│   │   │   ├── user-repository.ts    # Interface (findById, findByName, findAll, create, delete)
│   │   │   ├── user-repo-impl.ts     # SQLite implementation (Drizzle + Ramda mapping)
│   │   │   ├── create-user.ts        # Use case: validate + check duplicate + create
│   │   │   ├── get-users.ts          # Use case: return all users
│   │   │   └── user-server-actions.ts # createUserAction, getUsersAction, deleteUserAction
│   │   │
│   │   ├── exercise/                 # Shared global exercise pool
│   │   │   ├── exercise-entity.ts    # ExerciseId value object + createExercise (name + owner validation)
│   │   │   ├── exercise-repository.ts # Interface (findById, findByName, findAll, create, updateName, delete, findByOwner, inAnyRoutine)
│   │   │   ├── exercise-repo-impl.ts  # SQLite implementation
│   │   │   ├── create-exercise.ts    # Use case: validate + create
│   │   │   ├── list-exercises.ts     # Use case: return all exercises
│   │   │   ├── rename-exercise.ts    # Use case: ownership check + validate + update
│   │   │   ├── delete-exercise.ts    # Use case: ownership check + routine dependency check + delete
│   │   │   └── exercise-server-actions.ts # createExerciseAction, renameExerciseAction, deleteExerciseAction, listExercisesAction
│   │   │
│   │   ├── routine/                  # Per-user exercise-to-day assignments
│   │   │   ├── routine-entity.ts     # DayOfWeek type, RoutineId value object, createRoutineAssignment
│   │   │   ├── routine-repository.ts # Interface (findById, findByUserAndDay, findAllByUserGroupedByDay, create, delete, exists, exerciseExists)
│   │   │   ├── routine-repo-impl.ts  # SQLite implementation (groupByDay aggregation)
│   │   │   ├── assign-exercise.ts    # Use case: exercise exists? not-already-assigned? + create
│   │   │   ├── remove-exercise.ts    # Use case: ownership check + delete
│   │   │   ├── get-user-routine.ts   # Use case: return routine grouped by day
│   │   │   └── routine-server-actions.ts # assignExerciseAction, removeExerciseAction, getUserRoutineAction
│   │   │
│   │   ├── workout/                  # Log workouts, history, volume calc
│   │   │   ├── types.ts              # WorkoutSet {id, reps, weight}, WorkoutLog
│   │   │   ├── workout-entity.ts     # validateSet, calculateVolume, createEmptyLog
│   │   │   ├── workout-repository.ts # Interface (findById, findByDateAndExercise, findByDate, findAllByUser, create, update, delete, findByDayOfWeek, findLatestForExercise, findHistoryByDate)
│   │   │   ├── workout-repo-impl.ts  # SQLite implementation (Drizzle joins, JSON parsing, Drizzle unwrap)
│   │   │   ├── log-workout.ts        # Use case: upsert (create or update by date+exercise)
│   │   │   ├── update-workout.ts     # Use case: ownership check + update
│   │   │   ├── delete-workout.ts     # Use case: ownership check + delete
│   │   │   ├── get-today-exercises.ts # Use case: join routines + exercises + last workout log
│   │   │   ├── get-user-volume.ts    # Use case: sum all volumes
│   │   │   ├── get-workout-history.ts # Use case: return history grouped by date
│   │   │   └── workout-server-actions.ts # logWorkoutAction, updateWorkoutAction, deleteWorkoutAction, getTodayExercisesAction, getHistoryAction, deleteHistoryEntryAction
│   │   │
│   │   └── chart/                    # Progress chart data aggregation
│   │       ├── chart-entity.ts       # ChartDataPoint, ChartBarData, RangeFilter, TimeGranularity, IntensitySplit
│   │       ├── chart-repository.ts   # Interface (getVolumeByDate, getPeakVolume, getIntensitySplit, getExercisesWithLogs)
│   │       ├── chart-repo-impl.ts    # SQLite implementation (class-based, date filtering, granularity grouping)
│   │       ├── chart-service.ts      # Service layer (getExerciseProgress, getAllExercisesProgress, etc.)
│   │       ├── chart-utils.ts        # groupByGranularity, toISOWeekKey, toMonthKey
│   │       └── chart-server-actions.ts # getExerciseChartData, getAllExerciseChartData, getExercisesWithLogsAction, getPeakVolumeAction, getIntensitySplitAction
│   │
│   └── shared/
│       ├── errors/app-error.ts       # AppError class (message, status, cause, toJSON)
│       └── utils/
│           └── date.ts               # formatDate, getTodayISO, dayOfWeekToIndex, jsDayToAppIndex
│
├── tests/
│   ├── e2e/                          # Playwright E2E tests
│   │   ├── create-exercise.spec.ts   # Full create-exercise flow on plan page
│   │   └── helpers.ts                # loginAsBruno, logout helpers
│   └── unit/                         # Vitest unit + integration tests (mirrors src/ structure)
│       ├── app/
│       │   ├── components/           # Component tests
│       │   │   └── add-user-modal.test.tsx
│       │   └── plan/                 # Plan page helper tests
│       │       └── plan-utils.spec.ts
│       ├── config/                   # DB + env tests
│       │   ├── db.spec.ts
│       │   └── env.spec.ts
│       ├── db/                       # Schema + migration tests
│       │   ├── migrate.spec.ts
│       │   └── schema.spec.ts
│       ├── features/                 # Feature tests (entity, repo, use case, server action)
│       │   ├── chart/                # chart-entity, chart-repo-impl, chart-utils, range-filter, time-granularity
│       │   ├── exercise/             # entity, repo, use cases, server actions
│       │   ├── routine/              # entity, repo, use cases, server actions
│       │   ├── user/                 # entity, repo, use cases, server actions
│       │   └── workout/              # entity, repo, use cases, server actions
│       └── shared/
│           ├── errors/               # app-error tests
│           └── utils/                # date tests
│
├── data/                             # SQLite database files
│   └── kachalka.sqlite               # Main database (created by migrations)
│
├── scripts/
│   ├── seed-bruno-data.js            # Bruno seed script — creates user, exercises, 7 months of workout logs (Mon/Wed/Fri)
│   └── codegen.sh                    # Playwright codegen helper
│
├── plans/                            # Implementation plans
├── package.json
├── tsconfig.json                     # Strict TS, @/* path alias, esnext/bundler module resolution
├── tailwind.config.js                # Military palette, custom fonts, neo-brutalism spacing
├── vitest.config.ts                  # jsdom environment, @/* alias, setup: @testing-library/jest-dom/vitest
├── playwright.config.ts              # Chromium, port 3111, auto-seed + dev server
├── drizzle.config.ts                 # SQLite dialect, schema from src/db/schema.ts
└── next.config.ts                    # Empty (default config)
```

## Database Schema

All tables use `integer` primary keys with `autoIncrement`. Timestamps stored as Unix epoch seconds (`integer` with `mode: 'timestamp'`). The `sets` column in `workout_logs` stores JSON arrays.

| Table | Columns | Notes |
|-------|---------|-------|
| **users** | id, name (unique), created_at, is_active | name is globally unique; no email column (removed in later migration) |
| **exercises** | id, name, user_id (FK→users), created_at, updated_at | Owned by creator; only owner can rename/delete. Rename does NOT cascade to routines (exercise name is stored as string in UI, not linked) |
| **user_routines** | id, user_id (FK→users), exercise_id (FK→exercises), day_of_week, created_at | Unique constraint on (user_id, exercise_id, day_of_week). day_of_week is 0=Mon..6=Sun (app internal) |
| **workout_logs** | id, user_id (FK→users), exercise_id (FK→exercises), date (YYYY-MM-DD string), sets (JSON), created_at, updated_at | JSON sets = `[{ id, reps, weight }, ...]` |

## Feature Architecture

Each feature follows Clean Architecture with inward dependency flow:

```
server-actions.ts  (interface adapter — Next.js specific, 'use server')
       ↓
use-cases/*.ts    (business logic — factory functions returning { execute() })
       ↓
*-repository.ts   (interface — TypeScript interfaces, contracts only)
       ↓
*-entity.ts       (domain types — value objects + validation, zero dependencies)

*-repo-impl.ts    (implementation — Drizzle + SQLite, Ramda transformations)
```

### Feature Details

| Feature | Entity | Repository Interface | Use Cases | Server Actions |
|---------|--------|---------------------|-----------|----------------|
| **user** | `UserId` value object, `createUser()` validation | `findById`, `findByName`, `findAll`, `create`, `delete` | `createUserUseCase`, `getUsersUseCase` | `createUserAction`, `getUsersAction`, `deleteUserAction` |
| **exercise** | `ExerciseId` value object, `createExercise()` validation | `findById`, `findByName`, `findAll`, `create`, `updateName`, `delete`, `findByOwner`, `inAnyRoutine` | `createExerciseUseCase`, `listExercisesUseCase`, `renameExerciseUseCase`, `deleteExerciseUseCase` | `createExerciseAction`, `renameExerciseAction`, `deleteExerciseAction`, `listExercisesAction` |
| **routine** | `DayOfWeek` type, `RoutineId` value object, `createRoutineAssignment()` validation | `findById`, `findByUserAndDay`, `findByUserExerciseAndDay`, `findAllByUser`, `findAllByUserGroupedByDay`, `create`, `delete`, `exists`, `exerciseExists` | `assignExerciseUseCase`, `removeExerciseUseCase`, `getUserRoutineUseCase` | `assignExerciseAction`, `removeExerciseAction`, `getUserRoutineAction` |
| **workout** | `WorkoutSet` type, `WorkoutLog` type, `validateSet()`, `calculateVolume()`, `createEmptyLog()` | `findById`, `findByDateAndExercise`, `findByDate`, `findAllByUser`, `create`, `update`, `delete`, `findByDayOfWeek`, `findLatestForExercise`, `findHistoryByDate` | `logWorkoutUseCase` (upsert), `updateWorkoutUseCase`, `deleteWorkoutUseCase`, `getTodayExercisesUseCase`, `getUserVolumeUseCase`, `getWorkoutHistoryUseCase` | `logWorkoutAction`, `updateWorkoutAction`, `deleteWorkoutAction`, `getTodayExercisesAction`, `getHistoryAction`, `deleteHistoryEntryAction` |
| **chart** | `ChartDataPoint`, `ChartBarData`, `RangeFilter`, `TimeGranularity`, `IntensitySplit` | `getVolumeByDate`, `getPeakVolume`, `getIntensitySplit`, `getExercisesWithLogs` | N/A (class-based `ChartService`) | `getExerciseChartData`, `getAllExerciseChartData`, `getExercisesWithLogsAction`, `getPeakVolumeAction`, `getIntensitySplitAction` |

### Key Business Rules

- **User identity** stored in cookie `kachalka.userId` (set on user selection via client-side JS)
- **Exercise ownership** — exercises are owned by the user who creates them; only the owner can rename or delete
- **Exercise deletion guard** — cannot delete an exercise that is part of a routine
- **Routine assignment uniqueness** — one exercise per day per user (enforced by DB unique constraint)
- **Day mapping** — JS `getDay()` returns 0=Sun..6=Sat; app uses 0=Mon..6=Sun internally; conversion via `jsDayToAppIndex()`
- **Workout upsert** — `logWorkout` creates a new log or replaces sets if one already exists for that exercise/date
- **Empty set filtering** — auto-save filters out sets where both weight and reps are 0

## User Flow

1. **Landing page (`/`)** — Select or create a user account; cookie `kachalka.userId` set client-side; redirect to `/today`
2. **Today's Battle (`/today`)** — See exercises scheduled for today (based on day-of-week from routine), log sets per exercise; auto-save with 500ms debounce; toggle between current and past session view
3. **My Battle Plan (`/plan`)** — Select a day of the week, assign existing exercises or create new ones inline; remove exercises from days
4. **War Logs (`/history`)** — Browse workout history grouped by date, drill into exercise details (sets, volume, max weight); delete history entries
5. **Force Progression (`/progress`)** — Volume bar chart filtered by exercise, time range (6M/1Y/ALL), and granularity (session/week/month)

## Testing

### Unit/Integration Tests (Vitest)

**Config:** `vitest.config.ts` — jsdom environment, `@testing-library/jest-dom/vitest` setup, `@/*` alias, tests in `tests/unit/**/*.spec.ts` and `tests/unit/**/*.test.ts`.

**Coverage by layer:**

| Layer | Test files | What's tested |
|-------|-----------|---------------|
| **Entity** | `user-entity.spec.ts`, `exercise-entity.spec.ts`, `workout-entity.spec.ts`, `routine-entity.spec.ts`, `chart-entity.spec.ts` | Value object factories, validation rules, edge cases (negative, empty, boundary) |
| **Repository Impl** | `user-repo-impl.spec.ts`, `exercise-repo-impl.spec.ts`, `routine-repo-impl.spec.ts`, `workout-repo-impl.spec.ts`, `chart-repo-impl.spec.ts` | In-memory SQLite, real SQL, CRUD operations, data integrity |
| **Use Case** | `log-workout.spec.ts`, `create-exercise.spec.ts`, `assign-exercise.spec.ts`, `rename-exercise.spec.ts`, `delete-exercise.spec.ts`, `remove-exercise.spec.ts`, `get-users.spec.ts`, `get-user-routine.spec.ts`, `get-today-exercises.spec.ts`, `update-workout.spec.ts`, `delete-workout.spec.ts` | Business logic, mocked repositories, error propagation |
| **Server Actions** | `user-server-actions.spec.ts`, `exercise-server-actions.spec.ts`, `routine-server-actions.spec.ts`, `workout-server-actions.spec.ts` | Mocked DB/repos via `vi.mock()`, success/failure paths, error handling, dynamic `import()` |
| **Utilities** | `date.spec.ts`, `chart-utils.spec.ts`, `range-filter.spec.ts`, `time-granularity.spec.ts` | Pure function correctness |
| **Config** | `db.spec.ts`, `env.spec.ts`, `schema.spec.ts`, `migrate.spec.ts` | DB setup, env validation, schema structure, migration behavior |
| **Components** | `add-user-modal.test.tsx` | React component rendering, user interaction |

### Test Patterns

- **Entity tests:** `describe('EntityName', () => { describe('methodName', () => { it('...', ...) }) })` — nested describe blocks
- **Repo tests:** In-memory SQLite (`new Database(':in-memory:')`), run migrations manually, test real SQL operations
- **Use case tests:** Mock repository with `vi.fn()` via `makeRepo()` helper pattern, test business logic
- **Server action tests:** `vi.mock()` for all dependencies, dynamic `import()` for tested module, `vi.clearAllMocks()` in `beforeEach`
- **Component tests:** `@testing-library/react`, `@testing-library/jest-dom/vitest` setup

### E2E Tests (Playwright)

**Config:** `playwright.config.ts` — Chromium only, port 3111, auto-seed + dev server on test start (`npm run seed && npx next dev -p 3111`), screenshots on failure, traces on first retry.

**Test dir:** `tests/e2e/`

**Test file:** `tests/e2e/create-exercise.spec.ts` — Full user flow: login as Bruno → navigate to plan → select day → create exercise → verify assignment card appears.

**Helpers:** `tests/e2e/helpers.ts` — `loginAsBruno(page)` sets cookie, `logout(page)` clears cookies.

## Build & Run

```bash
npm run dev          # Start dev server (auto-runs migrations + seed)
npm run build        # Production build
npm start            # Start production server
npm run seed         # Run seed script (deletes DB, recreates Bruno data)
npm run typecheck    # TypeScript check
npm test             # Run all Vitest tests
npm run test:watch   # Watch mode
npm run test:e2e     # Run Playwright E2E tests
npm run test:e2e:headed    # E2E with visible browser
npm run test:e2e:ui        # E2E with Playwright UI
npm run test:e2e:codegen     # Playwright codegen
```

### Seed Data

- **`seedDatabase()`** (in `src/db/seed.ts`): Creates "Bruno" user, "Pull Up" exercise, Mon-Sun routine, 7 workout logs (Jan 2025)
- **`seedProgressData()`** (in `src/db/seed.ts`): Creates 6 exercises (Bench Press, Squat, Deadlift, Overhead Press, Barbell Row, Barbell Curl) + 6+ months of workout logs for progress chart testing
- **`scripts/seed-bruno-data.js`**: Full seed script — deletes DB, runs migrations, creates Bruno with 3 exercises (Barbell Curl, Pull-Up, Squat), Mon/Wed/Fri routines, ~7 months of workout logs. Used by E2E test startup.

### Dev Server Startup

The root layout (`src/app/layout.tsx`) calls `runMigrations()` + `seedDatabase()` + `seedProgressData()` on every request. This means:
- Migrations run on every request (idempotent — skips if tables exist)
- Bruno user + progress data seeded on every request (idempotent — skips if data exists)
- E2E tests use `scripts/seed-bruno-data.js` instead (full DB reset)

## Coding Style

### Naming Conventions

- **Files:** kebab-case (`user-server-actions.ts`, `day-of-week.ts`)
- **Functions:** camelCase (`createUser`, `getTodayExercisesAction`, `groupByGranularity`)
- **Types/Interfaces:** PascalCase (`WorkoutSet`, `WorkoutRepository`, `ChartDataPoint`)
- **Value objects:** `XxxId` with `Object.freeze({ make(n): { value: n } })` pattern
- **Server actions:** `XxxAction` suffix (`createUserAction`, `logWorkoutAction`)
- **Use cases:** `XxxUseCase` factory — `createXxxUseCase(repo)` returns `{ execute() }`
- **Data IDs:** Every interactive element has `data-id` or `id` attribute for testing/selectors

### Error Handling

- **`AppError`** class with `message`, `status`, `cause`, and `toJSON()` — but mostly plain `Error` strings are used directly
- **Server actions** use try/catch with `instanceof Error` check, return `{ success, data?, error? }` pattern
- **Use cases** throw errors; server actions catch and return failure response
- **No centralized error boundary** — errors surface to user via inline error messages in components

### Code Patterns

- **Factory functions for use cases:** `createXxxUseCase(repo)` returns `{ execute(...) }` — not classes
- **Value object pattern:** `UserId`, `ExerciseId`, `RoutineId` all use `Object.freeze({ make(n): { value: n } })`
- **Ramda everywhere:** Repo impls use `R.map`, `R.filter`, `R.reduce`, `R.groupBy` for data transformations
- **Drizzle unwrapping:** `workout-repo-impl.ts` has explicit unwrapping of Drizzle value objects (`{ value: ... }`) for serialization
- **JSON handling:** `workout-repo-impl.ts` handles both array and string formats for JSON columns (Drizzle JSON mode quirk)
- **`'use server'`** directive on all server action files
- **`useLoading()`** context pattern for loading state — `start(key)` / `end(key)` with Set-based tracking

### UI Patterns

- **Neo-brutalism:** `neo-shadow` (4px hard shadow), `active-press` (translate on :active), zero border-radius
- **Military palette:** `background: #fbfbe2` (cream), `primary: #a20000` (red), `on-surface: #1b1d0e` (dark)
- **Material Symbols:** `fontVariationSettings: 'FILL' 0` for outlined icons
- **CSS custom property:** `--header-height: 3.5rem`
- **Militaristic language:** "Today's Battle", "War Logs", "Force Progression", "Battle Plan", "Commander", "Assets", "Deploy"
- **Data attributes:** `data-id="exercise-card-${exercise.exerciseId}"`, `id="plan-page"`, etc. for testing/selectors

## Key Implementation Details

- **`'use server'`** directive on all server action files — no separate API routes
- **`crypto.getRandomValues()`** used instead of `crypto.randomUUID()` for Edge Runtime compatibility
- **WAL mode** enabled on SQLite (`journal_mode = WAL`) for concurrent read/write
- **Foreign keys** enabled (`foreign_keys = ON`)
- **DB singleton** pattern — single `Database` instance per process via `getDatabase()`
- **`@/*` path alias** maps to `./src/*` in both tsconfig and vitest config
- **`dynamic = 'force-dynamic'`** on pages that need per-request data (today, history)
- **`seed.ts` has top-level side effects** — `seedDatabase()` and `seedProgressData()` run on module load, not just when called

## Known Quirks

- **Users have no email** — the schema previously had an `email` column that was removed in migration 0001
- **Exercise rename does NOT cascade** to routine assignments (the old CLAUDE.md said it did, but the code shows rename only updates the exercises table)
- **`scripts/seed-bruno-data.js`** generates dates dynamically (last 7 months from a fixed date), not seeded statically

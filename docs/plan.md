# Lifting App — Implementation Plan

## Overview

A Next.js web app for tracking weightlifting workouts, backed by SQLite via `better-sqlite3`. Built using Clean Architecture principles organized as deep feature modules.

**Reference documents:**
- [Business Logic & UX Plan](lifting-app.md) — the "what"
- [Architecture Plan](lifting-app-architecture.md) — the "how"
- [Data Flow & Relationships](lifting-app-data-flow.md) — how data connects

---

## Roadmap

### Phase 0 — Scaffolding

Set up the project foundation.

**Files to create:**
- `package.json` with Next.js, Drizzle, better-sqlite3 dependencies
- `tsconfig.json` with path aliases and strict mode
- `next.config.ts`
- `src/app/layout.tsx` — root layout with nav bar shell
- `src/app/globals.css` — base styles
- `src/config/db.ts` — SQLite singleton with Drizzle initialization
- `src/config/env.ts` — environment variable validation
- `src/db/schema.ts` — Drizzle table definitions (users, exercises, user_routines, workout_logs)
- `src/db/migrate.ts` — migration runner for app startup
- `src/shared/errors/app-error.ts` — base error class
- `src/shared/utils/volume.ts` — volume calculation helper
- `src/shared/utils/date.ts` — date formatting helpers
- `src/shared/types/day-of-week.ts` — DayOfWeek type
- `.gitignore` (include `data/` directory)
- `data/` directory for the SQLite file

**Acceptance criteria:**
- `npm run dev` starts the app and shows a blank page
- SQLite database file is created on first request
- All 4 tables exist with correct schema

---

### Phase 1 — Users

User selection and creation. The foundation — every other feature is per-user.

**Files to create:**
- `src/features/user/user-entity.ts` — User type, UserId value object, name validation
- `src/features/user/user-repository.ts` — UserRepository interface
- `src/features/user/create-user.ts` — CreateUser use case
- `src/features/user/get-users.ts` — GetUsers use case
- `src/features/user/user-server-actions.ts` — Next.js server action wrappers
- `src/features/user/user-repo-impl.ts` — Drizzle + SQLite implementation
- `src/app/page.tsx` — User selection page (list of users + add new)

**Acceptance criteria:**
- Can create a new user from the selection page
- Can select an existing user and get redirected
- User names are validated (not empty, max 100 chars)
- Users are stored in SQLite and listed on reload

---

### Phase 2 — Exercises

Shared global exercise pool with ownership semantics.

**Files to create:**
- `src/features/exercise/exercise-entity.ts` — Exercise type
- `src/features/exercise/exercise-repository.ts` — ExerciseRepository interface
- `src/features/exercise/create-exercise.ts` — CreateExercise use case (with ownership)
- `src/features/exercise/rename-exercise.ts` — RenameExercise use case (owner-only)
- `src/features/exercise/delete-exercise.ts` — DeleteExercise use case (only if not in routines)
- `src/features/exercise/list-exercises.ts` — ListExercises use case
- `src/features/exercise/exercise-server-actions.ts` — Server action wrappers
- `src/features/exercise/exercise-repo-impl.ts` — SQLite implementation

**Acceptance criteria:**
- Users can create exercises (creator becomes owner)
- Only the owner can rename or delete their exercise
- Renaming cascades automatically (queries use exercise ID, not name)
- Can't delete an exercise that's in someone's routine

---

### Phase 3 — Routines

Per-user exercise-to-day assignments.

**Files to create:**
- `src/features/routine/routine-entity.ts` — RoutineAssignment type
- `src/features/routine/routine-repository.ts` — RoutineRepository interface
- `src/features/routine/assign-exercise.ts` — AssignExercise use case (no duplicates)
- `src/features/routine/remove-exercise.ts` — RemoveExercise use case
- `src/features/routine/get-user-routine.ts` — GetUserRoutine use case
- `src/features/routine/routine-server-actions.ts` — Server action wrappers
- `src/features/routine/routine-repo-impl.ts` — SQLite implementation
- `src/app/profile/page.tsx` — Routine setup page (days + exercise assignments)

**Acceptance criteria:**
- Users can assign exercises to days of the week
- Can't assign the same exercise twice on the same day
- Can remove exercises from days
- Routine is organized by day when fetched (matches UI shape)

---

### Phase 4 — Workout Logging

The core feature — log sets, reps, and weight for today's exercises.

**Files to create:**
- `src/features/workout/workout-entity.ts` — WorkoutLog, Set types, calculateVolume
- `src/features/workout/workout-repository.ts` — WorkoutRepository interface
- `src/features/workout/log-workout.ts` — LogWorkout use case
- `src/features/workout/update-workout.ts` — UpdateWorkout use case
- `src/features/workout/delete-workout.ts` — DeleteWorkout use case
- `src/features/workout/get-today-exercises.ts` — GetTodayExercises use case
- `src/features/workout/workout-server-actions.ts` — Server action wrappers
- `src/features/workout/workout-repo-impl.ts` — SQLite implementation
- `src/app/today/page.tsx` — Today's workout page (exercise cards + set logging modal)

**Acceptance criteria:**
- Today's page shows exercises scheduled for the current day
- Users can log sets (reps + weight) for each exercise
- Last session's numbers appear as placeholders
- Users can add/remove sets within a session
- Multiple sessions per day are supported
- Volume is calculated correctly: Σ(reps × weight)

---

### Phase 5 — History

View, edit, and delete past workout logs.

**Files to create:**
- `src/features/workout/get-workout-history.ts` — GetWorkoutHistory use case (update existing file)
- `src/features/workout/get-user-volume.ts` — GetUserVolume use case (update existing file)
- `src/app/history/page.tsx` — History page (scrollable, grouped by date)

**Acceptance criteria:**
- History shows past workouts grouped by date, newest first
- Each entry shows exercise name, number of sets, total volume
- Can click into an entry to see/set-level details
- Can edit or delete past entries

---

### Phase 6 — Progress Chart

Bar chart of volume over time per exercise.

**Files to create:**
- `src/features/chart/chart-entity.ts` — ChartDataPoint type
- `src/features/chart/chart-repository.ts` — ChartRepository interface
- `src/features/chart/chart-service.ts` — ChartService use case
- `src/features/chart/chart-server-actions.ts` — Server action wrappers
- `src/features/chart/chart-repo-impl.ts` — SQLite aggregation queries
- `src/app/progress/page.tsx` — Progress chart page (dropdown + bar chart)
- `src/app/config/page.tsx` — Config page (routine editor + delete account)

**Acceptance criteria:**
- User selects an exercise from a dropdown
- Bar chart shows volume over time (one bar per logged session)
- Hovering over a bar shows date, individual sets, total volume
- Shows "No data yet" when appropriate

---

## Implementation Order Summary

```
Phase 0 — Scaffolding          (project setup, DB, folder structure)
    ↓
Phase 1 — Users                (user selection, creation, auth shell)
    ↓
Phase 2 — Exercises            (exercise pool, ownership, CRUD)
    ↓
Phase 3 — Routines             (assign exercises to days)
    ↓
Phase 4 — Workout Logging      (log sets, today's page) ← core feature
    ↓
Phase 5 — History              (view/edit/delete past logs)
    ↓
Phase 6 — Progress Chart       (volume chart, config page)
```

Each phase builds on the previous one. No phase depends on anything after it.

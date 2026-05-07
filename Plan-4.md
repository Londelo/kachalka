# Plan-4 — Workout Logging

## WHAT

Build the core workout logging feature: users log sets (weight, reps, RPE, rest duration) for today's exercises. The `workout_logs` table already exists in the schema. This phase creates the workout feature module (entity, repository, use cases, server actions) and implements the Today's Workout page with set logging UI.

Files to change:
- [src/features/workout/workout-entity.ts](src/features/workout/workout-entity.ts)
- [src/features/workout/workout-repository.ts](src/features/workout/workout-repository.ts)
- [src/features/workout/workout-repo-impl.ts](src/features/workout/workout-repo-impl.ts)
- [src/features/workout/log-workout.ts](src/features/workout/log-workout.ts)
- [src/features/workout/update-workout.ts](src/features/workout/update-workout.ts)
- [src/features/workout/delete-workout.ts](src/features/workout/delete-workout.ts)
- [src/features/workout/get-today-exercises.ts](src/features/workout/get-today-exercises.ts)
- [src/features/workout/workout-server-actions.ts](src/features/workout/workout-server-actions.ts)
- [src/app/today/page.tsx](src/app/today/page.tsx)
- [tests/features/workout/workout-entity.spec.ts](tests/features/workout/workout-entity.spec.ts)
- [tests/features/workout/workout-repo-impl.spec.ts](tests/features/workout/workout-repo-impl.spec.ts)
- [tests/features/workout/log-workout.spec.ts](tests/features/workout/log-workout.spec.ts)
- [tests/features/workout/update-workout.spec.ts](tests/features/workout/update-workout.spec.ts)
- [tests/features/workout/delete-workout.spec.ts](tests/features/workout/delete-workout.spec.ts)
- [tests/features/workout/get-today-exercises.spec.ts](tests/features/workout/get-today-exercises.spec.ts)
- [tests/features/workout/workout-server-actions.spec.ts](tests/features/workout/workout-server-actions.spec.ts)

## HOW

### [src/features/workout/workout-entity.ts](src/features/workout/workout-entity.ts)

Set type factory
  • Validate weight is a positive number
  • Validate reps is a positive integer
  • Validate RPE is an integer 1-10
  • Validate rest is a non-negative number
  • Return { weight, reps, rpe, rest } object

createWorkoutLog(userId, exerciseId, date, sets)
  • Validate userId is a positive integer
  • Validate exerciseId is a positive integer
  • Validate date is a non-empty string
  • Validate sets is a non-empty array
  • Validate each set using set factory
  • Return { id, userId, exerciseId, date, sets, createdAt, updatedAt } object

calculateVolume(sets)
  • Sum reps * weight for all sets
  • Return total volume as number

### [src/features/workout/workout-repository.ts](src/features/workout/workout-repository.ts)

WorkoutRepository interface
  • findById(id: number): WorkoutLog | undefined
  • findByDateAndUser(date: string, userId: number): WorkoutLog[]
  • findByExerciseAndDate(exerciseId: number, date: string, userId: number): WorkoutLog | undefined
  • create(log: WorkoutLog): WorkoutLog
  • update(id: number, updates: Partial<WorkoutLog>): WorkoutLog
  • delete(id: number): void
  • findByDate(userId: string, date: string): WorkoutLog[]

### [src/features/workout/workout-repo-impl.ts](src/features/workout/workout-repo-impl.ts)

mapRowToWorkoutLog(row)
  • Map DB row to WorkoutLog entity type
  • Parse sets from JSON string to array
  • Use drizzle query builder

createSqliteWorkoutRepository(db)
  • Wrap drizzle queries in repository interface methods
  • findById: select from workout_logs where id = ?
  • findByDateAndUser: select where date = ? and userId = ?
  • findByExerciseAndDate: select where exerciseId = ? and date = ? and userId = ?
  • create: insert into workout_logs, return inserted row with sets serialized to JSON
  • update: update workout_logs where id = ?, serialize sets to JSON if present
  • delete: delete from workout_logs where id = ?
  • findByDate: select where userId = ? and date = ?

### [src/features/workout/log-workout.ts](src/features/workout/log-workout.ts)

LogWorkout use case
  • execute(userId, exerciseId, date, sets)
  • Check if a workout log already exists for this exercise and date
  • If exists: throw error (user should use UpdateWorkout instead)
  • If not: create WorkoutLog entity, call repo.create
  • Return created WorkoutLog

### [src/features/workout/update-workout.ts](src/features/workout/update-workout.ts)

UpdateWorkout use case
  • execute(logId, sets)
  • Find existing WorkoutLog by id
  • If not found: throw error
  • Append new sets to existing sets array (or replace — configurable)
  • Call repo.update with modified sets and updatedAt
  • Return updated WorkoutLog

### [src/features/workout/delete-workout.ts](src/features/workout/delete-workout.ts)

DeleteWorkout use case
  • execute(logId)
  • Find existing WorkoutLog by id
  • If not found: throw error
  • Call repo.delete
  • Return void

### [src/features/workout/get-today-exercises.ts](src/features/workout/get-today-exercises.ts)

GetTodayExercises use case
  • execute(userId, todayDate)
  • Get day of week from todayDate (0=Sunday, 1=Monday, etc.)
  • Query userRoutines for userId and dayOfWeek
  • Join with exercises to get exercise details
  • Query workout_logs for today's logged data
  • For each exercise: merge with existing workout log if present (for placeholder values)
  • Return array of { exercise, lastSession, hasLoggedToday } objects

### [src/features/workout/workout-server-actions.ts](src/features/workout/workout-server-actions.ts)

createServerActions()
  • Wrap all use cases in 'use server' action functions
  • logWorkoutAction(userId, exerciseId, sets): validate inputs, call LogWorkout, return success/error
  • updateWorkoutAction(logId, sets): validate inputs, call UpdateWorkout, return success/error
  • deleteWorkoutAction(logId): validate inputs, call DeleteWorkout, return success/error
  • getTodayExercisesAction(userId): call GetTodayExercises, return exercises with logged data

### [src/app/today/page.tsx](src/app/today/page.tsx)

TodayPage component
  • Get active user from session/context
  • Fetch today's exercises via getTodayExercisesAction
  • If no exercises: show "No workout scheduled. Set up your routine in Config."
  • If exercises exist: render exercise cards
    • Each card shows exercise name, category tags, placeholder values from last session
    • 4-column input grid: WEIGHT (KG), REPS, RPE, REST (S)
    • "LOG SET" CTA button
  • Set logging modal:
    • Opens when user clicks "LOG SET" or fills inputs and submits
    • Form fields: weight, reps, RPE (1-10), rest (seconds)
    • "Add Set" button to add multiple sets
    • "Submit Session" button to save all sets
    • Shows list of sets being added with ability to remove individual sets
    • Navigation between sets: left/right arrow buttons to review each set before confirming
  • Display previously logged sets below the form (read-only)
  • Update BottomNav activeTab to "WORKOUT"

### Test files

workout-entity.spec.ts
  • Happy path: valid set returns correct object
  • Edge case: negative weight rejected
  • Edge case: zero reps rejected
  • Edge case: RPE outside 1-10 rejected
  • Edge case: negative rest rejected
  • Happy path: valid workout log created
  • Happy path: calculateVolume sums correctly
  • Edge case: calculateVolume with empty array returns 0
  • Edge case: calculateVolume with mixed values

update-workout.spec.ts
  • Happy path: appends sets to existing log
  • Happy path: throws when log not found
  • Edge case: empty sets array rejected

delete-workout.spec.ts
  • Happy path: deletes existing log
  • Happy path: throws when log not found

get-today-exercises.spec.ts
  • Happy path: returns exercises for today's day of week
  • Happy path: returns empty array when no routine
  • Happy path: merges with logged workout data
  • Edge case: exercise not logged today shows hasLoggedToday=false

workout-server-actions.spec.ts
  • Happy path: logWorkoutAction returns success
  • Edge case: logWorkoutAction returns error for invalid sets
  • Happy path: getTodayExercisesAction returns exercises
  • Edge case: updateWorkoutAction returns error for missing log

## WHY

Without workout logging, the app is a routine planner with no way to record actual workouts. Phase 4 is the first feature that lets a user complete the loop: plan routine → do workout → log results. Everything after (history, progress charts) depends on having logged data.

## QUESTIONS

**For you to answer:**
  • Should update-workout replace all sets or append new ones? The roadmap says "add/remove sets within a session" — should we support both append and individual set removal in this phase?
  • The workout_logs table has a single `sets` JSON field. Should each exercise get one row per day (one log with multiple sets), or one row per set? The current schema supports one row per exercise per day with sets as an array.
  • Should the Today page support multiple sessions per day (e.g., "06:00 MORNING PUSH", "18:00 EVENING RECON")? The roadmap mentions session toggle pills but the schema has no session concept yet.

**You can ask me:**
  • "What should the set logging modal look like for mobile?"
  • "Should we show estimated 1RM on the Today page?"
  • "How should we handle exercises with no previous data (no placeholders)?"

## CRITIQUES

  • The workout_logs schema has no session concept — the roadmap mentions session toggle pills but there's no way to distinguish morning vs evening workouts. This will need a schema change in Phase 5.
  • The `date` field is a string, not a proper date type — this works for simplicity but could cause timezone issues.
  • No soft delete for workout logs — if a user accidentally deletes a session, it's gone forever. Consider soft delete later.
  • The get-today-exercises use case joins userRoutines with exercises — this requires a query pattern not used in other features. Need to ensure the repo implementation handles this correctly.
  • Volume calculation is trivial (Σ reps × weight) but the roadmap mentions intensity metrics (MAX, HIGH, PR labels) — those would need historical data, which doesn't exist until Phase 5.

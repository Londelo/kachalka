## WHAT

Build per-user exercise-to-day assignments (routines). Users assign exercises to specific days of the week, creating their weekly workout schedule. This enables the "Today's Workout" page to know which exercises to display each day.

Files to create:
- [src/features/routine/routine-entity.ts](src/features/routine/routine-entity.ts)
- [src/features/routine/routine-repository.ts](src/features/routine/routine-repository.ts)
- [src/features/routine/assign-exercise.ts](src/features/routine/assign-exercise.ts)
- [src/features/routine/remove-exercise.ts](src/features/routine/remove-exercise.ts)
- [src/features/routine/get-user-routine.ts](src/features/routine/get-user-routine.ts)
- [src/features/routine/routine-repo-impl.ts](src/features/routine/routine-repo-impl.ts)
- [src/features/routine/routine-server-actions.ts](src/features/routine/routine-server-actions.ts)
- [src/app/profile/page.tsx](src/app/profile/page.tsx)

## HOW

### [src/features/routine/routine-entity.ts](src/features/routine/routine-entity.ts)

RoutineAssignment type
  • userId: number (who owns the routine)
  • exerciseId: number (which exercise)
  • dayOfWeek: DayOfWeek enum value (Monday-Sunday)
  • createdAt: timestamp
  • id: number (primary key)

createRoutineAssignment(userId, exerciseId, dayOfWeek)
  • Validate userId is a positive integer
  • Validate exerciseId is a positive integer
  • Validate dayOfWeek is a known value (Monday-Sunday)
  • Return RoutineAssignment object with id=0 (not yet persisted)

DayOfWeek validation
  • Accept only: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
  • Case-insensitive matching
  • Throw on invalid day

### [src/features/routine/routine-repository.ts](src/features/routine/routine-repository.ts)

RoutineRepository interface
  • findById(id) — find by primary key
  • findByUserAndDay(userId, dayOfWeek) — find all assignments for a user on a specific day
  • findAllByUser(userId) — find all assignments for a user
  • findAllByUserGroupedByDay(userId) — find all assignments grouped by day of week, returning arrays keyed by day
  • create(assignment) — insert and return persisted assignment
  • delete(id) — remove an assignment
  • exists(userId, exerciseId, dayOfWeek) — check for duplicates (returns boolean)
  • exerciseExists(exerciseId) — verify exercise exists before assigning

### [src/features/routine/routine-repo-impl.ts](src/features/routine/routine-repo-impl.ts)

createSqliteRoutineRepository(db)
  • Map DB rows to RoutineAssignment objects
  • Use Drizzle ORM with schema.userRoutines table
  • Note: schema.userRoutines already has columns: id, user_id, exercise_id, day_of_week, created_at
  • day_of_week in DB is an integer (0-6 or 1-7) — need mapping to/from DayOfWeek enum

Map row to RoutineAssignment
  • Map DB day_of_week integer to DayOfWeek string
  • Use a helper: dayOfWeekNumberToString(num) — 0=Monday or Sunday? Need to decide convention
  • Convention: 0=Monday, 1=Tuesday, ..., 6=Sunday (ISO 8601 style)

createSqliteRoutineRepository(db)
  • findById: query by id
  • findByUserAndDay: query by userId + dayOfWeek string
  • findAllByUser: query by userId, ordered by day_of_week
  • findAllByUserGroupedByDay: query by userId, group results by day
  • create: insert row, map dayOfWeek string to integer, return persisted object
  • delete: delete by id
  • exists: count where userId + exerciseId + dayOfWeek, return boolean
  • exerciseExists: count where exerciseId in exercises table, return boolean

### [src/features/routine/assign-exercise.ts](src/features/routine/assign-exercise.ts)

AssignExercise use case
  • execute(userId, exerciseId, dayOfWeek)
  • Validate inputs via entity factory
  • Check exercise exists (call repo.exerciseExists)
  • Check no duplicate assignment exists (call repo.exists)
  • Create assignment via repo.create
  • Return assigned RoutineAssignment

### [src/features/routine/remove-exercise.ts](src/features/routine/remove-exercise.ts)

RemoveExercise use case
  • execute(assignmentId)
  • Validate assignmentId is a positive integer
  • Delete assignment via repo.delete
  • Return success or throw if not found

### [src/features/routine/get-user-routine.ts](src/features/routine/get-user-routine.ts)

GetUserRoutine use case
  • execute(userId)
  • Fetch all assignments for user grouped by day
  • For each assignment, join with exercise data to get exercise name
  • Return structured object: { Monday: [exercise1, exercise2], Tuesday: [...], ... }
  • Only include days that have exercises assigned
  • Return empty object if no assignments

### [src/features/routine/routine-server-actions.ts](src/features/routine/routine-server-actions.ts)

Server action wrappers
  • assignExerciseAction(userId, exerciseId, dayOfWeek) — return { success, assignment?, error? }
  • removeExerciseAction(assignmentId) — return { success, error? }
  • getUserRoutineAction(userId) — return { success, routine?, error? }
  • Follow same pattern as exercise-server-actions.ts: try/catch, repo+useCase construction per call

### [src/app/profile/page.tsx](src/app/profile/page.tsx)

Routine setup page (PROFILE page)
  • Hero header: "PROFILE" with subtitle
  • Day-of-week selector: 7 pill badges (MON-SUN), clickable to add exercises
  • For each day: list of assigned exercises with remove button
  • Exercise assignment dropdown: shows all user's exercises, neo-brutalist styled
  • "ADD EXERCISE" CTA button per day
  • Empty state: "NO EXERCISES ASSIGNED" with instructional text
  • Follow neo-brutalist design system: thick borders, hard shadows, no border-radius
  • Active press effects on interactive elements
  • Bottom nav with PROFILE pill highlighted

## WHY

Phase 2 gave us exercises but no way to organize them into a weekly schedule. Phase 3 connects exercises to specific days, enabling the "Today's Workout" page (Phase 4) to know what exercises to display. Without routines, the app has exercises but no structure — users can't actually plan their training.

## QUESTIONS

**For you to answer:**
  • Should day_of_week use 0-indexed (0=Monday) or 1-indexed (1=Monday) convention in the DB? The existing schema uses `integer('day_of_week')` — need to pick a convention and be consistent.
  • Should the profile page be accessible from the bottom nav as a new tab, or reuse an existing nav slot? Currently the bottom nav has WORKOUT, HISTORY, PROGRESS, CONFIG.
  • Should exercise assignment be restricted to exercises owned by the current user, or allow exercises from other users too?
  • Should we support multiple sessions per day (e.g., morning and evening routines) like the workout logging feature?

**You can ask me:**
  • "Should the profile page include routine editing or just viewing?"
  • "How should we handle exercises that get deleted — cascade delete routine assignments?"
  • "Should we add drag-and-drop reordering for exercises within a day?"

## CRITIQUES

  • The existing `user_routines` table name is misleading — it implies "user routines" (plural, like a full weekly plan) but it actually stores individual exercise-to-day assignments. Consider renaming the table to `routine_assignments` — but this requires a migration.
  • The `findAllByUserGroupedByDay` return shape needs careful typing — days with no exercises should be excluded, but the type should make that clear.
  • Server actions reconstruct repo+useCase on every call — this is consistent with existing patterns but not optimal. Could be abstracted into a shared helper.
  • The profile page mock doesn't exist in docs/mocks/ — we'll need to follow the established design system without a visual reference, which increases risk of visual mismatch.
  • No validation that the exercise belongs to the user being assigned — should we enforce ownership or allow cross-user exercises?

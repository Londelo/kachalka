# Plan: Pre-fill Today's current session from database on page refresh

## Context

When the user adds/edits sets on the Today's page and saves, the data is correctly written to the database. However, after a page refresh the saved data disappears from the UI — the page shows empty inputs in the "CURRENT SESSION" view.

**Root cause:** `getTodayExercisesAction` returns `lastLog` (the most recent log by any date) which is only rendered in the read-only "PAST SESSION" view. The "CURRENT SESSION" view is initialized from an empty `exerciseSets` Map (`[defaultSet()]` — empty inputs). There is no mechanism to populate the current view with today's actual workout data.

## Changes

### 1. Add `getTodayWorkoutsAction` server action

**File:** `src/features/workout/workout-server-actions.ts`

Add a new server action that returns today's workout data grouped by exercise:

```ts
export async function getTodayWorkoutsAction(
  userId: number,
): Promise<{ success: boolean; workouts?: TodayWorkouts | null; error?: string }> {
  try {
    const db = getDatabase()
    const repo = createSqliteWorkoutRepository(db)
    const today = new Date().toISOString().split('T')[0]
    const logs = repo.findByDate(userId, today)
    const workouts: TodayWorkouts = {}
    for (const log of logs) {
      workouts[log.exerciseId] = log.sets.map(s => ({ weight: s.weight, reps: s.reps }))
    }
    return { success: true, workouts }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message, workouts: null }
  }
}
```

Uses the existing `workoutRepo.findByDate()` — no new repo method needed.

### 2. Pre-fill current session in the client

**File:** `src/app/today/TodaysPageClient.tsx`

After loading exercises in the existing `useEffect`, call `getTodayWorkoutsAction` to initialize the `exerciseSets` and `viewModes` Maps:

```ts
// Inside existing useEffect, after setExercises(res.exercises):
if (res.success && res.exercises) {
  setExercises(res.exercises)

  // Pre-fill current session from today's saved data
  getTodayWorkoutsAction(userId).then((workoutsRes) => {
    if (workoutsRes.success && workoutsRes.workouts) {
      const nextSets = new Map<number, WorkoutSet[]>()
      const nextModes = new Map<number, ViewMode>()
      for (const exercise of res.exercises) {
        const sets = workoutsRes.workouts[exercise.exerciseId]
        if (sets) {
          nextSets.set(exercise.exerciseId, sets)
        }
        nextModes.set(exercise.exerciseId, 'current')
      }
      setExerciseSets(nextSets)
      setViewModes(nextModes)
    } else {
      // No workouts today — set view modes to 'current'
      const nextModes = new Map<number, ViewMode>()
      for (const exercise of res.exercises) {
        nextModes.set(exercise.exerciseId, 'current')
      }
      setViewModes(nextModes)
    }
  })
}
```

Also need to add `getTodayWorkoutsAction` to the import from `workout-server-actions`.

### 3. Add server action test

**File:** `tests/unit/features/workout/workout-server-actions.spec.ts`

Add a `describe('getTodayWorkoutsAction', ...)` block following the existing test patterns:
- Mock `mockWorkoutRepo.findByDate` to return logs
- Test success path returns correct workout map
- Test empty path (no workouts today)
- Test failure path

Also add `getTodayWorkouts` to the mock schema in the test file.

## Verification

1. Run `npm run typecheck` — no TypeScript errors
2. Run `npm test` — all existing tests pass, new test passes
3. Manual test: add sets on Today's page → refresh → verify sets appear in "CURRENT SESSION" view
4. Manual test: add sets → switch to "PAST SESSION" → verify it shows previous session (not today's)
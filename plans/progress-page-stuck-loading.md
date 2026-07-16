# Fix: Progress Page Stuck on Loading Screen

## Problem

The progress page (`/progress`) would display the full-screen LoadingScreen overlay indefinitely, preventing the user from seeing the chart or any page content.

## Root Cause

The progress page's `useEffect` calls server actions (`getAllExerciseChartData`, `getExerciseChartData`, `getExercisesWithLogsAction`) without any error handling. The global loading overlay is controlled by `LoadingContext` — each page registers `'progress'` via `start('progress')` and unregisters via `end('progress')`.

If any server action throws (network error, timeout, serialization error, database error), the Promise rejects before `end('progress')` is reached. The `pages` Set in the context retains the `'progress'` key, so `loading` stays `true` forever. The `LoadingScreen` component checks `pages.size > 0` and never hides.

The cleanup function (`return () => { end('progress') }`) only fires on unmount, not on error. So navigating away and back would also leave the loading key active on the new page.

## Secondary Root Cause (Production Crash)

In production, the server action `getAllExerciseChartData` throws `TypeError: b.reduce is not a function` before it can even reach the `try/catch` in the component. This causes the same stuck-loading-screen symptom.

The crash originates in `mapRowToDataPoint` inside `src/features/chart/chart-repo-impl.ts`:

```typescript
const sets = row.sets as WorkoutSet[]
...
volume: sets.reduce((t, s) => t + s.reps * s.weight, 0),
```

In production, Drizzle returns JSON columns from `.select()` queries as `{ value: WorkoutSet[] }` wrapper objects — not plain arrays. The cast `row.sets as WorkoutSet[]` does not unwrap the object; it only silences the TypeScript compiler. At runtime, `sets` is still an object, so `.reduce()` throws.

The workout repo (`workout-repo-impl.ts`) already handles this pattern in `findHistoryByDate` — it checks `if (typeof setsValue === 'object' && setsValue !== null && 'value' in setsValue)` and extracts the `.value` property. The chart repo's `mapRowToDataPoint` does not.

## Fix

**`src/app/progress/page.tsx`** — Two `useEffect` blocks updated:

### 1. Chart data loading effect

- Wrapped server action calls in `try/catch/finally`. The `finally` block guarantees `end('progress')` is always called, regardless of success or failure.
- Added a `cancelled` flag (set to `true` in the cleanup function) to guard all state updates after unmount, preventing React warnings and race conditions when the effect re-runs.
- Added `start` and `end` to the dependency array to satisfy ESLint's exhaustive-deps rule.

### 2. Exercises loading effect

- Added `try/catch` around `getExercisesWithLogsAction` to prevent unhandled promise rejections.
- Added the same `cancelled` flag pattern to prevent state updates on an unmounted component.

### 3. Chart repo JSON column unwrapping (`src/features/chart/chart-repo-impl.ts`)

- Updated `mapRowToDataPoint` to unwrap Drizzle `{ value: ... }` wrapper objects from JSON columns, matching the pattern already used in `workout-repo-impl.ts`.
- Also unwraps `date` and `exerciseName` in case Drizzle wraps those fields too (defensive, consistent with the rest of the codebase).

## Key Takeaway

Any page that manages a global loading state via `useLoading()` must ensure `end(key)` is called in all code paths — success, error, and cleanup. A `try/catch/finally` pattern with a `cancelled` guard is the reliable approach for async effects.
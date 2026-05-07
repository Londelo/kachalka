# Phase 2 — Exercises: Implementation Plan

## Overview

Build the shared global exercise pool with ownership semantics. Users can create exercises (becoming owner), rename/delete their own, and list all exercises. Exercise cannot be deleted if referenced in any routine.

## Files to Create

### Entity Layer
- `src/features/exercise/exercise-entity.ts` — Exercise type, ExerciseId value object, name validation

### Repository Interface
- `src/features/exercise/exercise-repository.ts` — ExerciseRepository interface

### Use Cases
- `src/features/exercise/create-exercise.ts` — CreateExercise (with ownership)
- `src/features/exercise/rename-exercise.ts` — RenameExercise (owner-only)
- `src/features/exercise/delete-exercise.ts` — DeleteExercise (only if not in any routine)
- `src/features/exercise/list-exercises.ts` — ListExercises (all exercises, visible to everyone)

### Server Actions
- `src/features/exercise/exercise-server-actions.ts` — Server action wrappers for all use cases

### Repository Implementation
- `src/features/exercise/exercise-repo-impl.ts` — SQLite implementation using Drizzle

### Tests (mirroring src pattern)
- `tests/features/exercise/exercise-entity.spec.ts`
- `tests/features/exercise/create-exercise.spec.ts`
- `tests/features/exercise/rename-exercise.spec.ts`
- `tests/features/exercise/delete-exercise.spec.ts`
- `tests/features/exercise/list-exercises.spec.ts`
- `tests/features/exercise/exercise-repo-impl.spec.ts`
- `tests/features/exercise/exercise-server-actions.spec.ts`

## Design Notes

- No dedicated mock page exists for exercise creation (empty todaysworkout.html)
- Use the established neo-brutalist design system from Phase 1
- Exercise cards will be rendered on the Today's Workout page (Phase 4) and Config page (Phase 3)
- For now, focus on backend logic — the server actions are the interface
- A minimal exercise creation UI can be added to the user selection page or a simple exercise management page

## Acceptance Criteria

1. Users can create exercises (creator becomes owner)
2. Only the owner can rename or delete their exercise
3. Renaming cascades automatically (queries use exercise ID, not name)
4. Can't delete an exercise that's in someone's routine
5. All exercises listed globally (visible to all users)

## Database Schema

The `exercises` table already exists in `src/db/schema.ts`:
```
exercises: id, name, user_id (FK→users), created_at, updated_at
```

Note: The architecture doc uses `created_by` but the current schema uses `user_id`. The engineer should align with the existing schema.

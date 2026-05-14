# Plan 9 — Remove Add Exercise Button from User Selection Page

## WHAT

Remove the `AddExerciseButton` from the user selection page (`/`). Users shouldn't be able to add exercises before selecting a commander — it creates confusion since exercise assignment requires a user context.

**Current state:** The user selection page imports and renders `AddExerciseButton` in the header area (line 36).

**Target state:** The button is gone. No import, no render.

## HOW

### src/app/components/user-selection.client.tsx

- Remove the `AddExerciseButton` import (line 5)
- Remove the `<AddExerciseButton />` render (line 36)

## FILES TO CHANGE

- `src/app/components/user-selection.client.tsx`

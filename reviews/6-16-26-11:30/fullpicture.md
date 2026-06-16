# Full Picture: feat/add-user-button

## System Overview

This branch touches two distinct subsystems:

1. **User creation on the login page** — Adds an inline modal for creating new users without navigating away from the user selection screen.
2. **Email field removal from users schema** — Removes the `email` column from the `users` table across all migrations, schema definitions, seed scripts, and tests.
3. **Plan page exercise flow** — Introduces a dual-mode modal (select existing vs create new exercise) on the plan page, while leaving the existing `AddExerciseButton` component in place.

## Flow 1: User Creation

### Entry Point

**`src/app/page.tsx#L5`** — The landing page is a server component that calls `getUsersAction()` to fetch existing users, then passes them to `UserSelectionClient`.

### Flow

```
User clicks "+" button on login page
    |
    v
AddUserModal opens (state: open=true)
    |
    v
User types name, clicks "ADD COMMANDER" or submits form
    |
    v
handleCreate() in add-user-modal.tsx#L16
    |-- Validates name is not empty (client-side)
    |-- Calls createUserAction(name) [server action]
    |       |
    |       v
    |   createUserAction() in user-server-actions.ts#L9
    |       |-- Validates name is non-empty string
    |       |-- getDatabase() -> creates Drizzle instance
    |       |-- createSqliteUserRepository(db)
    |       |-- createUserUseCase(repo)
    |       |       |
    |       |       v
    |       |   execute(name)
    |       |       |-- createUser(name) [entity validation]
    |       |       |       |-- Trims name
    |       |       |       |-- Validates length > 0 and <= 100
    |       |       |       |-- Returns { id: { value: 0 }, name }
    |       |       |-- repo.findByName(trimmedName)
    |       |       |       |-- Drizzle query: SELECT * FROM users WHERE name = ?
    |       |       |       |-- Throws "User already exists" if found
    |       |       |-- repo.create(validated)
    |       |               |-- Drizzle INSERT INTO users (name) VALUES (?)
    |       |               |-- Returns { id, name } with real DB id
    |       |-- Returns { success: true, user }
    |
    v
Modal closes, onCreated() callback fires
    |
    v
handleCreated() in user-selection.client.tsx#L24
    |-- Calls getUsersAction() to refresh list
    |-- setUsers(freshUsers)
```

### Input Shape

- **name**: `string` — any string, trimmed client-side, validated server-side (non-empty, <= 100 chars)
- No additional fields (email was removed)

### Output Shape

- On success: `{ success: true, user: { id: { value: number }, name: string } }`
- On failure: `{ success: false, error: string }`

### External Dependencies

- **SQLite** (via better-sqlite3 + Drizzle ORM) — reads users table, inserts new user
- **Unique constraint** on `users.name` — prevents duplicate names at DB level

### Exit Point

**`src/features/user/user-repo-impl.ts#L55-66`** — The `create()` method inserts the user and returns the persisted object with the auto-generated ID.

### Notable Observations

- The entity `createUser()` returns a placeholder ID (`{ value: 0 }`) — the real ID is only assigned after DB insert in the repository layer. This is intentional: the entity is for validation, not persistence.
- The server action wraps the use case in try/catch, converting exceptions to `{ success: false, error }`. The "User already exists" error from the use case is caught and returned as a user-friendly message.
- The modal uses a simple overlay pattern (not a library) with `z-[60]` and `bg-black/50`. Click outside closes. Click on the card body does nothing (stopPropagation).
- After successful creation, the modal calls `onCreated()` which triggers a full user list refresh via `getUsersAction()`.

## Flow 2: Email Removal

### What Changed

1. **Schema** (`src/db/schema.ts#L8-13`): The `users` table definition no longer includes an `email` column. The table now has: `id`, `name`, `createdAt`, `isActive`.
2. **Migration 0001** (`src/db/migrations/0001_init.sql`): Creates all tables from scratch without `email`. Uses the `createTable` pattern (rename from `__new_*`).
3. **Migration 0002** (`src/db/migrations/0002_left_mariko_yashida.sql`): Identical to 0001 — this is a redundant migration. Both migrations recreate all tables with the same schema.
4. **Seed** (`src/db/seed.ts#L29-31`): The `INSERT INTO users (name) VALUES (?)` statement no longer includes email.
5. **Tests**: `tests/db/schema.spec.ts` — removed `users.email` assertions. `tests/features/user/user-repo-impl.spec.ts` — updated to not expect email.

### Migration Chain

```
0000_square_shadowcat (main branch) — original schema with email
    |
    v
0001_init — full table rebuild without email (rename pattern)
    |
    v
0002_left_mariko_yashida — identical to 0001 (redundant)
```

### Notable Observations

- The migrations use the Drizzle `createTable` rename pattern (`__new_*` tables), which is the standard Drizzle approach for schema changes.
- Migration 0002 is identical to 0001. This appears to be a duplicate — either a re-generation of the same migration or a second attempt at the same change. This is wasteful but not harmful (it will run as a no-op since the tables already exist with the correct schema).
- The `email` column was never referenced in any application code paths (server actions, use cases, repositories) — only in the schema definition and tests. This is why the removal is clean.
- The seed script's inline table creation in tests uses `strftime('%s', 'now')` for timestamps, while the schema uses ISO string defaults. This inconsistency exists in test setup but not in production migrations.

## Flow 3: Plan Page Exercise Assignment

### Entry Point

**`src/app/(main)/plan/page.tsx#L30`** — The plan page is a client component that loads routine data and exercise list on mount.

### Flow

```
PlanPage mounts
    |
    v
useEffect -> loadData()
    |-- getUserRoutineAction(userId) — fetches user's exercise-to-day assignments
    |-- listExercisesAction() — fetches all exercises
    |-- Sets state: routine, exercises, loading
    |
    v
User clicks a day button (handleDayClick)
    |-- resolveDaySelection() — determines if day is selected for assignment
    |-- Sets selectedDay, addingDay
    |
    v
If day is selected AND has assignments:
    |-- Shows assignment cards with remove buttons
    |-- Renders AddExerciseButton (ISSUE: redundant component)
    |
    v
User clicks "ADD EXERCISE" toggle button
    |-- toggleModalMode() — toggles between 'select' and 'new' modes
    |-- setShowModal(true) — opens integrated modal
    |
    v
Modal renders in select mode:
    |-- Dropdown of available exercises (excluding already-assigned)
    |-- "ASSIGN" button calls handleModalAddExercise()
    |       |-- assignExerciseAction(userId, exerciseId, day)
    |       |-- loadData() to refresh
    |
    v
User clicks "SELECT EXERCISE" toggle button (switches to new mode):
    |-- Text input for exercise name
    |-- "ADD" button calls handleCreateExercise()
    |       |-- createExerciseAction(name, userId)
    |       |-- If success, auto-assigns to selected day
    |       |       |-- assignExerciseAction(userId, exerciseId, day)
    |       |-- loadData() to refresh
```

### Notable Observations

- The `availableExercises` useMemo filters out exercises already assigned to the selected day (line 94-96). This prevents duplicate assignments.
- The modal has two modes: 'select' (choose from existing) and 'new' (create new, auto-assign). The toggle button between modes is at lines 307-321.
- Creating a new exercise in the modal auto-assigns it to the selected day (line 149). This is a convenience feature but could be surprising — the user might want to create an exercise without assigning it.
- The `AddExerciseButton` component (lines 293) is a **separate, standalone** exercise creation modal. It opens its own modal with just a name input — no select mode, no day assignment.

## Code Quality Observations

### Strengths

1. **Clean architecture pattern**: The feature modules follow the inward dependency flow (server actions -> use cases -> repository interface -> repository impl -> entity). This is well-maintained.
2. **Entity validation**: `createUser()` properly validates input (trimming, length limits, empty check) before the data reaches the DB.
3. **Test coverage**: The new tests (`add-user-modal.test.tsx`, `user-entity.test.ts`) are comprehensive with good edge cases (empty name, whitespace, length limit, duplicate names).
4. **Modal UX**: The AddUserModal has proper accessibility considerations (stopPropagation on card body, overlay click to close, disabled submit when empty).

### Concerns

1. **Duplicate modal patterns**: The `AddExerciseButton` and the plan page's integrated modal serve overlapping purposes. This is the root cause of the UX bug.
2. **No loading state on user list refresh**: After creating a user, there's no visual feedback while `getUsersAction()` completes. The modal closes immediately but the user list doesn't update until the async call returns.
3. **Hardcoded migration timestamps**: The DEFAULT values in migrations use specific timestamps (`'2026-06-15T21:01:33.719Z'`). These are Drizzle-generated and will differ across environments.

## Security Observations

1. **No SQL injection risk**: All DB queries use Drizzle ORM parameterized queries. No raw SQL is used in application code paths.
2. **No XSS risk**: User input (name) is rendered as text content in React, which auto-escapes. No `dangerouslySetInnerHTML` usage.
3. **Name uniqueness constraint**: The DB-level unique constraint on `users.name` prevents duplicate names. The use case also checks `findByName` before insert, providing application-level protection.
4. **No auth bypass**: The user creation happens on the login page (no auth required). The user selection cookie (`kachalka.userId`) is set after creation via the `handleCreated` callback, which refreshes the list. This is correct — new users can be created without prior auth.
5. **Name length limit**: The 100-character limit prevents potential storage issues. The client doesn't enforce this limit, so a very long name would be sent to the server and rejected there.

## Database Schema (Post-Migration)

| Table | Columns |
|-------|---------|
| `users` | id (PK, auto), name (unique, not null), created_at, is_active |
| `exercises` | id (PK, auto), name (not null), user_id (FK -> users), created_at, updated_at |
| `user_routines` | id (PK, auto), user_id (FK), exercise_id (FK), day_of_week, created_at; unique on (user_id, exercise_id, day_of_week) |
| `workout_logs` | id (PK, auto), user_id (FK), exercise_id (FK), date, sets (JSON), created_at, updated_at |

## Test Results

- **893 tests passed**, 2 failed
- Failed tests are in the worktree's `tests/db/schema.spec.ts` which still references `users.email` (the main branch version has the same issue — the local branch fixes it but hasn't been committed to main)
- All new tests pass: `add-user-modal.test.tsx` (18 tests), `user-entity.test.ts` (5 tests), `user-entity.spec.ts` (18 tests)
- All existing tests pass for the modified code paths

## Issues Summary

| # | Severity | Description |
|---|----------|-------------|
| 1 | High | `AddExerciseButton` renders on plan page alongside integrated modal — causes wrong modal to open |
| 2 | Medium | `onCreated` callback not awaited — potential race condition |
| 3 | Medium | Schema test still references `users.email` — test failure |
| 4 | Low | Duplicate `getUserId()` logic in plan page (5 copies) |
| 5 | Low | Silent failure when `loadData()` fails after assignment |
| 6 | Low | No guard against double-submit in `handleCreateExercise` |

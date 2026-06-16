# Review: feat/add-user-button

## Scope

Analyzed 26 files across the user creation and plan page systems. The branch adds an inline user creation modal on the login page, removes the `email` field from the users schema, and introduces a dual-mode modal on the plan page for exercise assignment/creation.

## ⚠️ Issues

### 1. Plan page: `AddExerciseButton` component renders alongside the integrated modal, causing confusion and broken UX

**Severity: High**

In `src/app/(main)/plan/page.tsx#L293`, the `AddExerciseButton` component is rendered inside the assignment list:

```tsx
{assignments.length > 0 ? (
  <div id="plan-assignment-list" className="w-full space-y-3">
    {assignments.map((a, idx) => ( ... ))}
    <AddExerciseButton onSuccess={loadData} />
  </div>
) : (
  <div className="...">NO ASSIGNMENTS...</div>
)}
```

The `AddExerciseButton` component (`src/app/components/add-exercise-button.tsx`) renders its own standalone modal for creating new exercises. Meanwhile, the plan page also has its own integrated modal with select/new toggle modes (lines 324-433) and a toggle button (lines 307-321).

**Result**: Two competing ways to add exercises exist simultaneously:
- The `AddExerciseButton` button inside the assignment list opens a standalone "NEW EXERCISE" modal
- The "ADD EXERCISE" toggle button below the assignments opens the integrated select/new modal

When a user clicks "ADD EXERCISE" expecting the integrated modal, they may instead trigger the `AddExerciseButton` (depending on click position, z-index, or timing). The user confirmed this bug during manual testing: "clicking ADD EXERCISE on the plan page opens the wrong component/modal."

**Fix**: Remove the `<AddExerciseButton onSuccess={loadData} />` from line 293. The integrated modal with select/new toggle already handles both selecting existing exercises and creating new ones. The `AddExerciseButton` is a redundant standalone component that serves no purpose on the plan page.

### 2. `handleCreated` callback is async but not awaited — race condition on user list refresh

**Severity: Medium**

In `src/app/components/user-selection.client.tsx#L24`:

```tsx
async function handleCreated(): Promise<void> {
  const freshUsers = await getUsersAction()
  setUsers(freshUsers)
}
```

This is passed as `onCreated` prop to `AddUserModal`. In the modal (`add-user-modal.tsx#L27`):

```tsx
if (result.success) {
  setOpen(false)
  setName('')
  onCreated?.()
}
```

The `onCreated?.()` call is not awaited. Since `handleCreated` is async (it `await`s `getUsersAction`), the caller should `await` it to ensure the user list refresh completes before the modal fully closes. Without the await, the modal closes and the state update races with the list refresh.

In practice this likely works (React batches state updates), but it's technically a race condition. If `getUsersAction` takes time (cold DB), the user could briefly see stale data.

**Fix**: Either make `handleCreated` synchronous (just call `setUsers` after the await in a separate effect), or await the callback: `await onCreated?.()`.

### 3. Schema test in worktree still references `users.email` — test failure

**Severity: Medium**

The worktree's `tests/db/schema.spec.ts` still contains:
```tsx
expect(users.email).toBeDefined()
```
and
```tsx
expect(users.email.notNull).toBe(true)
```

This causes 2 test failures. The main branch version of `tests/db/schema.spec.ts` also has these email assertions, while the local branch version correctly removes them. The worktree was created from HEAD which should have the email removal, suggesting the worktree's copy of this file is stale.

**Impact**: The schema tests fail on the review branch. The main branch tests also fail for the same reason (the `email` column no longer exists on the schema).

**Fix**: Ensure `tests/db/schema.spec.ts` on main branch removes the `users.email` assertions (line 8 and lines 21-23). The local branch has the correct version — this may be a git state issue in the worktree.

### 4. Duplicate `getUserId` logic scattered across plan page

**Severity: Low**

The plan page extracts the user ID from the cookie in 4 separate places:
- `loadData()` line 53
- `handleAddExercise()` line 102
- `handleModalAddExercise()` line 121
- `handleCreateExercise()` line 141
- `handleRemoveExercise()` line 164

Each follows the same pattern:
```tsx
const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
const userId = cookieMatch ? parseInt(cookieMatch[1], 10) : 0
if (!userId) return
```

**Fix**: Extract this into a module-level `getUserId()` helper function (similar to the one in `AddExerciseButton#L17-20`) and import or inline it.

### 5. Silent failure when `loadData()` fails after exercise assignment

**Severity: Low**

In `handleModalAddExercise()` (line 117-134):

```tsx
if (result.success && result.assignment) {
  await loadData()
  setShowModal(false)
  setSelectedExerciseId(null)
}
```

If `assignExerciseAction` succeeds but `loadData()` fails (network error, DB down), the modal still closes and the UI shows stale data. The error from `loadData()` is caught by its internal `setError()` call, but the user gets no visible feedback that the assignment may not have persisted correctly.

**Fix**: Check the result of `loadData()` and show an error if the refresh failed, or at minimum keep the modal open.

### 6. No guard against double-submit in `handleCreateExercise`

**Severity: Low**

In `handleCreateExercise()` (line 137-161):

```tsx
async function handleCreateExercise() {
  if (!newExerciseName.trim()) return
  setError(null)
  const cookieMatch = document.cookie.match(/kachalka\.userId=(\d+)/)
  const userId = cookieMatch ? parseInt(cookieMatch[1], 10) : 0
  if (!userId) return
  setCreatingExercise(true)
  const result = await createExerciseAction(newExerciseName.trim(), userId)
  // ...
}
```

The `creatingExercise` state disables the button (`disabled={!newExerciseName.trim() || creatingExercise}`), which prevents double-click. However, if the user submits via Enter key on the input, or if there's any way to trigger the handler twice (e.g., rapid key presses), the `creatingExercise` guard is the only protection. This is actually fine since the button is disabled — the real risk is low. Marking as Low severity.

## 📝 Nits

### 1. Missing `aria` attributes on modal

The `AddUserModal` overlay and modal container lack `role="dialog"` and `aria-label` attributes. The plan page modal has the same issue. This is an accessibility concern.

**Location**: `src/app/components/add-user-modal.tsx#L48-57`, `src/app/(main)/plan/page.tsx#L324-330`

### 2. No client-side length validation before server call

The modal allows entering a name of any length and sends it to the server. The server-side entity validates the 100-character limit, but the user gets no feedback until after the network round-trip.

**Location**: `src/app/components/add-user-modal.tsx#L80-88`

### 3. Migration timestamps are hardcoded

The migrations use hardcoded timestamps like `'2026-06-15T21:01:33.719Z'` in the DEFAULT values. These are Drizzle-generated and will cause issues if the DB is initialized on a different machine with a different clock. Not a bug per se, but worth noting.

**Location**: `src/db/migrations/0002_left_mariko_yashida.sql`

### 4. Seed script uses `strftime('%s', 'now')` while schema uses ISO string defaults

The seed script's inline table creation uses `strftime('%s', 'now')` for timestamps, but the schema.ts and migrations use ISO string defaults like `'"2026-06-15T21:01:33.719Z"'`. This inconsistency could cause issues if the seed runs before migrations.

**Location**: `tests/features/user/user-repo-impl.spec.ts#L16-23`, `tests/features/routine/routine-repo-impl.spec.ts#L17-24`

### 5. `email` column removed from schema but `email` column still in main branch test

The `tests/db/schema.spec.ts` on the main branch still has email assertions. The local branch removes them, but these changes haven't been pushed to main.

### 6. Unused `label` prop on `AddExerciseButton`

The `AddExerciseButton` component accepts a `label` prop (line 7) but the plan page always uses the default "ADD EXERCISE". The prop is never customized.

**Location**: `src/app/components/add-exercise-button.tsx#L7`

## Questions

1. Why does the plan page have both `AddExerciseButton` (standalone) and an integrated select/new modal? Was the `AddExerciseButton` intentionally left in, or is it a leftover from an earlier iteration?

2. The `createUser` entity function returns `{ id: { value: 0 }, name: trimmedName }` — a placeholder ID. The actual ID is only known after the DB insert in the repository. Is this intentional (the entity is a validation step, not a persistence step)?

3. The `handleCreated` callback in `user-selection.client.tsx` refreshes the user list by calling `getUsersAction()` (which hits the DB). Could this be optimized to just `setUsers(prev => [...prev, result.user])` to avoid a round-trip?

## Cross-Examination

No past reviews found in `reviews/` directory.

---

## Summary

- **Files analyzed**: 26 files across user creation, plan page, schema, tests, migrations, and seed
- **Tests**: 893 passed, 2 failed (worktree schema test referencing removed `email` column)
- **Issues**: 6 (1 High, 1 Medium, 4 Low)
- **Nits**: 6
- **Questions**: 3

**Recommendation**: Blocker — Fix issue #1 (remove `AddExerciseButton` from plan page assignment list). The other issues can be addressed in follow-up.

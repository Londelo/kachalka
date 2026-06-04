# Add User Button — Create New User Modal

## Summary

Add a red square button with a plus sign on the right side of the "SELECT COMMANDER" title container. Clicking it opens a modal with form inputs (name, email) to create a new user via the existing `createUserAction` server action.

## Context

- **User selection page**: `src/app/components/user-selection.client.tsx`
- **Title container**: `<div id="user-selection-title">` at line 29 — currently uses `justify-between` with nothing on the right
- **Existing server action**: `createUserAction(name)` in `src/features/user/user-server-actions.ts` — currently only accepts `name`, needs `email` parameter
- **User schema** (`src/db/schema.ts`): `id`, `name` (required, unique), `email` (required, default ''), `createdAt`, `isActive`
- **Modal pattern**: Follow `src/app/components/add-exercise-button.tsx` — overlay with `bg-black/50`, neo-brutalist card with `neo-shadow`, cancel button
- **Button style**: Square red button with `bg-red-500` (or similar), `border-4 border-on-surface`, `neo-shadow`, `active-press`, plus icon via Material Symbols

## Files to Change

### 1. `src/features/user/user-server-actions.ts`

Add `email` parameter to `createUserAction`. Currently it only accepts `name`. Update the use case call to pass email.

### 2. `src/features/user/create-user.ts`

Update `execute` to accept and pass `email` to `createUser` entity function.

### 3. `src/features/user/user-entity.ts`

Update `createUser` function to accept `email` parameter. Validate it (non-empty, valid email format optional). Update the return type to include `email`.

### 4. `src/features/user/user-repository.ts`

Update `create` method signature to accept `email`.

### 5. `src/features/user/user-repo-impl.ts`

Update `create` to insert `email` field.

### 6. New file: `src/app/components/add-user-modal.tsx`

Create a reusable modal component following the `add-exercise-button.tsx` pattern:

- State: `open`, `name`, `email`, `error`, `creating`
- Modal overlay with click-to-close
- Form inputs: name (text), email (email)
- Submit calls `createUserAction(name, email)`
- On success: close modal, refresh user list
- Styling: matches existing neo-brutalist design

### 7. `src/app/components/user-selection.client.tsx`

- Import `AddUserModal`
- Add a square red button (`+` icon) to the right side of the `user-selection-title` container
- Wire the button to open the modal
- On successful user creation, refresh the user list (re-fetch from server action)

## Notes

- The user list needs to refresh after creating a user. The `getUsersAction` server action already exists and can be called to re-fetch.
- Consider whether to use a key prop or React Query-style invalidation, or simply re-render by updating state via the `getUsersAction` result.

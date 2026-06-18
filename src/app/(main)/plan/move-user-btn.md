# Move Add-User Button Into User List

## Goal

Move the "add user" button from its current inline position inside `AddUserModal` into the user list alongside the `UserCard` buttons, styled like a `UserCard` (wide, tall rectangular command button) but red.

## Current State

- **User list**: `src/app/components/user-selection.client.tsx` renders `UserCard` buttons — full-width, tall rectangular buttons with `neo-shadow`, thick borders, and `active-press` animation.
- **Add-user button**: A small `size-12` red square (`bg-red-500`) rendered inside `AddUserModal` at `src/app/components/add-user-modal.tsx:37-46`. It triggers the modal to create a new user.
- **User page**: `src/app/page.tsx` (server) calls `getUsersAction()` and passes `initialUsers` to `<UserSelectionClient />`.

## Target State

- The user list in `UserSelectionClient` renders `UserCard` buttons **plus** a red "add" button **always last** (after all user cards), styled like a `UserCard` but with `bg-red-500` and an add icon.
- The add button is a `<button>` that opens the `AddUserModal` (same modal, same `createUserAction`).
- No visual change to the modal itself.

## Implementation

### 1. `src/app/components/user-selection.client.tsx`

Add a red add-button at the end of the user list, after all `UserCard` buttons:

```tsx
<button
  type="button"
  onClick={() => setShowAddModal(true)}
  className="group flex w-full cursor-pointer items-center justify-center border-4 border-on-surface bg-red-500 py-8 text-3xl font-black uppercase text-on-surface transition-all neo-shadow active-press"
>
  <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>
    add
  </span>
</button>
```

- Add `setShowAddModal` state alongside the existing `users` state.
- The `AddUserModal` already accepts an `open` prop — wire it to `showAddModal` state.

### 2. `src/app/components/add-user-modal.tsx`

Ensure the modal accepts an `open` prop (or add one if it already uses a local state). If it currently manages its own `open` state internally, lift it to a prop so `UserSelectionClient` can control it from the list.

### 3. Styling details

- **Background**: `bg-red-500` (same red as current add button)
- **Border**: `border-4 border-on-surface` (same as UserCard)
- **Padding**: `py-8` (same as UserCard)
- **Icon**: white "add" symbol from Material Symbols, centered
- **Shadow + press**: `neo-shadow` + `active-press` (same as UserCard)
- **Hover**: optional `hover:bg-red-600` for feedback

## Files Changed

| File | Change |
|------|--------|
| `src/app/components/user-selection.client.tsx` | Add red add button to user list; lift modal open state |
| `src/app/components/add-user-modal.tsx` | Accept `open` prop if not already |

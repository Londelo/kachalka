# Add User Button — TDD Step-by-Step Deconstruction

> Every step is one cycle: **write test → write function → review**. No exceptions. Tests always fail first.

---

## Layer 1: Entity (`src/features/user/user-entity.ts`)

### Step 1 — Write test for `validateEmail` (new helper function)

**File**: `src/features/user/user-entity.test.ts` (create)

**Tests to write** (before any implementation exists):

1. `validateEmail` throws when argument is empty string
2. `validateEmail` throws when argument is whitespace-only string
3. `validateEmail` throws when argument is not a string (number)
4. `validateEmail` throws when argument is not a string (object)
5. `validateEmail` throws when argument is not a string (null)
6. `validateEmail` throws when argument is not a string (undefined)
7. `validateEmail` returns trimmed string for valid non-empty email
8. `validateEmail` returns string as-is when already trimmed

**Run**: `vitest run user-entity.test.ts` — expect all failures

### Step 2 — Write `validateEmail` function

**File**: `src/features/user/user-entity.ts`

Implement `validateEmail(email: string): string` that:
- Throws if not a string
- Throws if `.trim().length === 0`
- Returns `email.trim()`

**Run**: `vitest run user-entity.test.ts` — expect all pass

### Step 3 — Review `validateEmail`

Check: correct error messages, no dead code, matches project error style.

### Step 4 — Write test for updated `createUser` (email parameter)

**File**: `src/features/user/user-entity.test.ts` (append)

**Tests to write**:

1. `createUser` accepts `name` and `email` parameters and returns object with `id`, `name`, and `email`
2. `createUser` trims the name and returns trimmed name in result
3. `createUser` trims the email and returns trimmed email in result
4. `createEmail` throws when name is empty string
5. `createEmail` throws when name is whitespace-only
6. `createUser` throws when name exceeds 100 characters
7. `createUser` throws when email is empty string
8. `createUser` throws when email is whitespace-only

**Run**: `vitest run user-entity.test.ts` — expect all failures (tests 1-8)

### Step 5 — Write updated `createUser` function

**File**: `src/features/user/user-entity.ts`

Update `createUser` signature to `createUser(name: string, email: string): User` and:
- Call `validateEmail(email)` to get trimmed email
- Keep existing name validation (trim, empty, max 100)
- Call `validateEmail` on email (empty check)
- Return `{ id: { value: 0 }, name: trimmedName, email: trimmedEmail }`

**Run**: `vitest run user-entity.test.ts` — expect all pass

### Step 6 — Review `createUser` changes

Check: backward-compatible? No (signature changed — that's fine, all callers update next). Error messages consistent? Return type correct?

### Step 7 — Write type assertion test for `User` type

**File**: `src/features/user/user-entity.test.ts` (append)

**Tests to write**:

1. `User` type has `id` property of type `{ value: number }`
2. `User` type has `name` property of type `string`
3. `User` type has `email` property of type `string`
4. `createUser` result can be assigned to `User` type

**Run**: `vitest run user-entity.test.ts` — expect all pass

### Step 8 — Review type assertions

Check: type tests correctly assert the shape. No regressions from name-only version.

---

## Layer 2: Repository Interface (`src/features/user/user-repository.ts`)

### Step 9 — Write test for `UserRepository.create` with email parameter

**File**: `tests/features/user/user-repository.spec.ts` (create)

**Tests to write**:

1. `create` method returns a `User` object containing `id`, `name`, and `email` properties
2. `create` method creates user with both name and email
3. `create` method returns created user with correct email value
4. `create` method throws when user already exists (by name)

**Run**: `vitest run user-repository.spec.ts` — expect all failures (interface doesn't have email in create signature yet)

### Step 10 — Review interface changes

**File**: `src/features/user/user-repository.ts`

Update `create` method signature from `create(user: User): User` — verify it already accepts the full `User` type (which now includes `email`). No interface change needed since `User` type already changed in Step 5.

**Run**: `vitest run user-repository.spec.ts` — expect all pass (interface was already compatible via the `User` type)

### Step 11 — Review interface

Check: no unnecessary interface changes. The `User` type change in the entity layer cascaded through automatically.

---

## Layer 3: Repository Implementation (`src/features/user/user-repo-impl.ts`)

### Step 12 — Write test for `createSqliteUserRepository.create` with email

**File**: `tests/features/user/user-repo-impl.spec.ts` (create)

**Tests to write**:

1. `create` inserts user with email field into database
2. `create` returns created user with email matching inserted value
3. `create` returns user where `id.value` matches the database-assigned ID
4. `create` inserts name field correctly
5. `mapRowToUser` maps a row with email column to User object with email property
6. `mapRowToUser` maps a row without email column gracefully (defaults to '')

**Run**: `vitest run user-repo-impl.spec.ts` — expect all failures (implementation doesn't use email yet)

### Step 13 — Write updated `create` method in `createSqliteUserRepository`

**File**: `src/features/user/user-repo-impl.ts`

Update the `create` method to:
- Insert `email` field: `.values({ name: user.name, email: user.email })`
- Return `email` in `.returning()`: `.returning({ id: schema.users.id, name: schema.users.name, email: schema.users.email })`
- Include `email` in returned user object

**Run**: `vitest run user-repo-impl.spec.ts` — expect all pass

### Step 14 — Review repository implementation

Check: Drizzle insert includes email, returning clause includes email, mapRowToUser includes email. No other methods affected.

### Step 15 — Write test for `mapRowToUser` with email

**File**: `tests/features/user/user-repo-impl.spec.ts` (append)

**Tests to write**:

1. `mapRowToUser` maps `row.email` to `User.email`
2. `mapRowToUser` handles `row.email` being empty string
3. `mapRowToUser` maps all fields: `id`, `name`, `email`

**Run**: `vitest run user-repo-impl.spec.ts` — expect all pass (if not, update `mapRowToUser`)

### Step 16 — Review `mapRowToUser`

If Step 15 fails, update `mapRowToUser` to include email. Review the mapping.

---

## Layer 4: Use Case (`src/features/user/create-user.ts`)

### Step 17 — Write test for `createUserUseCase.execute` with email parameter

**File**: `tests/features/user/create-user.spec.ts` (create)

**Tests to write** (use mock repo with `vi.fn()`):

1. `execute` passes both name and email to `repo.create`
2. `execute` returns the user created by `repo.create`
3. `execute` throws 'User already exists' when `repo.findByName` returns existing user (email not checked for duplicate)
4. `execute` propagates error from `repo.create` when it throws
5. `execute` calls `validateUser` (entity) with name and email arguments

**Run**: `vitest run create-user.spec.ts` — expect all failures (execute doesn't accept email yet)

### Step 18 — Write updated `execute` method

**File**: `src/features/user/create-user.ts`

Update `execute` signature to `execute(name: string, email: string): User` and:
- Pass email to `validateUser(name, email)`
- Pass full user object (with email) to `repo.create`

**Run**: `vitest run create-user.spec.ts` — expect all pass

### Step 19 — Review use case

Check: email flows through entity validation → repo.create. No logic changes beyond parameter threading.

---

## Layer 5: Server Action (`src/features/user/user-server-actions.ts`)

### Step 20 — Write test for `createUserAction` email validation

**File**: `tests/features/user/user-server-actions.spec.ts` (create)

**Tests to write** (mock `getDatabase`, `createSqliteUserRepository`, and `createUserUseCase` per project convention):

1. `createUserAction` returns `{ success: false, error: 'Name is required' }` when name is empty
2. `createUserAction` returns `{ success: false, error: 'Email is required' }` when email is empty string
3. `createUserAction` returns `{ success: false, error: 'Email is required' }` when email is whitespace-only
4. `createUserAction` returns `{ success: false, error: 'Email is required' }` when email is not provided (undefined)

**Run**: `vitest run user-server-actions.spec.ts` — expect all failures

### Step 21 — Write email validation in `createUserAction`

**File**: `src/features/user/user-server-actions.ts`

Add validation before use case call:
```ts
if (typeof email !== 'string' || email.trim().length === 0) {
  return { success: false, error: 'Email is required' }
}
```

**Run**: `vitest run user-server-actions.spec.ts` — expect steps 20.2-20.4 pass, 20.1 still fails (name validation already exists)

### Step 22 — Review email validation in server action

Check: error message consistent, validation order correct (name first, then email).

### Step 23 — Write test for `createUserAction` happy path with email

**File**: `tests/features/user/user-server-actions.spec.ts` (append)

**Tests to write**:

1. `createUserAction` calls `createUserUseCase.execute` with name and email
2. `createUserAction` returns `{ success: true, user }` where user includes email
3. `createUserAction` returns user object with both name and email fields
4. `createUserAction` returns `{ success: false, error: <message> }` when use case throws

**Run**: `vitest run user-server-actions.spec.ts` — expect all failures

### Step 24 — Write updated `createUserAction` function

**File**: `src/features/user/user-server-actions.ts`

Update:
- Add `email: string` parameter
- Pass `email` to `useCase.execute(name, email)`

**Run**: `vitest run user-server-actions.spec.ts` — expect all pass

### Step 25 — Review server action

Check: parameter order, error handling, return type includes email in User.

---

## Layer 6: Modal Component (`src/app/components/add-user-modal.tsx`)

### Step 26 — Write test for modal state initialization

**File**: `src/app/components/add-user-modal.test.tsx` (create)

**Tests to write** (use `@testing-library/react`, vitest jsdom environment):

1. Modal renders with `open=false` and is not visible in DOM
2. Modal renders with `open=true` and is visible in DOM
3. Modal renders with `open=false` and modal overlay is not in DOM

**Run**: `vitest run add-user-modal.test.tsx` — expect all failures (component doesn't exist)

### Step 27 — Write `AddUserModal` component skeleton

**File**: `src/app/components/add-user-modal.tsx`

Create component with:
- Props: `{ open: boolean; onClose: () => void; onSuccess?: () => void }`
- State: `name`, `email`, `error`, `creating`
- Basic modal overlay and card structure (no form yet)
- Matches neo-brutalist style from `add-exercise-button.tsx`

**Run**: `vitest run add-user-modal.test.tsx` — expect all pass

### Step 28 — Review modal skeleton

Check: props interface correct, state initialized, overlay click-to-close pattern matches add-exercise-button.

### Step 29 — Write test for modal form inputs

**File**: `src/app/components/add-user-modal.test.tsx` (append)

**Tests to write**:

1. Modal renders name input field when open
2. Modal renders email input field when open
3. Name input value updates on user typing
4. Email input value updates on user typing
5. Submit button is disabled when name is empty
6. Submit button is disabled when email is empty
7. Submit button is disabled when email format is invalid (no @ symbol)
8. Submit button is enabled when name and email are valid

**Run**: `vitest run add-user-modal.test.tsx` — expect failures (inputs not implemented)

### Step 30 — Write form inputs in modal

**File**: `src/app/components/add-user-modal.tsx`

Add:
- Name `<input>` with `type="text"`, `value={name}`, `onChange` handler
- Email `<input>` with `type="email"`, `value={email}`, `onChange` handler
- Submit button: `disabled={creating || !name.trim() || !email.trim() || !email.includes('@')}`
- Input styling matches neo-brutalist pattern from add-exercise-button

**Run**: `vitest run add-user-modal.test.tsx` — expect all pass

### Step 31 — Review form inputs

Check: input types correct, disabled logic correct, styling matches existing patterns.

### Step 32 — Write test for modal submit handler

**File**: `src/app/components/add-user-modal.test.tsx` (append)

**Tests to write**:

1. On submit with valid name and email, calls `createUserAction(name, email)`
2. On submit success, closes modal (`onClose` called)
3. On submit success, calls `onSuccess` callback if provided
4. On submit error, displays error message in error element
5. On submit, sets `creating` state to true during call
6. On submit completion, sets `creating` state to false
7. On submit, clears form inputs (name and email) on success
8. Modal overlay click closes the modal
9. Clicking modal card content does NOT close the modal (stopPropagation)

**Run**: `vitest run add-user-modal.test.tsx` — expect failures (submit handler not wired)

### Step 33 — Write submit handler in modal

**File**: `src/app/components/add-user-modal.tsx`

Implement:
- `handleCreate` async function: calls `createUserAction(name.trim(), email.trim())`
- On success: `setOpen(false)`, `setName('')`, `setEmail('')`, `onSuccess?.()`
- On error: `setError(result.error ?? 'Failed to create user')`
- Form `<form onSubmit>` wrapper around inputs
- Cancel button: `onClick={() => setOpen(false)}`
- Error display div when `error` is set

**Run**: `vitest run add-user-modal.test.tsx` — expect all pass

### Step 34 — Review submit handler

Check: error state displays correctly, form clears on success, creating state toggles properly.

---

## Layer 7: User Selection Screen (`src/app/components/user-selection.client.tsx`)

### Step 35 — Write test for add-user button rendering

**File**: `tests/features/user/user-selection.spec.tsx` (create)

**Tests to write**:

1. User selection screen renders the "SELECT COMMANDER" title
2. User selection screen renders an add user button (red square with + icon) to the right of the title
3. Add user button has correct CSS classes (red bg, square, neo-shadow)
4. Add user button has material symbol plus icon
5. Clicking add user button opens the modal
6. Modal renders inside user selection screen with name and email inputs
7. After successful user creation, user list shows the new user
8. Modal cancel button closes the modal

**Run**: `vitest run user-selection.spec.tsx` — expect all failures (button doesn't exist yet)

### Step 36 — Write add-user button in user selection screen

**File**: `src/app/components/user-selection.client.tsx`

Add:
- Import `AddUserModal`
- Import `getUsersAction` for refresh
- Add state: `modalOpen`, `name`, `email` (or just use modal as component)
- Add red square button (`bg-red-500`, `border-4 border-on-surface`, `neo-shadow`, `+` icon) to title container
- Add `<AddUserModal>` component
- Wire button `onClick` to open modal
- Wire modal `onSuccess` to refresh user list

**Run**: `vitest run user-selection.spec.tsx` — expect steps 35.1-35.6 pass, 35.7-35.8 may fail

### Step 37 — Review user selection changes

Check: button positioned correctly (right side of title), modal renders, user list refreshes.

### Step 38 — Write test for user list refresh after creation

**File**: `tests/features/user/user-selection.spec.tsx` (append)

**Tests to write**:

1. After modal submit succeeds, `getUsersAction` is called to refresh list
2. New user appears in user cards grid after creation
3. Existing users are preserved after creating a new user

**Run**: `vitest run user-selection.spec.tsx` — expect failures (refresh not implemented)

### Step 39 — Implement user list refresh

**File**: `src/app/components/user-selection.client.tsx`

Add refresh logic: call `getUsersAction()` on modal `onSuccess`, update `setUsers` state.

**Run**: `vitest run user-selection.spec.tsx` — expect all pass

### Step 40 — Review user selection screen

Check: button style matches spec (red, square, + icon), modal integration correct, list refreshes properly.

---

## Summary: 40 TDD Cycles

| Layer | Steps | What Changes |
|-------|-------|-------------|
| Entity | 1-8 | `validateEmail` helper, `createUser` accepts email, `User` type includes email |
| Repository Interface | 9-11 | No change needed (User type cascade) |
| Repository Impl | 12-16 | `create` inserts email, `mapRowToUser` maps email |
| Use Case | 17-19 | `execute` passes email through |
| Server Action | 20-25 | `createUserAction` validates + passes email |
| Modal Component | 26-34 | New `AddUserModal` with form, validation, submit |
| User Selection | 35-40 | Add button, wire modal, refresh list |

**Total**: 40 cycles. Each cycle = write test (red) → write code (green) → review.

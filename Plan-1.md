# Plan-1 — Phase 1: Users

## WHAT

Build the user management feature: entity definition, repository interface and SQLite implementation, use cases for creating and listing users, Next.js server action wrappers, and the user selection/create page. This is the app's entry point — users must exist before they can track exercises, routines, or workouts.

**Files to create:**
- `src/features/user/user-entity.ts` — User domain type, UserId value object, name validation factory
- `src/features/user/user-repository.ts` — UserRepository interface definition
- `src/features/user/create-user.ts` — CreateUser use case
- `src/features/user/get-users.ts` — GetUsers use case
- `src/features/user/user-server-actions.ts` — Next.js server action wrappers
- `src/features/user/user-repo-impl.ts` — Drizzle + SQLite repository implementation
- `src/app/page.tsx` — User selection page (list + create form)
- `tests/features/user/user-entity.test.ts` — Unit tests for entity validation
- `tests/features/user/create-user.test.ts` — Unit tests for CreateUser use case
- `tests/features/user/get-users.test.ts` — Unit tests for GetUsers use case
- `tests/features/user/user-repo-impl.test.ts` — Integration tests against in-memory SQLite

**Acceptance criteria:**
- Can create a new user from the selection page
- Can select an existing user and get redirected (via session/cookie to `src/app/today/page.tsx`)
- User names are validated (not empty, max 100 chars, trimmed)
- Users are stored in SQLite and listed on reload
- Duplicate names are rejected (users table has UNIQUE constraint on name)
- All repository interfaces are tested with in-memory SQLite

#### [src/features/user/user-entity.ts](src/features/user/user-entity.ts)

**UserId value object**
- Wraps a number in an object with a `value` property
- Private constructor — only create via `UserId.make(n)`
- `UserId.make(n)` validates n is a non-negative integer, returns `{ value: n }` or throws

**User domain type**
- `{ id: UserId, name: string }`

**createUser(name)**
- Trim whitespace from name
- If empty after trim: throw Error('Name cannot be empty')
- If length > 100: throw Error('Name too long')
- Return `{ id: { value: 0 }, name: trimmedName }` (id placeholder, assigned by DB)

#### [src/features/user/user-repository.ts](src/features/user/user-repository.ts)

**UserRepository interface**
- `findById(id: number): User | undefined` — find by primary key
- `findByName(name: string): User | undefined` — find by unique name
- `findAll(): User[]` — list all users ordered by name
- `create(user: User): User` — insert and return persisted user (with assigned id)
- `delete(id: number): void` — soft delete not required yet

#### [src/features/user/create-user.ts](src/features/user/create-user.ts)

**CreateUser class**
- Constructor takes `UserRepository`
- `execute(name: string): User`
  - Validate name via `createUser(name)` from entity
  - Check if user with same name already exists via `repo.findByName(name)`
  - If exists: throw Error('User already exists')
  - Persist via `repo.create(user)`
  - Return persisted user

#### [src/features/user/get-users.ts](src/features/user/get-users.ts)

**GetUsers class**
- Constructor takes `UserRepository`
- `execute(): User[]`
  - Call `repo.findAll()`
  - Return the user list

#### [src/features/user/user-server-actions.ts](src/features/user/user-server-actions.ts)

**createUserAction(name: string): Promise<{ success: boolean; user?: User; error?: string }>**
- Validate name is a non-empty string on the server side
- Wire: `getDb()` → `SqliteUserRepository(db)` → `CreateUser(repo)` → `execute(name)`
- On success: return `{ success: true, user: createdUser }`
- On error: return `{ success: false, error: errorMessage }`

**getUsersAction(): Promise<User[]>**
- Wire: `getDb()` → `SqliteUserRepository(db)` → `GetUsers(repo)` → `execute()`
- Return the user array

#### [src/features/user/user-repo-impl.ts](src/features/user/user-repo-impl.ts)

**SqliteUserRepository implements UserRepository**
- Constructor takes `Database` from better-sqlite3
- `findById(id)` — prepare `SELECT * FROM users WHERE id = ?`, return mapped User or undefined
- `findByName(name)` — prepare `SELECT * FROM users WHERE name = ?`, return mapped User or undefined
- `findAll()` — prepare `SELECT * FROM users ORDER BY name`, return mapped User[]
- `create(user)` — prepare `INSERT INTO users (name) VALUES (?) RETURNING *`, map row to User with `UserId.make(row.id)`
- `delete(id)` — prepare `DELETE FROM users WHERE id = ?`, run

#### [src/app/page.tsx](src/app/page.tsx)

**UserSelectionPage (Server Component)**
- Fetch user list via `getUsersAction()`
- Render:
  - Heading: "Select your user"
  - List of existing users as clickable cards/buttons
  - Text input for new user name
  - "Add" button to trigger `createUserAction(name)`
- On user selection: set session/cookie with userId, redirect to `src/app/today/page.tsx`
- On new user creation: refresh list, auto-select the new user, redirect to `src/app/today/page.tsx`
- Handle error state: display error message if creation fails (e.g., duplicate name)

#### [tests/features/user/user-entity.test.ts](tests/features/user/user-entity.test.ts)

Use cases to test:
- Happy path: valid name returns User with trimmed name and placeholder id
- Trim: leading/trailing whitespace is trimmed before validation
- Empty string: throws Error('Name cannot be empty')
- Whitespace-only string: throws Error('Name cannot be empty')
- Too long: 101-char name throws Error('Name too long')
- Exactly 100 chars: accepted
- UserId.make: positive integer creates value object
- UserId.make: zero is accepted (edge case)
- UserId.make: negative number throws
- UserId.make: non-integer throws
- UserId.make: null/undefined throws

#### [tests/features/user/create-user.test.ts](tests/features/user/create-user.test.ts)

Use cases to test:
- Happy path: valid name creates user and returns persisted user with id
- Duplicate name: throws Error('User already exists')
- Empty name: throws from entity validation
- Repo failure: throws when repo.create throws

#### [tests/features/user/get-users.test.ts](tests/features/user/get-users.test.ts)

Use cases to test:
- Empty database: returns empty array
- Single user: returns array with one user
- Multiple users: returns array sorted by name
- Repo returns undefined fields: filters them out

#### [tests/features/user/user-repo-impl.test.ts](tests/features/user/user-repo-impl.test.ts)

Use cases to test:
- Integration: create → findByName → findById returns the same user
- Integration: findAll returns all created users
- Integration: delete removes user from findAll results
- Integration: findByName for non-existent user returns undefined
- Integration: findById for non-existent user returns undefined
- Setup/teardown: uses in-memory SQLite (`:memory:`) with Drizzle schema migration per test

## WHY

Users are the identity boundary for all data in this app. Every exercise, routine, and workout log is scoped to a user. Without users, no other feature can function. This phase also establishes the deep module pattern (entity → repository interface → use case → server action → implementation) that all subsequent phases will follow. Getting this right ensures consistency across the entire codebase.

## QUESTIONS

**For you to answer:**
  • Should we persist the selected userId in a cookie, localStorage, or a server-side session? Cookie is framework-agnostic but localStorage survives server restarts.
  • Do we need soft-delete for users (to preserve exercise ownership when a user leaves), or is hard-delete acceptable for v1?
  • Should the redirect after user selection go directly to `src/app/today/page.tsx`, or should we check if the user has a routine set up first and redirect to profile setup if empty?

**You can ask me:**
  • "What should happen if a user is deleted but owns exercises someone else uses in their routine?"
  • "Should we support user avatars or initials for the selection page UI?"
  • "How should the today page behave for a user with no routine — blank page or a guided setup?"

## CRITIQUES

  • The UserId value object adds indirection that may be overkill for a simple autoincrement integer — could just use `number` directly and save boilerplate. Worth it only if we plan to add value-object semantics (equality, serialization) later.
  • Server actions duplicate input validation that the entity layer already does — this is intentional for security (defense in depth), but means every action needs two validation points.
  • No auth mechanism means any browser can access any user's data if the userId is guessed — acceptable for v1 since this is a personal workout tracker, but should be flagged that this is not a multi-tenant secure design.
  • The `src/app/page.tsx` handles both listing and creation, which means it grows as we add features (avatar, initials, etc.). Consider if a separate component should handle the "add user" form to keep the page file thin.
  • Redirecting to `src/app/today/page.tsx` immediately assumes the user has a routine — if they don't, the today page will show "No workout scheduled." This is actually the desired UX per the business logic doc, but it means the today page MUST handle the empty-routine case gracefully.


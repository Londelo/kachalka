# Lifting App — Architecture Plan

## Overview

A Next.js web app for tracking weightlifting workouts, backed by SQLite via `better-sqlite3`. The architecture follows Clean Architecture principles organized as deep feature modules — each feature has a simple interface with complex implementation hidden inside.

**Key decisions:**
- **Next.js App Router** for routing and server actions
- **better-sqlite3** for synchronous, single-file SQLite — no database server needed
- **Feature-based grouping** — each domain is a deep module under `src/features/`
- **Server actions** as the interface adapter layer — they replace traditional controllers
- **Drizzle ORM** for type-safe SQLite queries with schema migration support

---

## Directory Structure

```
src/
├── main.tsx                   # App entry point (Next.js handles this, this is the wiring)
├── app/                       # Next.js App Router
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # User selection (login) page
│   ├── today/                 # Today's workout page
│   │   └── page.tsx
│   ├── history/               # History page
│   │   └── page.tsx
│   ├── progress/              # Progress chart page
│   │   └── page.tsx
│   ├── config/                # Config page
│   │   └── page.tsx
│   ├── api/                   # API routes for server actions / RSC
│   │   └── actions/           # Server action handlers (interface adapters)
│   └── globals.css
│
├── config/                    # Configuration
│   ├── db.ts                  # SQLite connection / Drizzle setup
│   └── env.ts                 # Environment variable validation
│
├── shared/                    # Cross-cutting utilities
│   ├── errors/
│   │   ├── app-error.ts       # Base application error
│   │   └── http-errors.ts     # HTTP-specific error types
│   ├── types/
│   │   └── day-of-week.ts     # DayOfWeek type
│   └── utils/
│       ├── volume.ts          # Volume calculation helpers
│       └── date.ts            # Date formatting utilities
│
├── features/                  # DEEP MODULES
│   ├── user/                  # User management
│   │   ├── user-entity.ts     # Entity: User type
│   │   ├── user-repository.ts # Interface: UserRepository
│   │   ├── create-user.ts     # Use case: CreateUser
│   │   ├── get-users.ts       # Use case: GetUsers
│   │   ├── user-server-actions.ts  # Interface adapter: Next.js server actions
│   │   └── user-repo-impl.ts  # Implementation: Drizzle + SQLite
│   │
│   ├── exercise/              # Exercise pool management
│   │   ├── exercise-entity.ts
│   │   ├── exercise-repository.ts
│   │   ├── create-exercise.ts
│   │   ├── rename-exercise.ts
│   │   ├── delete-exercise.ts
│   │   ├── list-exercises.ts
│   │   ├── exercise-server-actions.ts
│   │   └── exercise-repo-impl.ts
│   │
│   ├── routine/               # Per-user routine management
│   │   ├── routine-entity.ts  # RoutineAssignment type
│   │   ├── routine-repository.ts
│   │   ├── assign-exercise.ts
│   │   ├── remove-exercise.ts
│   │   ├── get-user-routine.ts
│   │   ├── routine-server-actions.ts
│   │   └── routine-repo-impl.ts
│   │
│   ├── workout/               # Workout logging
│   │   ├── workout-entity.ts  # WorkoutLog, Set types
│   │   ├── workout-repository.ts
│   │   ├── log-workout.ts
│   │   ├── update-workout.ts
│   │   ├── delete-workout.ts
│   │   ├── get-today-exercises.ts
│   │   ├── get-workout-history.ts
│   │   ├── get-user-volume.ts
│   │   ├── workout-server-actions.ts
│   │   └── workout-repo-impl.ts
│   │
│   └── chart/                 # Progress chart data
│       ├── chart-entity.ts    # ChartDataPoint type
│       ├── chart-service.ts   # Use case: getExerciseProgress
│       ├── chart-server-actions.ts
│       └── chart-repo-impl.ts # Aggregation queries
│
└── tests/                     # Tests mirroring src/
    ├── features/
    │   ├── user/
    │   ├── exercise/
    │   ├── routine/
    │   ├── workout/
    │   └── chart/
    └── fixtures/              # Test data and SQLite mocks
```

---

## Deep Module Registry

| Feature | Interface (exports) | Seams | Adapters |
|---------|---------------------|-------|----------|
| `user` | `UserRepository`, `CreateUser`, `GetUsers` | DB implementation | `SqliteUserRepository` |
| `exercise` | `ExerciseRepository`, `CreateExercise`, `RenameExercise`, `DeleteExercise`, `ListExercises` | DB implementation | `SqliteExerciseRepository` |
| `routine` | `RoutineRepository`, `AssignExercise`, `RemoveExercise`, `GetUserRoutine` | DB implementation | `SqliteRoutineRepository` |
| `workout` | `WorkoutRepository`, `LogWorkout`, `UpdateWorkout`, `DeleteWorkout`, `GetTodayExercises`, `GetWorkoutHistory`, `GetUserVolume` | DB implementation | `SqliteWorkoutRepository` |
| `chart` | `ChartService`, `ChartDataRepository` | DB implementation (aggregation queries) | `SqliteChartRepository` |

---

## Dependency Graph

```
app/ (Next.js pages, server actions)
  │
  ├─→ features/user/user-server-actions.ts
  ├─→ features/exercise/exercise-server-actions.ts
  ├─→ features/routine/routine-server-actions.ts
  ├─→ features/workout/workout-server-actions.ts
  └─→ features/chart/chart-server-actions.ts
        │
        ▼ (all import inward toward entities)
features/use-cases (create-user, log-workout, etc.)
        │
        ▼
features/*-repository.ts (interfaces)
        │
        ▼
features/*-entity.ts (domain types)

Implementation layer (outermost, imports inward):
features/*-repo-impl.ts ──→ config/db.ts ──→ drizzle-orm + better-sqlite3
```

Import direction flows **inward**: server actions → use cases → repository interfaces → entities. Entities have zero dependencies.

---

## Feature Details

### Feature: user

**Purpose:** Manage app users — creation, listing, and selection.

**Files:**

| File | Layer | Responsibility |
|------|-------|----------------|
| `user-entity.ts` | Entity | `User` domain type with `UserId` value object |
| `user-repository.ts` | Use Case (interface) | `UserRepository` interface definition |
| `create-user.ts` | Use Case | Create a new user with name validation |
| `get-users.ts` | Use Case | List all users |
| `user-server-actions.ts` | Interface Adapter | Next.js server action wrappers |
| `user-repo-impl.ts` | Implementation | Drizzle + SQLite implementation |

**Example — Entity:**

```typescript
// features/user/user-entity.ts
export interface UserId {
  value: number
}

export interface User {
  id: UserId
  name: string
}

export function createUser(name: string): User {
  if (!name.trim()) throw new Error('Name cannot be empty')
  if (name.length > 100) throw new Error('Name too long')
  return {
    id: { value: 0 }, // assigned by DB
    name: name.trim(),
  }
}
```

**Example — Repository Interface:**

```typescript
// features/user/user-repository.ts
import { User } from './user-entity'

export interface UserRepository {
  findById(id: number): User | undefined
  findByEmail(email: string): User | undefined
  findAll(): User[]
  create(user: User): User
  updateName(id: number, name: string): User
  delete(id: number): void
}
```

**Example — Use Case:**

```typescript
// features/user/create-user.ts
import { UserRepository } from './user-repository'
import { User, createUser } from './user-entity'

export class CreateUser {
  constructor(private readonly repo: UserRepository) {}

  execute(name: string): User {
    const user = createUser(name)
    return this.repo.create(user)
  }
}
```

**Example — Server Action (Interface Adapter):**

```typescript
// features/user/user-server-actions.ts
'use server'

import { CreateUser } from './create-user'
import { GetUsers } from './get-users'
import { getDb } from '@/config/db'
import { SqliteUserRepository } from './user-repo-impl'

export async function createUserAction(name: string) {
  const db = getDb()
  const repo = new SqliteUserRepository(db)
  const useCase = new CreateUser(repo)
  return useCase.execute(name)
}

export async function getUsersAction() {
  const db = getDb()
  const repo = new SqliteUserRepository(db)
  const useCase = new GetUsers(repo)
  return useCase.execute()
}
```

**Example — Implementation:**

```typescript
// features/user/user-repo-impl.ts
import type { Database } from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { usersTable } from '@/db/schema'
import { User } from './user-entity'
import { UserRepository } from './user-repository'

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  findById(id: number): User | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    if (!row) return undefined
    return { id: { value: row.id }, name: row.name }
  }

  findAll(): User[] {
    const rows = this.db.prepare('SELECT * FROM users ORDER BY name').all()
    return rows.map((r) => ({ id: { value: r.id }, name: r.name }))
  }

  create(user: User): User {
    const stmt = this.db.prepare(
      'INSERT INTO users (name) VALUES (?) RETURNING *'
    )
    const row = stmt.run(user.name) as Record<string, number | string>
    return { id: { value: row.id as number }, name: row.name as string }
  }

  updateName(id: number, name: string): User {
    const stmt = this.db.prepare(
      'UPDATE users SET name = ? WHERE id = ? RETURNING *'
    )
    const row = stmt.run(name, id) as Record<string, number | string>
    return { id: { value: row.id as number }, name: row.name as string }
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM users WHERE id = ?').run(id)
  }
}
```

---

### Feature: exercise

**Purpose:** Manage the shared global exercise pool. Exercises are owned by the user who creates them; only owners can rename or delete.

**Files:**

| File | Layer | Responsibility |
|------|-------|----------------|
| `exercise-entity.ts` | Entity | `Exercise` domain type |
| `exercise-repository.ts` | Use Case (interface) | `ExerciseRepository` interface |
| `create-exercise.ts` | Use Case | Create exercise with ownership |
| `rename-exercise.ts` | Use Case | Rename (owner-only, cascades to routines) |
| `delete-exercise.ts` | Use Case | Delete (only if not in any routine) |
| `list-exercises.ts` | Use Case | List all exercises (visible to everyone) |
| `exercise-server-actions.ts` | Interface Adapter | Next.js server action wrappers |
| `exercise-repo-impl.ts` | Implementation | Drizzle + SQLite implementation |

**Key seam:** Ownership check in `rename-exercise` and `delete-exercise`. The cascade on rename is handled within the use case — other features see the new name automatically since they query by exercise ID, not name.

---

### Feature: routine

**Purpose:** Manage per-user exercise-to-day assignments.

**Files:**

| File | Layer | Responsibility |
|------|-------|----------------|
| `routine-entity.ts` | Entity | `RoutineAssignment` domain type |
| `routine-repository.ts` | Use Case (interface) | `RoutineRepository` interface |
| `assign-exercise.ts` | Use Case | Assign exercise to a day (validates no duplicates) |
| `remove-exercise.ts` | Use Case | Remove exercise from a day |
| `get-user-routine.ts` | Use Case | Get full routine for a user (organized by day) |
| `routine-server-actions.ts` | Interface Adapter | Next.js server action wrappers |
| `routine-repo-impl.ts` | Implementation | Drizzle + SQLite implementation |

**Key seam:** The `get-user-routine` use case returns data organized by day of week — a shape that matches the UI directly without controllers needing to transform it.

---

### Feature: workout

**Purpose:** Log workout sets, retrieve history, calculate volume.

**Files:**

| File | Layer | Responsibility |
|------|-------|----------------|
| `workout-entity.ts` | Entity | `WorkoutLog`, `Set` domain types |
| `workout-repository.ts` | Use Case (interface) | `WorkoutRepository` interface |
| `log-workout.ts` | Use Case | Log sets for an exercise on a date |
| `update-workout.ts` | Use Case | Update existing workout log |
| `delete-workout.ts` | Use Case | Delete a workout log entry |
| `get-today-exercises.ts` | Use Case | Get exercises scheduled for today + their logged sets |
| `get-workout-history.ts` | Use Case | Get paginated history grouped by date |
| `get-user-volume.ts` | Use Case | Calculate total volume for a user/exercise/date |
| `workout-server-actions.ts` | Interface Adapter | Next.js server action wrappers |
| `workout-repo-impl.ts` | Implementation | Drizzle + SQLite implementation |

**Key seam:** Volume calculation is encapsulated in `get-user-volume`. The formula `(sets × reps × weight)` is a business invariant that lives here — callers never compute it themselves.

**Example — Entity:**

```typescript
// features/workout/workout-entity.ts
export interface Set {
  reps: number
  weight: number
}

export interface WorkoutLog {
  id: number
  userId: number
  exerciseId: number
  exerciseName: string
  date: string // YYYY-MM-DD
  sets: Set[]
}

export function calculateVolume(log: WorkoutLog): number {
  return log.sets.reduce((total, set) => total + set.reps * set.weight, 0)
}
```

---

### Feature: chart

**Purpose:** Provide aggregated data for the exercise progress chart.

**Files:**

| File | Layer | Responsibility |
|------|-------|----------------|
| `chart-entity.ts` | Entity | `ChartDataPoint` type |
| `chart-repository.ts` | Use Case (interface) | `ChartRepository` interface |
| `chart-service.ts` | Use Case | `getExerciseProgress` — fetches and formats chart data |
| `chart-server-actions.ts` | Interface Adapter | Next.js server action wrappers |
| `chart-repo-impl.ts` | Implementation | SQL aggregation queries |

**Key seam:** The chart feature is purely a query seam — it reads from workout data without modifying it. The SQL aggregation (GROUP BY date, SUM of volume) is hidden inside the implementation.

**Example — Service:**

```typescript
// features/chart/chart-service.ts
import { ChartRepository } from './chart-repository'
import { ChartDataPoint } from './chart-entity'

export class ChartService {
  constructor(private readonly repo: ChartRepository) {}

  getExerciseProgress(userId: number, exerciseId: number): ChartDataPoint[] {
    return this.repo.getVolumeByDate(userId, exerciseId)
  }
}
```

---

## Database Schema (Drizzle)

```typescript
// db/schema.ts
import { sqliteTable, integer, text, } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
})

export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdBy: integer('created_by').references(() => users.id).notNull(),
})

export const userRoutines = sqliteTable('user_routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id).notNull(),
  exerciseId: integer('exercise_id').references(() => exercises.id).notNull(),
  dayOfWeek: text('day_of_week', {
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  }).notNull(),
}, (t) => [
  unique().on(t.userId, t.exerciseId, t.dayOfWeek),
])

export const workoutLogs = sqliteTable('workout_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id).notNull(),
  exerciseId: integer('exercise_id').references(() => exercises.id).notNull(),
  date: text('date').notNull(),
  sets: text('sets').notNull(), // JSON string
})
```

---

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,
    "outDir": "./.next",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "typeRoots": ["./node_modules/@types"],
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "lib": ["es2022", "dom", "dom.iterable"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "app/**/*"],
  "exclude": ["node_modules", ".next", "tests"]
}
```

---

## Notes & Recommendations

### Next.js App Router Integration

Server actions replace traditional controllers. Each feature's `*-server-actions.ts` file exports `'use server'` functions that:
1. Get the DB connection from `config/db.ts`
2. Instantiate the repository implementation
3. Call the use case
4. Return plain data (no framework objects)

This keeps the use case layer framework-agnostic — the same use case could be called from a CLI, cron job, or test without changes.

### better-sqlite3 with Next.js

`better-sqlite3` is synchronous and uses a database instance. Since Next.js can coalesce concurrent requests, wrap the DB in a lazy-initialized singleton:

```typescript
// config/db.ts
import Database from 'better-sqlite3'
import path from 'path'

let db: Database | null = null

export function getDb(): Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'data', 'lifting.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}
```

### Testing Strategy

- **Test interfaces, not implementations** — mock the repository layer, test use cases in isolation
- **Integration tests** — use an in-memory SQLite database (`:memory:`) with real Drizzle queries
- **Server action tests** — test the full stack from server action → use case → repo impl → DB
- **Chart tests** — verify SQL aggregation produces correct volume calculations

### Dependency Injection

Wiring happens in `config/db.ts` and the server action files. Each server action constructs its dependencies:

```typescript
// In a server action:
const db = getDb()
const repo = new SqliteUserRepository(db)
const useCase = new CreateUser(repo)
return useCase.execute(name)
```

For more complex scenarios, consider a simple DI container or factory pattern in `config/`.

### Migration Strategy

Use Drizzle Kit for schema migrations:

```bash
npx drizzle-kit generate   # generates migration files
npx drizzle-kit migrate     # applies migrations
```

Store migrations in `db/migrations/` and apply them on app startup.

### Data Directory

SQLite stores data in a file. Create a `data/` directory at the project root:

```
data/
  └── lifting.db
```

Add `data/` to `.gitignore` — it contains user data, not code.

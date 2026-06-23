# Code Quality Review — Plan

## What We Did

Launched a three-agent workflow to review the `cleanup-1` branch for code quality issues across four principles:

- **DRY** (Don't Repeat Yourself) — duplication of logic, patterns, validation
- **KISS** (Keep It Simple, Stupid) — over-engineering, unnecessary abstraction
- **SOLID** — Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion
- **Clean Architecture** — dependency rule, layer purity, package cohesion, architecture bleed

Three agents reviewed the full codebase in parallel. Each reported findings with severity (High/Medium/Low), file locations, and concrete suggestions.

---

## Agent 1: DRY + KISS Review

**18 findings** — 4 High, 8 Medium, 6 Low

### High
| # | Issue | Location |
|---|-------|----------|
| 1 | Identical try/catch error handling in all 4 `*-server-actions.ts` | `src/features/*/server-actions.ts` |
| 2 | Identical ID value object validation across 3 entity files | `user-entity.ts`, `exercise-entity.ts`, `routine-entity.ts` |
| 3 | Dead import — Ramda `R` imported but unused | `src/features/user/user-entity.ts:1` |
| 4 | Dead exported functions never called | `src/app/plan/utils.ts:14,22,26,31` |

### Medium
| # | Issue | Location |
|---|-------|----------|
| 5 | Repeated ownership check boilerplate in 4 use cases | `exercise/delete-exercise.ts`, `rename-exercise.ts`, `workout/update-workout.ts`, `delete-workout.ts` |
| 6 | Repeated name validation (trim/empty/max-100) in 3 entity files | All entity `create*` factories |
| 7 | Three different cookie-parsing implementations | `today/page.tsx`, `plan/page.tsx`, `progress/page.tsx` |
| 8 | `ChartService` is a pure pass-through — zero added logic | `src/features/chart/chart-service.ts` |
| 9 | Ramda `R.cond` for a simple 3-way range filter | `src/features/chart/chart-repo-impl.ts:35-39` |
| 10 | Identical `findById` Drizzle query pattern across all 5 repo impls | All `*-repo-impl.ts` |
| 11 | `R.map` used where native `.map()` would be clearer | All 5 repo impls, 12+ call sites |

### Low
| # | Issue | Location |
|---|-------|----------|
| 12 | `getExerciseCountForDay` computes all 7 days to return one | `src/app/plan/utils.ts:31-33` |
| 13 | Deeply nested Ramda in `groupByGranularity` | `src/features/chart/chart-utils.ts:35-53` |
| 14 | `R.sum(R.map(...))` pattern in 3 places | `chart-repo-impl.ts`, `chart-utils.ts` |
| 15 | `inAnyRoutine` and `exerciseExists` are identical queries | `routine-repo-impl.ts` |
| 16 | `R.isEmpty` on arrays where `arr.length === 0` is clearer | `workout-repo-impl.ts`, `chart-repo-impl.ts` |
| 17 | Day-of-week mapping duplicated between `routine-entity.ts` and `shared/utils/date.ts` | Both files |
| 18 | `R.values` mixed with native `.map` | `workout-repo-impl.ts:275` |

---

## Agent 2: SOLID Review

**17 findings** — 7 High, 7 Medium, 3 Low

### High
| # | Issue | Principle | Location |
|---|-------|-----------|----------|
| 1 | `UserRepository.delete` silently cascades — destroys users, exercises, routines, workout_logs | SRP | `user-repo-impl.ts:68-74` |
| 2 | `ChartService` is a pass-through with zero domain logic | SRP | `chart-service.ts` |
| 3 | `getUsersUseCase` is a one-liner — two levels of factory indirection for zero behavior | SRP | `get-users.ts:4-10` |
| 4 | Server actions tightly coupled to concrete SQLite repos — can't swap databases or test easily | DIP | All `*-server-actions.ts` |
| 5 | `WorkoutRepository.delete` silently cascades to all workout logs | SRP | (cascade issue) |
| 6 | `findByDayOfWeek` queries 3 tables across 2 aggregates | SRP | `workout-repo-impl.ts:135-190` |
| 7 | `findHistoryByDate` does SQL + unwrapping + JSON parsing + volume calc + grouping — ~70 lines | SRP | `workout-repo-impl.ts:210-279` |

### Medium
| # | Issue | Principle | Location |
|---|-------|-----------|----------|
| 8 | ChartService uses concrete classes, not interfaces | DIP | `chart-server-actions.ts`, `chart-service.ts` |
| 9 | `getTodayExercisesUseCase` depends on 3 repos from 2 features | DIP | `get-today-exercises.ts:7-11` |
| 10 | `ExerciseRepository.inAnyRoutine` queries routine table | DIP | `exercise-repo-impl.ts:104-113` |
| 11 | `RoutineRepository.exists` is unused — dead interface surface | ISP | `routine-repository.ts:11` |
| 12 | `RoutineRepository.exerciseExists` queries exercises table | ISP | `routine-repo-impl.ts:129-138` |
| 13 | `WorkoutRepository` interface is bloated — mixes CRUD with complex queries | ISP | `workout-repository.ts:3-23` |
| 14 | `WorkoutLog` type duplicated — incompatible structures in `types.ts` vs `workout-entity.ts` | DIP | `types.ts:7-15`, `workout-entity.ts:3-11` |

### Low
| # | Issue | Principle |
|---|-------|-----------|
| 15 | `ChartService` — vacuous abstraction, no extension point | OCP |
| 16 | `findAllByUserGroupedByDay` returns string-keyed Record — fragile contract | OCP |
| 17 | No middleware/interceptor for cross-cutting concerns in server actions | OCP |

---

## Agent 3: Clean Architecture Review

**21 findings** — 5 High, 10 Medium, 6 Low

### High
| # | Issue | Location |
|---|-------|----------|
| 1 | Chart entity imports `WorkoutSet` from workout feature — creates chart → workout dependency | `chart-entity.ts:1` |
| 2 | Workout server actions import from 3 feature repo impls — wires up infrastructure for other features | `workout-server-actions.ts:5,12` |
| 3 | `RoutineRepository.exerciseExists` queries exercises table — cross-feature coupling | `routine-repository.ts:12` |
| 4 | `ExerciseRepository.inAnyRoutine` queries user_routines table — cross-feature coupling | `exercise-repository.ts:11` |
| 5 | Redundant `ChartService` layer — pass-through wrapper | `chart-service.ts` |

### Medium
| # | Issue | Location |
|---|-------|----------|
| 6 | Server actions import `getDatabase` directly — couples features to infrastructure | All `*-server-actions.ts` |
| 7 | Server actions import concrete impls, not interfaces — all `createSqliteXxxRepository` | All `*-server-actions.ts` |
| 8 | `getTodayExercisesUseCase` depends on 3 repos from 2 features | `get-today-exercises.ts` |
| 9 | Day-of-week mapping duplicated in 3 places | `date.ts`, `routine-entity.ts`, `plan/utils.ts` |
| 10 | Type mismatch — `getUserRoutineUseCase` return type says `Record<number>` but runtime is `Record<string>` | `get-user-routine.ts:6` |
| 11 | Duplicate `WorkoutLog` types — two incompatible definitions | `types.ts`, `workout-entity.ts` |
| 12 | `findByDayOfWeek` in WorkoutRepository queries user_routines table | `workout-repository.ts:11` |
| 13 | `SqliteChartRepository` uses class pattern — inconsistent with factory functions | `chart-repo-impl.ts:52` |
| 14 | chart-server-actions uses `new` — inconsistent with rest of codebase | `chart-server-actions.ts:14,24,32,41,50` |
| 15 | `calculateVolume` called in data layer — domain logic leaking into repo impl | `workout-repo-impl.ts:269` |

### Low
| # | Issue | Location |
|---|-------|----------|
| 16 | `formatDate` duplicated in HistoryPageClient vs shared/utils | `HistoryPageClient.tsx:79-84` |
| 17 | Dead import — `calculateVolume` imported but unused | `HistoryPageClient.tsx:7` |
| 18 | DAYS array duplicated — plan/page.tsx and plan/utils.ts | Both files |
| 19 | Redundant validation — server action validates name, use case also validates | `user-server-actions.ts:13-15` |
| 20 | `plan/utils.ts` contains business logic in `app/` directory | `src/app/plan/utils.ts` |
| 21 | `findHistoryByDate` does heavy aggregation — query method masquerading as find | `workout-repo-impl.ts:210-279` |

---

## Convergence Analysis

Several issues were flagged by **all three agents** — these are the strongest candidates for action:

| Issue | DRY | SOLID | Clean Arch |
|-------|-----|-------|------------|
| ChartService is a zero-value pass-through | Medium #8 | High #2, Low #15 | High #5 |
| Server actions depend on concrete SQLite repos | — | High #4, Medium #8 | High #2, Medium #6, #7 |
| Cross-feature repo queries (exercise↔routine) | — | Medium #10, #12 | High #3, #4 |
| Silent cascade deletes | — | High #1, #5 | — |
| Day-of-week mapping duplicated in 3 places | Low #17 | — | Medium #9 |
| Duplicate WorkoutLog types | — | Medium #14 | Medium #11 |

---

## Next Step: Make a Decision

The results are in. Before any fixes, we need to decide on a strategy:

**Option A — Quick wins (1-2 hours):**
- Delete `ChartService` (flagged by all 3 agents)
- Remove dead imports/code (DRY #3, #4, Clean Arch #17)
- Consolidate day-of-week mapping (DRY #17, Clean Arch #9)
- Deduplicate cookie parsing (DRY #7)
- Fix WorkoutLog type duplication (SOLID #14, Clean Arch #11)

**Option B — Architectural fixes (half-day):**
- Extract shared error wrapper for server actions (DRY #1)
- Create `requireOwnership` helper (DRY #5)
- Extract shared ID factory (DRY #2)
- Move `plan/utils.ts` business logic into features/ (Clean Arch #20)
- Consolidate `findById` pattern (DRY #10)

**Option C — Structural changes (full day+):**
- Add repository factory/dependency injection (SOLID #4)
- Split `WorkoutRepository` — separate CRUD from queries (SOLID #13, Clean Arch #12)
- Fix silent cascade deletes — explicit orchestration (SOLID #1)
- Resolve cross-feature repo queries (SOLID #10/#12, Clean Arch #3/#4)
- Move `getTodayExercisesUseCase` to a dedicated `today` feature module (Clean Arch #8)

**Recommendation:** Start with Option A to build momentum and eliminate clear wins, then tackle Option B items that overlap with Clean Architecture fixes. Save Option C for a dedicated refactor sprint — those changes are high-risk and should be done carefully with tests.

> **Decision needed:** Which option(s) to pursue? Or should we pick individual findings regardless of grouping?

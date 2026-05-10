# Full Picture: Design Tune-Up — UI Redesign, Recharts Migration, Today Page Refactor

This PR is a design tune-up across the kachalka fitness tracking app. It replaces the custom bar chart on the progress page with Recharts, adds time aggregation (session/week/month), introduces a debounced auto-save pattern on the today page, refactors the history page layout, simplifies the user selection and config flows, and adds a chart feature layer with repository, service, and server-action abstractions.

---

## Table of Contents

1. [System 1: Chart Feature — Progress Page Data Pipeline](#system-1-chart-feature--progress-page-data-pipeline)
2. [System 2: Today Page — Exercise Logging with Debounced Auto-Save](#system-2-today-page--exercise-logging-with-debounced-auto-save)
3. [System 3: History Page — Session Cards with Aggregate Metrics](#system-3-history-page--session-cards-with-aggregate-metrics)
4. [System 4: User Selection & Config Simplification](#system-4-user-selection--config-simplification)
5. [The Change: What's Different](#the-change-whats-different)

---

## System 1: Chart Feature — Progress Page Data Pipeline

### Purpose

Fetches workout log data from SQLite, groups it by date/exercise, optionally aggregates across time granularities (session/week/month), and renders it as a Recharts bar chart on the progress page. Supports per-exercise and all-exercises views.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  User selects exercise + range/granularity on ProgressPage       │
│  (progress/page.tsx)                                             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  ProgressPage useEffect                                          │
│  • selectedExerciseId === null → getAllExerciseChartData()       │
│  • selectedExerciseId set → getExerciseChartData()               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Server Actions (chart-server-actions.ts)                        │
│  • getExerciseChartData(userId, exerciseId, range, granularity)  │
│  • getAllExerciseChartData(userId, range, granularity)           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  ChartService (chart-service.ts)                                 │
│  • getExerciseProgress(userId, exerciseId, range, granularity)   │
│  • getAllExercisesProgress(userId, range, granularity)           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  SqliteChartRepository (chart-repo-impl.ts)                      │
│  🎯 WHERE THIS PR CHANGES 🎯                                     │
│  • exerciseId can be null → query all exercises                  │
│  • innerJoin exercises table for name                            │
│  • applyDateFilter with 6M/1Y/ALL range                          │
│  • groupByGranularity for session/week/month                     │
│  (BEFORE: exerciseId required, no granularity, no join)          │
│  (AFTER: exerciseId optional, granularity supported, join added) │
└─────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  chart-utils.ts — groupByGranularity                             │
│  🎯 NEW FILE                                                     │
│  • session → group by date key                                   │
│  • week → ISO week key (YYYY-Www)                                │
│  • month → YYYY-MM key                                           │
│  • Sums volume, merges exercises, sorts chronologically          │
└─────────────────────────────────────────────────────────────────┘
```

### Function Walkthrough

**Start:** [**ProgressPage useEffect**](src/app/progress/page.tsx#L160) - Triggers data fetch on exercise/range/granularity change

**Server Action:** [**getExerciseChartData**](src/features/chart/chart-server-actions.ts#L7) - Accepts `granularity?: TimeGranularity`, passes through to service

**Service:** [**ChartService.getExerciseProgress**](src/features/chart/chart-service.ts#L13) - Delegates to repo with new `granularity` param

**🎯 The Change:** [**SqliteChartRepository.getVolumeByDate**](src/features/chart/chart-repo-impl.ts#L59) - Now accepts `exerciseId?: number | null`, `range?: RangeFilter`, `granularity?: TimeGranularity`

- **BEFORE:** `exerciseId: number` required, `range: '1M' | '3M' | '6M' | 'ALL'`, no granularity
- **AFTER:** `exerciseId?: number | null` optional, `range: RangeFilter` (`'6M' | '1Y' | 'ALL'`), `granularity: TimeGranularity`
- **Impact:** Enables all-exercises aggregation, new range options, and time-based grouping

**Deep Dive:** [**mapRowToDataPoint**](src/features/chart/chart-repo-impl.ts#L11) - Now includes `exercises: [{ name, sets }]` in return shape

- **BEFORE:** `{ date, volume, sets }`
- **AFTER:** `{ date, volume, sets, exercises: [{ name: row.exerciseName, sets }] }`
- **Impact:** Tooltip can show per-exercise breakdown

**🎯 The Change:** [**groupByGranularity**](src/features/chart/chart-utils.ts#L18) - NEW function that groups data points by session/week/month

- Groups by date key (exact date, ISO week, or month)
- Sums volume within each group
- Merges exercises by name with concatenated sets
- Returns `ChartBarData[]` sorted chronologically

**Entity:** [**ChartDataPoint**](src/features/chart/chart-entity.ts#L3) - Now includes `exercises` field alongside `sets`

**Downstream:** [**ProgressPage chart rendering**](src/app/progress/page.tsx#L186) - Recharts `BarChart` with custom tooltip showing exercise-level detail

---

## System 2: Today Page — Exercise Logging with Debounced Auto-Save

### Purpose

Displays scheduled exercises for the current day. Each exercise can be logged in-place (no modal) with per-exercise state management, past-session view toggle, and debounced auto-save to the database.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  TodayPage component renders ExerciseCard for each exercise      │
│  (today/page.tsx)                                                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Per-exercise state (Map-based)                                  │
│  • viewModes: Map<exerciseId, 'past' | 'current'>               │
│  • exerciseSets: Map<exerciseId, WorkoutSet[]>                   │
│  • savingExercises: Set<exerciseId>                              │
│  • errors: Map<exerciseId, string>                               │
│  • debounceTimersRef: Map<exerciseId, Timeout>                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  ExerciseCard sub-component (extracted from TodayPage)           │
│  🎯 WHERE THIS PR CHANGES 🎯                                     │
│  • Renders past view (read-only lastLog) or current view (edit)  │
│  • Toggle button switches view mode                              │
│  • Add/Set/Remove buttons trigger debounced save                 │
│  (BEFORE: single modal for all exercises)                        │
│  (AFTER: inline editing per exercise)                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  triggerSave(exerciseId) → debouncedSave(exerciseId)            │
│  • Clears existing timer, sets new 500ms timer                  │
│  • debouncedSave: filters empty sets, calls logWorkoutAction     │
│  • On success: refreshes exercises from server                  │
│  • On error: sets per-exercise error message                    │
└─────────────────────────────────────────────────────────────────┘
```

### Function Walkthrough

**Entry:** [**TodayPage**](src/app/(main)/today/page.tsx#L170) - Loads exercises on mount, manages per-exercise state

**🎯 The Change:** [**ExerciseCard**](src/app/(main)/today/page.tsx#L181) - NEW sub-component extracted from TodayPage

- **BEFORE:** All exercise rendering + modal logic in TodayPage (500+ lines)
- **AFTER:** ExerciseCard handles per-exercise rendering, past/current toggle, inline set editing
- **Impact:** TodayPage reduced from ~500 lines to ~200; each exercise is independently editable

**State management:** [**getSets**](src/app/(main)/today/page.tsx#L225) / [**updateSets**](src/app/(main)/today/page.tsx#L232) / [**triggerSave**](src/app/(main)/today/page.tsx#L245) - Map-based state helpers

**🎯 The Change:** [**debouncedSave**](src/app/(main)/today/page.tsx#L257) - NEW debounced save function

- Filters out sets where both weight and reps are 0
- Calls `logWorkoutAction` with valid sets
- Refreshes exercises on success, sets error on failure
- **Impact:** Users no longer need to manually save; changes persist automatically

**Toggle:** [**handleToggleView**](src/app/(main)/today/page.tsx#L280) - Switches between past/current view, clears exerciseSets for fresh state

---

## System 3: History Page — Session Cards with Aggregate Metrics

### Purpose

Displays workout history grouped by date. Each date group shows exercises as clickable buttons with set/reps/max weight metrics, and aggregate session-level metrics (total volume, total sets, total reps).

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  HistoryPageClient renders history data                          │
│  (history/HistoryPageClient.tsx)                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  For each date group:                                            │
│  • Aggregate totalVolume, totalSets, totalReps across exercises  │
│  • Render exercise buttons with per-exercise metrics             │
│  • Aggregate metric cards (volume, sets, reps)                   │
│  • Tap exercise → set detail modal                               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  🎯 WHERE THIS PR CHANGES 🎯                                     │
│  • BEFORE: Each exercise in its own card with delete button      │
│  • AFTER: All exercises in one session card, metrics aggregated  │
│  • Removed per-exercise delete button (moved elsewhere?)         │
│  • Date badge replaced session badge                             │
│  • Modal shows date badge instead of session number              │
└─────────────────────────────────────────────────────────────────┘
```

### Function Walkthrough

**Entry:** [**HistoryPageClient**](src/app/(main)/history/HistoryPageClient.tsx#L81) - Renders loading, empty, and history states

**🎯 The Change:** [**date group rendering**](src/app/(main)/history/HistoryPageClient.tsx#L119) - Session card redesign

- **BEFORE:** Each exercise in its own card with volume/sets/intensity grid and delete button
- **AFTER:** All exercises in one card; per-exercise buttons show sets/reps/max; aggregate row shows total volume/sets/reps
- **Impact:** Cleaner visual hierarchy; exercise-level delete removed

**Metric calculation:** [**totalVolume**](src/app/(main)/history/HistoryPageClient.tsx#L122) / [**totalSets**](src/app/(main)/history/HistoryPageClient.tsx#L123) / [**totalReps**](src/app/(main)/history/HistoryPageClient.tsx#L124) - Aggregated across all exercises in the date group

---

## System 4: User Selection & Config Simplification

### Purpose

Simplifies the user selection page and removes the config page entirely, consolidating navigation to 4 tabs.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  UserSelectionClient (user-selection.client.tsx)                 │
│  🎯 WHERE THIS PR CHANGES 🎯                                     │
│  • BEFORE: Grid layout with UserCard + QuickAddCard + bottom    │
│    NewRecruitButton                                              │
│  • AFTER: Vertical layout with compact NewRecruitButton in      │
│    header area, simplified UserCard (name only, no stats)       │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Config page (config/page.tsx)                                   │
│  🎯 DELETED FILE                                                 │
│  • Account section, delete account, quick links removed          │
│  • Bottom nav CONFIG tab removed                                 │
│  • Header account link now points to / instead of /config        │
└─────────────────────────────────────────────────────────────────┘
```

### Function Walkthrough

**Entry:** [**UserSelectionClient**](src/app/components/user-selection.client.tsx#L26) - Renders user selection with compact NewRecruitButton

**🎯 The Change:** [**UserCard**](src/app/components/user-selection.client.tsx#L56) - Simplified from detailed card to name-only button

- **BEFORE:** `isActive` prop, initials badge, level label, total load/max squat stats
- **AFTER:** Just the user name, centered, larger text
- **Impact:** Less visual clutter; stats likely belong in profile page

**Deleted:** [**QuickAddCard**](src/app/components/user-selection.client.tsx#L77) - Entire component removed

**Deleted:** [**config/page.tsx**](src/app/config/page.tsx#L1) - 182 lines removed, entire config page gone

---

## The Change: What's Different

### Files Changed

**Chart Feature (new infrastructure):**
1. [**chart-entity.ts**](src/features/chart/chart-entity.ts#L3) - Added `ChartBarData`, `RangeFilter`, `TimeGranularity`, `ExerciseInfo` types; added `exercises` field to `ChartDataPoint`
2. [**chart-utils.ts**](src/features/chart/chart-utils.ts#L1) - NEW FILE: `groupByGranularity` function with ISO week/month key derivation
3. [**chart-repo-impl.ts**](src/features/chart/chart-repo-impl.ts#L11) - `mapRowToDataPoint` exports + adds exercises; `getVolumeByDate` accepts optional exerciseId, granularity; `getPeakVolume` and `getIntensitySplit` accept optional exerciseId
4. [**chart-repository.ts**](src/features/chart/chart-repository.ts#L1) - Interface: `exerciseId?: number | null`, `range?: RangeFilter`, `granularity?: TimeGranularity`
5. [**chart-service.ts**](src/features/chart/chart-service.ts#L1) - Added `getAllExercisesProgress`; optional exerciseId on `getPeakVolume`/`getIntensitySplit`
6. [**chart-server-actions.ts**](src/features/chart/chart-server-actions.ts#L7) - Added `getAllExerciseChartData`; optional exerciseId on actions
7. [**chart-entity.test.ts**](src/features/chart/chart-entity.test.ts#L1) - NEW FILE: compile-time type tests
8. [**chart-repo-impl.test.ts**](src/features/chart/chart-repo-impl.test.ts#L1) - NEW FILE: `mapRowToDataPoint` and `SqliteChartRepository` tests
9. [**range-filter.test.ts**](src/features/chart/range-filter.spec.ts#L1) - NEW FILE: `RangeFilter` type test
10. [**time-granularity.spec.ts**](src/features/chart/time-granularity.spec.ts#L1) - NEW FILE: `TimeGranularity` type test
11. [**chart-utils.spec.ts**](src/features/chart/chart-utils.spec.ts#L1) - NEW FILE: `groupByGranularity` behavior tests

**Progress page:**
12. [**progress/page.tsx**](src/app/progress/page.tsx#L1) - Recharts migration, granularity pills, range pill change, removed stat cards, all-exercises path

**Today page:**
13. [**today/page.tsx**](src/app/(main)/today/page.tsx#L1) - ExerciseCard extraction, Map-based state, debounced auto-save, past/current toggle

**History page:**
14. [**history/HistoryPageClient.tsx**](src/app/(main)/history/HistoryPageClient.tsx#L81) - Session card redesign, aggregate metrics, tap-to-expand modal

**User selection:**
15. [**user-selection.client.tsx**](src/app/components/user-selection.client.tsx#L1) - Layout simplification, compact NewRecruitButton, removed QuickAddCard

**Config deletion:**
16. [**config/page.tsx**](src/app/config/page.tsx#L1) - DELETED: account management, quick links, delete account
17. [**header.tsx**](src/app/components/header.tsx#L1) - Removed `'use client'`, changed config link to home link
18. [**bottom-nav.tsx**](src/app/components/bottom-nav.tsx#L1) - Removed CONFIG tab

**Other:**
19. [**new-recruit-button.tsx**](src/app/components/new-recruit-button.tsx#L1) - Added compact variant
20. [**layout.tsx**](src/app/(main)/layout.tsx#L1) - Added `id="main-layout"`
21. [**app/layout.tsx**](src/app/layout.tsx#L1) - Added `id="app-main"`
22. [**profile/page.tsx**](src/app/(main)/profile/page.tsx#L1) - Added debug IDs
23. [**package.json**](package.json#L19) - Added `recharts` dependency
24. [**.gitignore**](.gitignore#L28) - Added `screenshots/` and `.playwright-mcp/`
25. [**seed-bruno-data.js**](scripts/seed-bruno-data.js#L1) - NEW FILE: seed Bruno's workout data
26. [**seed-workout-data.js**](scripts/seed-workout-data.js#L1) - NEW FILE: seed Brodie's workout data

**Test files (pattern updates):**
27-38. Various test files updated: `vi.fn() as any` pattern, `WorkoutSet` now has `id`, `Number()` casting for `lastInsertRowid`

**Plan docs (non-code):**
39. [**Plan-1.md**](Plan-1.md#L1) - Today page styling plan
40. [**Plan-2.md**](Plan-2.md#L1) - Recharts migration plan
41. [**Plan-3.md**](Plan-3.md#L1) - Progress page refinement plan
42. [**TASKS-PLAN-2.md**](TASKS-PLAN-2.md#L1) - TDD task list for Recharts migration

**Images (non-code):**
43-58. Progress page screenshots (16 PNG files)

### Why Multiple Changes

This is a coordinated design tune-up across the entire app:
- **Progress page** needed a charting library swap (Recharts) and new aggregation features, requiring a full chart feature layer
- **Today page** needed a UX improvement (inline editing + auto-save) to replace the modal workflow
- **History page** needed a visual redesign to consolidate session cards
- **Config page** was removed as part of navigation simplification
- **User selection** was simplified to match the new design language
- All pages received `id` attributes for debugging/automation

### Key Concepts

**RangeFilter:** `'6M' | '1Y' | 'ALL'` — replaced old `'1M' | '3M' | '6M' | 'ALL'`. The 1M/3M options were removed in favor of time aggregation (session/week/month) which provides finer control.

**TimeGranularity:** `'session' | 'week' | 'month'` — new pill selector on progress page that groups data points by date, ISO week, or calendar month.

**Debounce:** `DEBOUNCE_MS = 500` — changes on today page auto-save after 500ms of inactivity, preventing database spam while keeping data persistent.

**Map-based state:** Today page uses `Map<number, WorkoutSet[]>` instead of a single `WorkoutSet[]` state, enabling per-exercise editing without cross-exercise state leakage.

### Tests Updated

- [**chart-entity.test.ts**](src/features/chart/chart-entity.test.ts#L1) - Type shape tests for `ChartBarData`, `ExerciseInfo`, `ChartDataPoint`
- [**chart-repo-impl.test.ts**](src/features/chart/chart-repo-impl.test.ts#L1) - `mapRowToDataPoint` and `SqliteChartRepository` behavior
- [**range-filter.spec.ts**](src/features/chart/range-filter.spec.ts#L1) - `RangeFilter` type accept/reject tests
- [**time-granularity.spec.ts**](src/features/chart/time-granularity.spec.ts#L1) - `TimeGranularity` type accept/reject tests
- [**chart-utils.spec.ts**](src/features/chart/chart-utils.spec.ts#L1) - `groupByGranularity` behavior: session/week/month grouping, volume summation, exercise merging, sorting
- [**env.spec.ts**](tests/config/env.spec.ts#L1) - `process.env` type casting
- [**exercise/*.spec.ts**](tests/features/exercise/create-exercise.spec.ts#L1) - `vi.fn() as any` pattern
- [**workout/*.spec.ts**](tests/features/workout/log-workout.spec.ts#L1) - `WorkoutSet.id` field, `vi.fn() as any` pattern
- [**routine/routine-repo-impl.spec.ts**](tests/features/routine/routine-repo-impl.spec.ts#L1) - `Number()` casting for `lastInsertRowid`
- [**user/user-repo-impl.spec.ts**](tests/features/user/user-repo-impl.spec.ts#L1) - Added exercise/routine/workout table schemas to migration

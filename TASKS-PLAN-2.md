# Plan-2 TDD Task List — Recharts Migration + Time Aggregation

## Phase 0: Project Setup

### Task 1: Install recharts dependency
- Add `recharts` to package.json dependencies
- Install and verify `npm install recharts` succeeds

---

## Phase 1: Entity Layer — New Types (chart-entity.ts)

### Task 2: Write test — `ChartBarData` type exists with correct shape
- Create `chart-entity.test.ts`
- Write test asserting the exported type `ChartBarData` has properties: `date: string`, `volume: number`, `tooltipData?: object`
- Since these are TypeScript types (compile-time), the test verifies the type can be imported without error and a sample object conforms

### Task 3: Write `ChartBarData` type
- Add `ChartBarData` interface/type to `chart-entity.ts`
  - `date: string` (YYYY-MM-DD, YYYY-Www, or YYYY-MM)
  - `volume: number`
  - `tooltipData?: { sets: WorkoutSet[]; totalVolume: number }`

### Task 4: Write test — `RangeFilter` type updated to `'6M' | '1Y' | 'ALL'`
- Test that old range values `'1M'` and `'3M'` are not assignable to the new type
- Verify new type accepts `'6M'`, `'1Y'`, `'ALL'`

### Task 5: Update `RangeFilter` type
- Replace `'1M' | '3M' | '6M' | 'ALL'` with `'6M' | '1Y' | 'ALL'` in `chart-entity.ts`

### Task 6: Write test — `TimeGranularity` type is exported
- Verify `TimeGranularity` type is exported and accepts `'session'`, `'week'`, `'month'`
- Verify it rejects invalid strings

### Task 7: Write `TimeGranularity` type
- Add `TimeGranularity = 'session' | 'week' | 'month'` to `chart-entity.ts`

---

## Phase 2: Granularity Aggregation Utility (chart-utils.ts)

### Task 8: Write test — `groupByGranularity` groups session data as-is
- Create `chart-utils.test.ts`
- Write test: given an array of `{date, volume}` entries all with the same date, `groupByGranularity(data, 'session')` returns them unchanged (single date key)

### Task 9: Write test — `groupByGranularity` groups into ISO week keys
- Write test: given data spanning multiple dates within the same ISO week, `groupByGranularity(data, 'week')` groups them under a `YYYY-Www` key with summed volume

### Task 10: Write test — `groupByGranularity` groups into month keys
- Write test: given data spanning multiple dates within the same calendar month, `groupByGranularity(data, 'month')` groups them under a `YYYY-MM` key with summed volume

### Task 11: Write test — `groupByGranularity` sums volume within each group
- Write test: entries in the same group have their `volume` fields summed

### Task 12: Write test — `groupByGranularity` returns data sorted chronologically
- Write test: output array is sorted ascending by date key

### Task 13: Write `groupByGranularity` function
- Implementation in new `chart-utils.ts`:
  - `'session'`: group by `date` as-is, sum volume per date
  - `'week'`: derive ISO week key (`YYYY-Www`), sum volume per week
  - `'month'`: derive month key (`YYYY-MM`), sum volume per month
  - Returns `ChartBarData[]` with `tooltipData` containing the original sets

### Task 14: Write test — ISO week key derivation is correct across year boundaries
- Write test: dates at end of December and start of January produce correct ISO week keys (e.g., 2024-12-30 might be W1 of 2025)

### Task 15: Update `groupByGranularity` for ISO week year boundary correctness
- Ensure ISO week year matches the week's Thursday (not just calendar year)
- Re-run Task 14 test to verify

---

## Phase 3: Repository Layer — Updated Interface (chart-repository.ts)

### Task 16: Write test — `ChartRepository` interface accepts optional `exerciseId` and `granularity`
- Create integration test or mock test verifying the interface accepts `exerciseId?: number | null` and `granularity?: TimeGranularity`
- Verify the return type is `ChartBarData[]`

### Task 17: Update `ChartRepository` interface
- Add overload or optional params: `getVolumeByDate(userId, exerciseId?, range?, granularity?)` returning `ChartBarData[]`
- Keep backward-compatible signature where exerciseId was required

### Task 18: Write test — `getPeakVolume` accepts optional `exerciseId` for all-exercises path
- Update the interface test or add separate test for `getPeakVolume(userId, exerciseId?)` returning number

### Task 19: Update `getPeakVolume` interface
- Make `exerciseId` optional in `ChartRepository` interface

---

## Phase 4: Repository Implementation (chart-repo-impl.ts)

### Task 20: Write test — `getVolumeByDate` with exerciseId=null returns all-exercise aggregate
- Create `chart-repo-impl.test.ts`
- Use in-memory SQLite setup
- Write test: seed workout logs for 2 different exercises on same date, call `getVolumeByDate(userId, null, 'ALL')`, expect single aggregated entry with summed volume

### Task 21: Write `getVolumeByDate` — all-exercises query path
- In `SqliteChartRepository`, modify `getVolumeByDate` to accept `exerciseId?: number | null`
- When `exerciseId` is null, remove exercise filter from the WHERE clause
- Still filter by `userId`

### Task 22: Write test — `getVolumeByDate` with exerciseId provided returns filtered results
- Seed logs for exercise A and exercise B
- Call `getVolumeByDate(userId, exerciseAId, 'ALL')`
- Verify only exercise A data returned

### Task 23: Update `getVolumeByDate` — keep exerciseId filter when provided
- When exerciseId is truthy, apply the existing WHERE clause filter

### Task 24: Write test — `getVolumeByDate` with granularity='session' returns per-date grouping
- Seed 3 logs on 3 distinct dates, call with granularity 'session', verify 3 result entries

### Task 25: Update `getVolumeByDate` — apply `groupByGranularity` before returning
- Pass results through `groupByGranularity` with the provided granularity

### Task 26: Write test — `getVolumeByDate` with granularity='week' aggregates into weeks
- Seed logs spanning 2 weeks, call with granularity 'week', verify 2 result entries with summed volume per week

### Task 27: Write test — `getVolumeByDate` with granularity='month' aggregates into months
- Seed logs spanning 2 months, call with granularity 'month', verify 2 result entries

### Task 28: Update `applyDateFilter` — support `'6M' | '1Y' | 'ALL'`
- Replace old range handling:
  - `'6M'` → 180 days
  - `'1Y'` → 365 days  
  - `'ALL'` → no filter
- Keep backward compat for old values during transition (or just update since the types change)

### Task 29: Write test — `applyDateFilter` with `'6M'` filters 180 days
- Seed data spanning 200 days, call with `'6M'`, verify only 180 days of data returned

### Task 30: Write test — `applyDateFilter` with `'1Y'` filters 365 days
- Seed data spanning 400 days, call with `'1Y'`, verify only 365 days of data returned

### Task 31: Write test — `applyDateFilter` with `'ALL'` returns all data
- Seed arbitrary data, call with `'ALL'`, verify no filtering

### Task 32: Update `getPeakVolume` to accept optional `exerciseId`
- When `exerciseId` is null, query all exercises and find the single highest-volume log across all exercises
- Return the peak volume

### Task 33: Write test — `getPeakVolume` with exerciseId=null returns global peak
- Seed different volumes across exercises, call with null, verify highest single workout volume returned

### Task 34: Update `getIntensitySplit` to accept optional `exerciseId`
- When exerciseId is null, return empty array (no intensity split makes sense for aggregate view)

### Task 35: Write test — `getIntensitySplit` with exerciseId=null returns empty array
- Verify empty array returned for all-exercises path

---

## Phase 5: Service Layer (chart-service.ts)

### Task 36: Write test — `getExerciseProgress` accepts `granularity` parameter
- Create `chart-service.test.ts`
- Mock repository, call `getExerciseProgress` with granularity, verify it's passed through

### Task 37: Update `getExerciseProgress` signature
- Add `granularity?: TimeGranularity` parameter
- Pass granularity to repo call

### Task 38: Write test — `getExerciseProgress` groups results by granularity
- Mock repo returns ungrouped data, service test verifies granularity parameter reaches the repo

### Task 39: Write test — `getAllExercisesProgress` returns aggregate data
- Mock repo returns data for exerciseId=null
- Verify `getAllExercisesProgress` calls repo with null exerciseId

### Task 40: Write `getAllExercisesProgress` method
- New method: `getAllExercisesProgress(userId, range?, granularity?)` 
- Calls `repo.getVolumeByDate(userId, null, range, granularity)`

### Task 41: Write test — `getPeakVolume` accepts optional exerciseId
- Verify service passes optional exerciseId through to repo

### Task 42: Update `getPeakVolume` signature
- Make exerciseId optional

---

## Phase 6: Server Actions (chart-server-actions.ts)

### Task 43: Write test — `getExerciseChartData` accepts granularity parameter
- Since server actions are async functions, write a test that invokes the action with granularity and verifies the returned data shape is `ChartBarData[]`

### Task 44: Update `getExerciseChartData` server action
- Add `granularity?: TimeGranularity` parameter
- Pass through to service

### Task 45: Write test — `getAllExerciseChartData` returns aggregated data
- Write test that invokes `getAllExerciseChartData` and verifies it returns `ChartBarData[]`

### Task 46: Write `getAllExerciseChartData` server action
- New action: `(userId, range?, granularity?)` → `ChartBarData[]`
- Uses `service.getAllExercisesProgress()`

### Task 47: Write test — `getPeakVolumeAction` accepts optional exerciseId
- Test that calling with null returns a number (global peak)

### Task 48: Update `getPeakVolumeAction` 
- Make exerciseId optional, pass through to service

### Task 49: Write test — `getIntensitySplitAction` with null exerciseId returns empty array
- Verify empty array for all-exercises path

### Task 50: Update `getIntensitySplitAction`
- Make exerciseId optional

---

## Phase 7: Progress Page — UI Restructuring (progress/page.tsx)

### Task 51: Write test — Progress page renders exercise selector always visible
- Use @testing-library/react to render ProgressPage
- Verify exercise select element is present (not gated behind selectedExerciseId)

### Task 52: Add exercise selector to always be visible
- Remove the `selectedExerciseId` guard from the exercise dropdown section

### Task 53: Write test — Progress page renders range pills (6M/1Y/ALL)
- Verify pill buttons with text "6M", "1Y", "ALL" are rendered
- Verify 6M pill is the active/default selected one

### Task 54: Update range pills — new options and default
- Replace `1M/3M/6M/ALL` pills with `6M/1Y/ALL`
- Change `range` state type from `'1M' | '3M' | '6M' | 'ALL'` to `'6M' | '1Y' | 'ALL'`
- Set default to `'6M'`

### Task 55: Write test — Progress page renders granularity pills (SESSION/WEEK/MONTH)
- Verify pill buttons with text "SESSION", "WEEK", "MONTH" are rendered
- Verify SESSION pill is the active/default selected one

### Task 56: Add granularity pill selector
- Add `granularity` state: `'session' | 'week' | 'month'`, default `'session'`
- Add pill-style selector alongside/below range pills
- Same styling as existing range pills

### Task 57: Write test — Progress page chart renders when no exercise selected (all-exercises path)
- Select no exercise (empty select)
- Verify chart section renders and calls `getAllExerciseChartData`

### Task 58: Remove `selectedExerciseId` guard around chart section
- Chart section should render when there's data regardless of exercise selection
- When no exercise selected and data exists, call `getAllExerciseChartData` via server action

### Task 59: Write test — Progress page shows "LOG WORKOUTS" when all-exercises path has no data
- Select no exercise, verify empty state shows "LOG WORKOUTS TO SEE PROGRESSION"

### Task 60: Update all-exercises empty state
- When no exercise selected and no data: show "LOG WORKOUTS TO SEE PROGRESSION" message
- Keep existing "NO DATA YET" for when exercise IS selected but has no data

### Task 61: Wire up state changes to trigger data reloads
- Add `granularity` and `range` to the `useEffect` dependency for data loading
- Call appropriate server action based on whether exercise is selected

---

## Phase 8: Progress Page — Recharts Chart Component

### Task 62: Write test — CustomTooltip component renders date, total volume, and individual sets
- Create `progress.test.tsx`
- Render CustomTooltip with sample `ChartBarData`
- Verify tooltip shows date formatted, total volume, and individual set details (`reps x weight`)

### Task 63: Write CustomTooltip component
- Custom Recharts Tooltip component
- Shows: date (formatted), total volume, and each set's `reps x weight`
- Matches existing military aesthetic (same borders, colors, fonts)

### Task 64: Write test — BarChart section renders with Recharts when data is present
- Render ProgressPage with mock data
- Verify Recharts `ResponsiveContainer` is rendered
- Verify `BarChart` component renders with `Bar` using `dataKey="volume"`

### Task 65: Replace custom bar chart with Recharts `BarChart`
- Remove all custom div-based bar rendering logic
- Add `<ResponsiveContainer>` wrapper
- Add `<BarChart>` with `<XAxis>`, `<YAxis>`, `<Tooltip>`, `<Bar>`
- X-axis: `dataKey="date"` with rotated ticks in session mode
- Y-axis: `dataKey="volume"`
- Tooltip: `CustomTooltip`
- Bar: `dataKey="volume"` with `fill` using the existing primary color

### Task 66: Extract primary color value for Recharts bar fill
- Since Tailwind classes don't work inside Shadow DOM (Recharts tooltip), extract the primary color as a CSS variable or hex value
- Use `#64D2FF` or the actual primary color from Tailwind config

### Task 67: Write test — Recharts chart responds to granularity changes
- Render page, verify changing granularity from session→week→month updates chart data and bars

### Task 68: Wire granularity state to chart data transformation
- When granularity changes, call appropriate server action with new granularity
- Update chart data accordingly

---

## Phase 9: Progress Page — Conditional Stats Cards

### Task 69: Write test — Intensity split card hidden when no exercise selected
- Render page with no exercise selected
- Verify intensity split section is NOT rendered

### Task 70: Hide intensity split card when no exercise selected
- Add `selectedExerciseId` check around intensity split card rendering

### Task 71: Write test — Peak volume card shows all-exercises peak when no exercise selected
- Render page with no exercise selected but with data
- Verify peak volume card renders with global peak

### Task 72: Show peak volume card for all-exercises path
- Keep peak volume card rendering when no exercise selected
- Call `getPeakVolume(userId, null)` for global peak

### Task 73: Write test — Commander's Intel card adapts for all-exercises path
- Render page with all-exercises path and sufficient data
- Verify intel card shows appropriate message

### Task 74: Adapt Commander's Intel for all-exercises path
- Keep existing intel card logic for all three states (no data, insufficient, ok)
- Ensure it renders when no exercise is selected but data exists

### Task 75: Hide secondary progression card when no exercise selected
- Add `selectedExerciseId` check around secondary progression card

---

## Phase 10: Integration Tests & Polish

### Task 76: Write integration test — full all-exercises flow with Recharts
- Render ProgressPage, select no exercise, set range to 1Y, granularity to week
- Verify chart renders with correctly aggregated data

### Task 77: Write integration test — full per-exercise flow with Recharts
- Render ProgressPage, select an exercise, set range to 6M, granularity to session
- Verify chart renders with per-exercise data

### Task 78: Clean up — remove old range values from all files
- Verify no references to `'1M'` or `'3M'` remain in the codebase
- Verify all type usages match `'6M' | '1Y' | 'ALL'`

### Task 79: Clean up — remove old custom bar chart code
- Verify no remnants of the div-based bar chart remain
- Confirm only Recharts components used in chart rendering

### Task 80: Final verification — run typecheck and tests
- Run `npm run typecheck` — should pass with zero errors
- Run `npm test` — should pass all tests

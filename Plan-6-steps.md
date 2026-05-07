# Plan-6 Deconstruction: Tiny TDD Steps

Each function gets its own TDD cycle: write test → write function → review function.

## PHASE 1 — chart-entity.ts (types + factories)

### Step 1: Test `ChartDataPoint` type has correct fields
**Test file:** `tests/features/chart/chart-entity.spec.ts`
**Source:** `src/features/chart/chart-entity.ts`
**Details:** Compile-time type check — function accepts `ChartDataPoint`, assert it has `date` (YYYY-MM-DD), `volume` (number), `sets` (WorkoutSet[]).

### Step 2: Test `IntensitySplit` type has correct fields
**Test file:** `tests/features/chart/chart-entity.spec.ts`
**Source:** `src/features/chart/chart-entity.ts`
**Details:** Compile-time type check — `IntensitySplit` has `type` (string) and `percentage` (number 0–100).

### Step 3: Test `emptyChartDataPoint()` returns zero-volume point with defaults
**Test file:** `tests/features/chart/chart-entity.spec.ts`
**Source:** `src/features/chart/chart-entity.ts`
**Details:** Assert `volume === 0`, `sets === []`, `date === '1970-01-01'`.

### Step 4: Test `emptyChartDataPoint(date)` accepts explicit date
**Test file:** `tests/features/chart/chart-entity.spec.ts`
**Source:** `src/features/chart/chart-entity.ts`
**Details:** Pass `'2025-06-15'`, assert date matches, volume still 0.

### Step 5: Test `createChartDataPoint()` aggregates sets into volume
**Test file:** `tests/features/chart/chart-entity.spec.ts`
**Source:** `src/features/chart/chart-entity.ts`
**Details:** Sets `[reps:5,weight:100],[reps:3,weight:120]` → volume = 860.

### Step 6: Test `volumeOfPoint()` helper extracts volume from ChartDataPoint
**Test file:** `tests/features/chart/chart-entity.spec.ts`
**Source:** `src/features/chart/chart-entity.ts`
**Details:** Given point with volume 860, assert returns 860. Exists for Ramda compatibility.

### Step 7: Test `sumVolumes()` sums ChartDataPoints
**Test file:** `tests/features/chart/chart-entity.spec.ts`
**Source:** `src/features/chart/chart-entity.ts`
**Details:** Volumes 860, 950, 0 → sum 1810. Empty array → 0.

## PHASE 2 — chart-repository.ts (interface)

### Step 8: Test `ChartRepository` interface — `getVolumeByDate` returns array
**Test file:** `tests/features/chart/chart-repository.spec.ts`
**Source:** `src/features/chart/chart-repository.ts`
**Details:** Mock satisfies interface. `getVolumeByDate(userId, exerciseId, range?)` → `ChartDataPoint[]`.

### Step 9: Test `getPeakVolume` returns number
**Test file:** `tests/features/chart/chart-repository.spec.ts`
**Source:** `src/features/chart/chart-repository.ts`
**Details:** Returns `number`, not `undefined` — repo returns 0 when no data.

### Step 10: Test `getIntensitySplit` returns `IntensitySplit[]`
**Test file:** `tests/features/chart/chart-repository.spec.ts`
**Source:** `src/features/chart/chart-repository.ts`
**Details:** Returns array of `{type, percentage}` objects.

### Step 11: Test `getExercisesWithLogs` returns `{id, name}[]`
**Test file:** `tests/features/chart/chart-repository.spec.ts`
**Source:** `src/features/chart/chart-repository.ts`
**Details:** Returns exercises with logged data, ordered by name.

### Step 12: Test `getVolumeByDate` optional range parameter
**Test file:** `tests/features/chart/chart-repository.spec.ts`
**Source:** `src/features/chart/chart-repository.ts`
**Details:** Range type is `string` (or `'1M'|'3M'|'6M'|'ALL'`), parameter is optional.

## PHASE 3 — chart-repo-impl.ts (SQLite implementation)

### Step 13: Test in-memory DB setup — tables created, connection works
**Test file:** `tests/features/chart/chart-repo-impl.spec.ts`
**Source:** `src/features/chart/chart-repo-impl.ts`
**Details:** Create DB with user/exercise/workout_logs tables, insert row, query returns it. Placeholder implementation.

### Step 14: Test `getVolumeByDate` — single date, single set, volume correct
**Test file:** `tests/features/chart/chart-repo-impl.spec.ts`
**Source:** `src/features/chart/chart-repo-impl.ts`
**Details:** Sets `[reps:5,weight:100]` → volume 500. SQL uses `json_extract` + `SUM` + `GROUP BY date`.

### Step 15: Test `getVolumeByDate` — multiple sets per log summed correctly
**Test file:** `tests/features/chart/chart-repo-impl.spec.ts`
**Source:** `src/features/chart/chart-repo-impl.ts`
**Details:** 2 sets `[5,100],[3,120]` → volume 860. Confirm SQL handles arbitrary-length sets.

### Step 16: Test `getVolumeByDate` — multiple dates ordered ASC
**Test file:** `tests/features/chart/chart-repo-impl.spec.ts`
**Source:** `src/features/chart/chart-repo-impl.ts`
**Details:** Dates `01-15, 01-01, 01-08` → returned order `01-01, 01-08, 01-15`. `ORDER BY date ASC`.

### Step 17: Test `getVolumeByDate` — range `1M` excludes old dates (>30 days)
**Test file:** `tests/features/chart/chart-repo-impl.spec.ts`
**Source:** `src/features/chart/chart-repo-impl.ts`
**Details:** Insert log 60 days ago + 10 days ago → only recent appears. `WHERE date >= date('now','-30 days')`.

### Step 18: Test `getVolumeByDate` — range `3M` (90d) and `6M` (180d) and `ALL`
**Test file:** `tests/features/chart/chart-repo-impl.spec.ts`
**Source:** `src/features/chart/chart-repo-impl.ts`
**Details:** 3M excludes >90d, 6M excludes >180d, ALL returns everything.

### Step 19: Test `getVolumeByDate` — no logs returns empty array
**Test file:** `tests/features/chart/chart-repo-impl.spec.ts`
**Source:** `src/features/chart/chart-repo-impl.ts`
**Details:** Empty table → `[]`.

### Step 20: Test `getVolumeByDate` — filter by exercise for multi-exercise user
**Test file:** `tests/features/chart/chart-repo-impl.spec.ts`
**Source:** `src/features/chart/chart-repo-impl.ts`
**Details:** User has 2 exercises, only exercise 1 has logs. Query `exerciseId=1` → only exercise 1 data. `WHERE exercise_id = ?`.

### Step 21: Test `getPeakVolume` — returns max volume across dates
**Test file:** `tests/features/chart/chart-repo-impl.spec.ts`
**Source:** `src/features/chart/chart-repo-impl.ts`
**Details:** Volumes 500, 860, 720 → returns 860. `MAX` of volume aggregation.

### Step 22: Test `getPeakVolume` — returns 0 when no logs
**Test file:** `tests/features/chart/chart-repo-impl.spec.ts`
**Source:** `src/features/chart/chart-repo-impl.ts`
**Details:** Empty → returns 0. `COALESCE(MAX(...), 0)`.

### Step 23: Test `getIntensitySplit` — CLASSIFY sets, compute percentages
**Test file:** `tests/features/chart/chart-repo-impl.spec.ts`
**Source:** `src/features/chart/chart-repo-impl.ts`
**Details:** 3 sets: one highest volume = TOP SET, rest = VOLUME SET. Percentages: each set vol / total vol * 100.

### Step 24: Test `getIntensitySplit` — returns empty when no logs
**Test file:** `tests/features/chart/chart-repo-impl.spec.ts`
**Source:** `src/features/chart/chart-repo-impl.ts`
**Details:** Empty → `[]`.

### Step 25: Test `getExercisesWithLogs` — exercises WITH logs only
**Test file:** `tests/features/chart/chart-repo-impl.spec.ts`
**Source:** `src/features/chart/chart-repo-impl.ts`
**Details:** 2 exercises, 1 has logs → only exercised-with-logs returned. `JOIN workout_logs DISTINCT`.

### Step 26: Test `getExercisesWithLogs` — returns empty when no logs
**Test file:** `tests/features/chart/chart-repo-impl.spec.ts`
**Source:** `src/features/chart/chart-repo-impl.ts`
**Details:** No logs → `[]`.

### Step 27: Test `getExercisesWithLogs` — all 3 with logs, ordered by name
**Test file:** `tests/features/chart/chart-repo-impl.spec.ts`
**Source:** `src/features/chart/chart-repo-impl.ts`
**Details:** 3 exercised exercises → all 3 returned, ordered by name ASC.

## PHASE 4 — chart-service.ts (use case layer)

### Step 28: Test `chartServiceUseCase(repo)` returns service with methods
**Test file:** `tests/features/chart/chart-service.spec.ts`
**Source:** `src/features/chart/chart-service.ts`
**Details:** Mock repo → service object with `getExerciseProgress`, `getPeakVolume`, `getIntensitySplit`.

### Step 29: Test `getExerciseProgress` returns data sorted by date ASC
**Test file:** `tests/features/chart/chart-service.spec.ts`
**Source:** `src/features/chart/chart-service.ts`
**Details:** Unsorted input → sorted output. Ramda `orderBy` or native sort.

### Step 30: Test `getExerciseProgress` passes range through to repo
**Test file:** `tests/features/chart/chart-service.spec.ts`
**Source:** `src/features/chart/chart-service.ts`
**Details:** Call with `'3M'` → repo's `getVolumeByDate` called with `'3M'`.

### Step 31: Test `getExerciseProgress` empty → empty
**Test file:** `tests/features/chart/chart-service.spec.ts`
**Source:** `src/features/chart/chart-service.ts`
**Details:** Mock `[]` → returns `[]`.

### Step 32: Test `getPeakVolume` delegates to repo
**Test file:** `tests/features/chart/chart-service.spec.ts`
**Source:** `src/features/chart/chart-service.ts`
**Details:** Mock returns 860 → service returns 860.

### Step 33: Test `getIntensitySplit` delegates to repo
**Test file:** `tests/features/chart/chart-service.spec.ts`
**Source:** `src/features/chart/chart-service.ts`
**Details:** Mock returns array → service returns same array.

## PHASE 5 — chart-server-actions.ts (server action wrappers)

### Step 34: Test `getExercisesWithLogsAction` success path
**Test file:** `tests/features/chart/chart-server-actions.spec.ts`
**Source:** `src/features/chart/chart-server-actions.ts`
**Details:** Mock all imports → `{success: true, exercises: [...]}`. Uses dynamic `vi.mock` pattern.

### Step 35: Test `getExercisesWithLogsAction` error path
**Test file:** `tests/features/chart/chart-server-actions.spec.ts`
**Source:** `src/features/chart/chart-server-actions.ts`
**Details:** Mock throws → `{success: false, error: '...'}`. Error extraction: `instanceof Error ? message : 'Unknown error'`.

### Step 36: Test `getExerciseChartData` success with data
**Test file:** `tests/features/chart/chart-server-actions.spec.ts`
**Source:** `src/features/chart/chart-server-actions.ts`
**Details:** Mock returns data points → `{success: true, data: [...]}`.

### Step 37: Test `getExerciseChartData` empty data
**Test file:** `tests/features/chart/chart-server-actions.spec.ts`
**Source:** `src/features/chart/chart-server-actions.ts`
**Details:** Mock `[]` → `{success: true, data: []}`.

### Step 38: Test `getExerciseChartData` error path
**Test file:** `tests/features/chart/chart-server-actions.spec.ts`
**Source:** `src/features/chart/chart-server-actions.ts`
**Details:** Mock throws → `{success: false, error: '...'}`.

### Step 39: Test `getPeakVolumeAction` returns number
**Test file:** `tests/features/chart/chart-server-actions.spec.ts`
**Source:** `src/features/chart/chart-server-actions.ts`
**Details:** Mock returns 860 → `{success: true, peakVolume: 860}`.

### Step 40: Test `getPeakVolumeAction` error path
**Test file:** `tests/features/chart/chart-server-actions.spec.ts`
**Source:** `src/features/chart/chart-server-actions.ts`
**Details:** Mock throws → `{success: false, error: '...'}`.

### Step 41: Test `getIntensitySplitAction` returns split array
**Test file:** `tests/features/chart/chart-server-actions.spec.ts`
**Source:** `src/features/chart/chart-server-actions.ts`
**Details:** Mock returns splits → `{success: true, splits: [...]}`.

### Step 42: Test `getIntensitySplitAction` error path
**Test file:** `tests/features/chart/chart-server-actions.spec.ts`
**Source:** `src/features/chart/chart-server-actions.ts`
**Details:** Mock throws → `{success: false, error: '...'}`.

## PHASE 6 — progress/page.tsx (client component)

### Step 43: Test ProgressChartPage renders without crashing
**Test file:** `tests/app/progress/page.spec.tsx`
**Source:** `src/app/progress/page.tsx`
**Details:** `'use client'` component. Render → no errors, DOM visible.

### Step 44: Test Exercise dropdown renders with default selection
**Test file:** `tests/app/progress/page.spec.tsx`
**Source:** `src/app/progress/page.tsx`
**Details:** `<select>` element exists in DOM. Neo-brutalist Tailwind styling.

### Step 45: Test Exercise dropdown populates from `getExercisesWithLogsAction`
**Test file:** `tests/app/progress/page.spec.tsx`
**Source:** `src/app/progress/page.tsx`
**Details:** `useEffect` on mount → calls action → sets state. 3 exercises → 3 options.

### Step 46: Test "NO DATA YET" when no exercises have logs
**Test file:** `tests/app/progress/page.spec.tsx`
**Source:** `src/app/progress/page.tsx`
**Details:** Empty array → shows "NO DATA YET" message, chart area hidden. Neo-brutalist empty state with icon.

### Step 47: Test Time range pills render with correct default
**Test file:** `tests/app/progress/page.spec.tsx`
**Source:** `src/app/progress/page.tsx`
**Details:** Pills: 1M, 3M, 6M, ALL. "1M" active by default. Active pill gets `bg-primary`.

### Step 48: Test Clicking pill switches active range, refetches data
**Test file:** `tests/app/progress/page.spec.tsx`
**Source:** `src/app/progress/page.tsx`
**Details:** Click "3M" → active state changes, `useEffect` fires, chart data refetches.

### Step 49: Test Bar chart renders one bar per data point
**Test file:** `tests/app/progress/page.spec.tsx`
**Source:** `src/app/progress/page.tsx`
**Details:** Mock 3 data points → 3 bar elements. Bar height proportional to volume.

### Step 50: Test Bar chart tooltip on hover — date, sets, total volume
**Test file:** `tests/app/progress/page.spec.tsx`
**Source:** `src/app/progress/page.tsx`
**Details:** Hover bar → tooltip showing date, individual sets (reps x weight), total session volume.

### Step 51: Test Peak volume card — "ALL TIME PEAK: {number}"
**Test file:** `tests/app/progress/page.spec.tsx`
**Source:** `src/app/progress/page.tsx`
**Details:** Card displays peak volume number from `getPeakVolumeAction`.

### Step 52: Test Intensity split card — percentage bars per type
**Test file:** `tests/app/progress/page.spec.tsx`
**Source:** `src/app/progress/page.tsx`
**Details:** Card shows percentage bars for each intensity type.

### Step 53: Test Commander's Intel card — dynamic insight text
**Test file:** `tests/app/progress/page.spec.tsx`
**Source:** `src/app/progress/page.tsx`
**Details:** Warning icon + insight text (e.g., "INCREASE VOLUME TO SEE PROGRESSION" when flatlined).

### Step 54: Test Secondary Progression card — "NO DATA FOR ESTIMATED 1RM"
**Test file:** `tests/app/progress/page.spec.tsx`
**Source:** `src/app/progress/page.tsx`
**Details:** Placeholder card for estimated 1RM section.

### Step 55: Test Bento grid layout — chart + cards arranged correctly
**Test file:** `tests/app/progress/page.spec.tsx`
**Source:** `src/app/progress/page.tsx`
**Details:** Bar chart top, peak/split/Intel cards below in grid layout.

### Step 56: Test Loading state during data fetch
**Test file:** `tests/app/progress/page.spec.tsx`
**Source:** `src/app/progress/page.tsx`
**Details:** `useState` for loading → spinner or skeleton during initial fetch.

### Step 57: Test Mobile tooltip tap behavior
**Test file:** `tests/app/progress/page.spec.tsx`
**Source:** `src/app/progress/page.tsx`
**Details:** Touch tap on bar → tooltip shows (since mobile has no hover).

## PHASE 7 — config/page.tsx (client component)

### Step 58: Test ConfigPage renders without crashing
**Test file:** `tests/app/config/page.spec.tsx`
**Source:** `src/app/config/page.tsx`
**Details:** `'use client'` component. Render → no errors.

### Step 59: Test Account section displays current user name from cookie
**Test file:** `tests/app/config/page.spec.tsx`
**Source:** `src/app/config/page.tsx`
**Details:** User name rendered from cookie.

### Step 60: Test Delete account button renders with destructive styling
**Test file:** `tests/app/config/page.spec.tsx`
**Source:** `src/app/config/page.tsx`
**Details:** Neo-brutalist destructive style button.

### Step 61: Test Delete account opens confirmation dialog
**Test file:** `tests/app/config/page.spec.tsx`
**Source:** `src/app/config/page.tsx`
**Details:** Click delete → browser confirmation dialog.

### Step 62: Test Confirm delete calls server action, clears cookie, redirects
**Test file:** `tests/app/config/page.spec.tsx`
**Source:** `src/app/config/page.tsx`
**Details:** Confirm → server action → cookie cleared → redirect to `/`.

### Step 63: Test Quick links section — link to Profile ("MY BATTLE PLAN")
**Test file:** `tests/app/config/page.spec.tsx`
**Source:** `src/app/config/page.tsx`
**Details:** Link to `/profile` labeled "MY BATTLE PLAN".

### Step 64: Test Quick links section — link to Progress page
**Test file:** `tests/app/config/page.spec.tsx`
**Source:** `src/app/config/page.tsx`
**Details:** Link to `/progress`.

## PHASE 8 — Navigation updates

### Step 65: Verify PROGRESS nav tab links to `/progress`
**Test file:** `tests/app/components/bottom-nav.spec.tsx` (or manual verify)
**Source:** `src/app/components/bottom-nav.tsx`
**Details:** Tab with `href: '/progress'` already present. Confirm it's there.

### Step 66: Verify account icon in header links to `/config`
**Source:** `src/app/components/header.tsx`
**Details:** Wrap `account_circle` icon with `<Link href="/config">`.

## PHASE 9 — Integration

### Step 67: Full test suite pass — no regressions
**Details:** `npm test` or `pnpm test` — all existing + new tests green.

### Step 68: Dev server smoke test on /progress and /config
**Details:** Start dev server, visit `/progress` and `/config`, verify UI renders and interacts correctly.

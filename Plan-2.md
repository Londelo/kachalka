## WHAT

Replace the custom-built bar chart on the progress page with Recharts, add time aggregation (session/week/month), support aggregate session-level volume when no exercise is selected, and update range pills to 6M/1Y/ALL with 6M default.

Files to change:
- [package.json](package.json)
- [src/features/chart/chart-entity.ts](src/features/chart/chart-entity.ts)
- [src/features/chart/chart-repository.ts](src/features/chart/chart-repository.ts)
- [src/features/chart/chart-repo-impl.ts](src/features/chart/chart-repo-impl.ts)
- [src/features/chart/chart-service.ts](src/features/chart/chart-service.ts)
- [src/features/chart/chart-server-actions.ts](src/features/chart/chart-server-actions.ts)
- [src/app/progress/page.tsx](src/app/progress/page.tsx)

## HOW

### [package.json](package.json)

Install `recharts` dependency.

### [src/features/chart/chart-entity.ts](src/features/chart/chart-entity.ts)

Add a new chart data type for grouped/aggregated data:

```
ChartBarData
  • date: string — the date key (YYYY-MM-DD for session, YYYY-Www for week, YYYY-MM for month)
  • volume: number — aggregated volume for that period
  • tooltipData? — optional detailed tooltip payload
```

Update `RangeFilter` type to support new values: `'6M' | '1Y' | 'ALL'`

Add `TimeGranularity` type: `'session' | 'week' | 'month'`

### [src/features/chart/chart-repository.ts](src/features/chart/chart-repository.ts)

Update the repository interface:

```
getVolumeByDate(userId, exerciseId, range, granularity)
  • exerciseId can be null — when null, aggregates across ALL exercises for the user
  • granularity determines grouping: 'session' = per date, 'week' = per ISO week, 'month' = per month
  • range still applies: '6M' | '1Y' | 'ALL'
  • returns ChartBarData[]
```

### [src/features/chart/chart-repo-impl.ts](src/features/chart/chart-repo-impl.ts)

Update `getVolumeByDate()`:

When `exerciseId` is null:
- Query all workout logs for the user (no exerciseId filter)
- Group by date, sum volume per date
- Apply range filter
- Return as ChartBarData[]

When `exerciseId` is provided:
- Keep existing logic (query by userId + exerciseId)
- Group by date, sum volume per date
- Apply range filter
- Return as ChartBarData[]

Add time granularity logic:
```
aggregateByGranularity(dataPoints, granularity)
  • 'session': use date as-is, sum volume per unique date
  • 'week': derive ISO week key (YYYY-Www), sum volume per week
  • 'month': derive month key (YYYY-MM), sum volume per month
```

Update `applyDateFilter()` to support `'6M' | '1Y' | 'ALL'`:
- `'6M'`: 180 days
- `'1Y'`: 365 days
- `'ALL'`: no filter

### [src/features/chart/chart-service.ts](src/features/chart/chart-service.ts)

Update `getExerciseProgress()` signature to accept `granularity` parameter.

Add a new method:
```
getAllExercisesProgress(userId, range, granularity)
  • Wraps repo.getVolumeByDate with exerciseId=null
  • Returns ChartBarData[] for all exercises aggregated
```

### [src/features/chart/chart-server-actions.ts](src/features/chart/chart-server-actions.ts)

Update `getExerciseChartData()` to accept `granularity` parameter and pass it through.

Add `getAllExerciseChartData(userId, range, granularity)` server action for the no-exercise-selected path.

### [src/app/progress/page.tsx](src/app/progress/page.tsx)

**State changes:**
- Add `granularity` state: `'session' | 'week' | 'month'`, default `'session'`
- Change `range` state type from `'1M' | '3M' | '6M' | 'ALL'` to `'6M' | '1Y' | 'ALL'`, default `'6M'`

**Exercise dropdown:**
- Remove the `selectedExerciseId` guard around the chart section
- When no exercise selected, call `getAllExerciseChartData()` instead
- Exercise dropdown should always be visible

**Time granularity selector:**
- Add a pill-style selector for session/week/month alongside or above the range pills
- Three pills: SESSION, WEEK, MONTH
- Same styling as existing range pill buttons

**Range pills:**
- Change from `1M/3M/6M/ALL` to `6M/1Y/ALL`
- Default selected: `6M`
- Always visible (not gated behind `selectedExerciseId`)

**Chart rendering:**
- Replace the custom div-based bar chart with Recharts `BarChart`
- Use `Bar` component with `data` prop pointing to aggregated data
- X-axis: date labels (rotated if session mode with many dates)
- Y-axis: volume numbers
- Tooltip: show date, total volume, and breakdown details
- Responsive container: `ResponsiveContainer`
- Color scheme: keep existing `primary` color styling

**Recharts structure:**
```
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={dataPoints}>
    <XAxis dataKey="date" tick={{ ... }} />
    <YAxis dataKey="volume" tick={{ ... }} />
    <Tooltip content={CustomTooltip} />
    <Bar dataKey="volume" fill="#..." />
  </BarChart>
</ResponsiveContainer>
```

**Empty/Loading states:**
- Keep existing loading state
- When no exercise selected and no data: show "LOG WORKOUTS TO SEE PROGRESSION" message
- When exercise selected and no data: keep existing empty state

## WHY

The custom bar chart is fragile, hard to maintain, and lacks features like tooltips, responsiveness, and accessibility. Recharts is the most popular React-native charting library with a simple API, active maintenance, and zero external dependencies beyond React. This swap unblocks the feature work: aggregate session-level data, time aggregation, and a better UX overall.

## QUESTIONS

**For you to answer:**
  • ~~For the tooltip on Recharts, should we show the same detail as before (individual sets: `reps x weight`) or just date + total volume?~~ → Show same detail as before (individual sets: `reps x weight`) + total volume.
  • ~~Should the time granularity selector be styled as pills (matching existing range pills) or a dropdown?~~ → Pill-style matching existing range pills.
  • ~~For the "all exercises" view, should we still show the intensity split and peak volume cards? If so, peak volume across all exercises or per-exercise?~~ → Show peak volume across all exercises. Hide intensity split when no exercise is selected (doesn't make sense without a specific exercise).

**You can ask me:**
  • "How should the Recharts tooltip match the existing military aesthetic?"
  • "What happens to intensity split when no exercise is selected?"
  • "Should we animate the bars on load?"

## CRITIQUES

  • The repository layer now handles both per-exercise and aggregate queries — consider splitting into separate methods for clarity
  • ISO week calculation needs to be consistent across the repo (use a single utility function)
  • The granularity logic (session/week/month) lives in the repository but could also belong in the service layer — service layer is cleaner since it's data transformation, not data access
  • Recharts' responsive container may need a fixed height fallback for narrow mobile screens
  • The existing `1M/3M` range options being removed means users lose fine-grained short-term filtering — this may be intentional given the shift to time aggregation

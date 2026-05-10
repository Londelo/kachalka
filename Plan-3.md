## WHAT

Refactor the progress page chart to support exercise-level tooltip display and fix UI issues: active filter button styling, exercise dropdown default, and remove unnecessary stat containers.

Files to change:
- [src/app/progress/page.tsx](src/app/progress/page.tsx)
- [src/features/chart/chart-entity.ts](src/features/chart/chart-entity.ts)
- [src/features/chart/chart-repo-impl.ts](src/features/chart/chart-repo-impl.ts)
- [src/features/chart/chart-utils.ts](src/features/chart/chart-utils.ts)
- [src/features/chart/chart-entity.test.ts](src/features/chart/chart-entity.test.ts)
- [src/features/chart/range-filter.test.ts](src/features/chart/range-filter.test.ts)

## HOW

### [src/features/chart/chart-entity.ts](src/features/chart/chart-entity.ts)

Refactor `ChartDataPoint` to preserve exercise grouping:

```
Replace sets: WorkoutSet[] with:
  sets: WorkoutSet[]        // kept for chart rendering (flat volume)
  exercises: { name: string; sets: WorkoutSet[] }[]  // grouped by exercise

  If no exerciseId filter (all exercises), name = "All Exercises"
  If exerciseId filter, name = the exercise name
```

### [src/features/chart/chart-repo-impl.ts](src/features/chart/chart-repo-impl.ts)

Update `mapRowToDataPoint` to include exercise name:

```
mapRowToDataPoint(row)
  • Extract exercise name from row.exercises.name
  • Compute volume from row.sets
  • Return ChartDataPoint with:
    - date, volume, sets (from row)
    - exercises: [{ name: exerciseName, sets: row.sets }]
```

Update `getVolumeByDate` return mapping to include exercises:

```
After groupByGranularity, map each bar to include:
  • date, volume, sets
  • exercises: merge grouped exercises (preserve exercise names and their sets)
```

### [src/features/chart/chart-utils.ts](src/features/chart/chart-utils.ts)

Update `groupByGranularity` to merge exercises instead of flattening sets:

```
groupByGranularity(data, granularity)
  • Group data points by granularity key (date / week / month)
  • For each group:
    - totalVolume = sum of all volumes
    - allSets = flatten all sets (for chart rendering)
    - exerciseMap = merge exercises by name:
      - For each entry in group, spread entry.exercises into exerciseMap
      - If exercise name already exists, append its sets to existing entry
    - exercises = array of exerciseMap entries
  • Return ChartBarData with exercises field
```

### [src/app/progress/page.tsx](src/app/progress/page.tsx)

**Exercise dropdown default (line 137):**
```
Change <option value="">SELECT EXERCISE</option>
  to <option value="">ALL EXERCISES</option>
```

**Active granularity button color (line 176):**
```
Change active class from:
  bg-surface-container-low text-on-surface shadow-[...]
to:
  bg-primary text-on-primary shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]
(same as range pills)
```

**Active granularity button flat styling (line 176):**
```
Remove shadow from active state:
  active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
is already there, but the active class adds shadow back.
Change active class to NOT include shadow:
  bg-primary text-on-primary
(no shadow-[...] in active state)
```

**Tooltip (lines 234-251):**
```
Tooltip content:
  • For each exercise in data.exercises:
    - exercise name
    - totalSets × totalReps (sum of reps across all sets)
    - exercise volume (sum of reps × weight)
  • Total volume at bottom (bold, primary color)
```

**Remove stat containers:**
```
Delete:
  - "All Time Peak" card (lines 268-278)
  - "Commander's Intel" card (lines 309-351)
  - "Secondary Progression" card (lines 354-364)
  - Intensity split card (lines 281-306)
```

## WHY

The progress page needs to display exercise-level breakdown in the chart tooltip so users can see which exercises contributed to each bar. The current flat sets array loses exercise grouping when multiple exercises are logged in the same session. Additionally, the UI needs polish: active filter buttons should be visually distinct (red, flat), the exercise dropdown default should be "ALL EXERCISES" not "SELECT EXERCISE", and unnecessary stat containers clutter the page.

## QUESTIONS

**For you to answer:**
  • When showing "total sets × total reps" in the tooltip, should we show the count of sets (e.g., "3 sets") and total reps (e.g., "30 reps") or just the volume?
  • Should the tooltip show individual set details (10×100, 10×100, 10×125) or just aggregated stats?

**You can ask me:**
  • "How should the tooltip handle the case where there are many exercises?"
  • "Should the volume Y-axis label change based on granularity?"
  • "What's the preferred format for the tooltip — compact or detailed?"

## CRITIQUES

  • Adding `exercises` to `ChartDataPoint` is a structural change that ripples through the entire pipeline — consider if a lighter-weight approach (storing exercise name per bar) would suffice
  • The tooltip re-render changes the visual design significantly — need to ensure it matches the app's aesthetic (bold, red, shadow cards)
  • Removing stat containers removes useful info (peak volume, intel) — confirm this is intentional
  • The active button styling change removes the shadow on active — need to ensure it still feels "pressed" with the flat styling

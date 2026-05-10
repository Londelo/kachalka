# Review Proposal - DESIGN-TUNE-UP

## Issues

<details>
<summary><h3>1. Missing 'use client' directive on today page</h3></summary>

**File**: `src/app/(main)/today/page.tsx` line 1

**Problem**: The today page uses `useState`, `useEffect`, `useRef`, and `useRouter` from React and Next.js — all client-side APIs. The file does not declare `'use client'` at the top. In Next.js App Router, components without `'use client'` are server components by default. Server components cannot use React hooks or browser APIs like `document.cookie` (used in `getStoredUserId`). This will cause a runtime error when the page is rendered.

**Solution**: Add `'use client'` as the very first line of the file, before any imports.

**Code**:
```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
...
```

</details>

---

<details>
<summary><h3>2. Accumulator mutation inside Ramda reduce</h3></summary>

**File**: `src/features/chart/chart-utils.ts` line 39

**Problem**: The `groupByGranularity` function uses `R.reduce` to build an exercise map. Inside the reducer callback, `innerAcc[ex.name] = { name: ex.name, sets: [...ex.sets] }` mutates the accumulator object directly. Per core-philosophy.md, mutation is forbidden — the `fp/no-mutation` rule is enforced by ESLint. Ramda `reduce` expects pure functions; mutating the accumulator violates the functional programming contract and can cause issues with frozen objects or in strict mode.

**Solution**: Use immutable updates throughout the reduce. Return a new object with the spread operator instead of mutating `innerAcc`.

**Code**:
```typescript
const exerciseMap = R.reduce(
  (acc, entry) => {
    return R.reduce(
      (innerAcc, ex) => {
        const existing = innerAcc[ex.name]
        if (existing) {
          return {
            ...innerAcc,
            [ex.name]: { name: ex.name, sets: R.concat(existing.sets, ex.sets) },
          }
        }
        return {
          ...innerAcc,
          [ex.name]: { name: ex.name, sets: [...ex.sets] },
        }
      },
      acc,
      entry.exercises,
    )
  },
  {},
  entries,
)
```

</details>

---

<details>
<summary><h3>3. ISO week key year calculation may produce incorrect keys at year boundaries</h3></summary>

**File**: `src/features/chart/chart-utils.ts` line 4

**Problem**: The `toISOWeekKey` function implements ISO 8601 week numbering. The algorithm shifts the date to the Thursday of its week (`date.getDate() + 4 - dayNum`), then derives the week year from the shifted date's `getFullYear()`. However, `yearStart` is calculated from the *original* year's January 1st (line 9: `new Date(date.getFullYear(), 0, 1)`), but `date` has already been modified by the shift on line 8. This means `date.getFullYear()` on line 9 may return a different year than intended for dates near year boundaries (e.g., December 31 falling in week 1 of the next year).

**Solution**: Capture the original year before modifying `date`, or use a well-tested ISO week library. The fix requires computing `yearStart` from the shifted date's year, not the original date's year.

**Code**:
```typescript
function toISOWeekKey(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  // Shift to Thursday of the week
  date.setDate(date.getDate() + 4 - (date.getDay() || 7))
  // Use shifted date's year for both week year and year start
  const isoYear = date.getFullYear()
  const yearStart = new Date(isoYear, 0, 1)
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${isoYear}-W${String(weekNum).padStart(2, '0')}`
}
```

</details>

---

<details>
<summary><h3>4. Tests assert TypeScript types at runtime</h3></summary>

**File**: `src/features/chart/chart-entity.test.ts` line 10

**Problem**: The test file uses `toBeTypeOf('string')`, `toBeTypeOf('number')`, and `expect(sample).toBe('6M')` to verify that values have the correct TypeScript types. Per unit-jest.md, type correctness in TypeScript projects is handled by the compiler — don't test types at runtime. These tests add runtime overhead without providing meaningful signal. The `assertExerciseInfo` and `assertChartDataPoint` functions are no-ops that exist only for compile-time type checking, making the runtime assertions redundant.

**Solution**: Remove the runtime type assertions. Keep only the `@ts-expect-error` comments in `range-filter.spec.ts` which are compile-time only and correctly verify that old range values are no longer assignable. For `chart-entity.spec.ts`, consider removing the file entirely or keeping only the `@ts-expect-error` tests from `range-filter.spec.ts` and `time-granularity.spec.ts`.

</details>

---

<details>
<summary><h3>5. getAllExerciseChartData passes exerciseId as null without service null-check</h3></summary>

**File**: `src/features/chart/chart-service.ts` line 22

**Problem**: The `getAllExercisesProgress` method calls `repo.getVolumeByDate(userId, null, range, granularity)`. While the repository correctly handles `null` exerciseId, the `getIntensitySplit` method (which was removed from the progress page UI) previously relied on a non-null `exerciseId`. If `getIntensitySplit` is called with `null` in the future, it returns `[]` early — but this behavior is not tested. The `getPeakVolume` method also accepts `null` and queries all exercises, which changes its semantics (peak across all exercises vs peak for a specific exercise). This semantic shift should be documented or tested.

**Solution**: Add a test verifying that `getPeakVolume(userId, null)` returns the peak volume across all exercises, and document that the method's behavior changes when `exerciseId` is `null`.

</details>

---

## Nits

<details>
<summary><h3>1. groupByGranularity re-maps result after grouping</h3></summary>

**File**: `src/features/chart/chart-repo-impl.ts` line 87

**Suggestion**: Maybe consider moving the re-mapping logic inside `groupByGranularity` instead of doing a separate `R.map` pass afterward? The grouped result already has all the fields needed (`date`, `volume`, `tooltipData`, `exercises`), so the extra mapping just destructures and reassembles the same shape.

</details>

---

<details>
<summary><h3>2. handleToggleView clears exerciseSets on view change</h3></summary>

**File**: `src/app/(main)/today/page.tsx` line 280

**Suggestion**: Maybe consider keeping the exerciseSets when toggling to past view? Currently, switching to past view deletes the sets from state, meaning any unsaved edits are lost if the user toggles away and back. Keeping the sets would preserve draft state.

</details>

---

<details>
<summary><h3>3. mapRowToDataPoint is exported but only used internally</h3></summary>

**File**: `src/features/chart/chart-repo-impl.ts` line 11

**Suggestion**: Maybe consider removing the `export` keyword? The function is only used within the same file by `getVolumeByDate`. Exporting it exposes an implementation detail that tests mock via `vi.mock`, which could be cleaner with internal mocking.

</details>

---

<details>
<summary><h3>4. R.cond in applyDateFilter could be a plain object lookup</h3></summary>

**File**: `src/features/chart/chart-repo-impl.ts` line 35

**Suggestion**: Maybe consider using a plain object lookup instead of `R.cond` for the range-to-days mapping? It's a simple 2-case mapping (`'6M' → 180`, `'1Y' → 365`) that would read more clearly as `const days = { '6M': 180, '1Y': 365 }[range] ?? 0`.

</details>

---

<details>
<summary><h3>5. toISOWeekKey could use a clarifying comment</h3></summary>

**File**: `src/features/chart/chart-utils.ts` line 7

**Suggestion**: Maybe consider adding a comment explaining the `|| 7` trick for Sunday? It converts `getDay()`'s `0` (Sunday) to `7` so the ISO week algorithm treats Sunday as the last day of the week, which is correct for ISO 8601 but non-obvious to readers unfamiliar with the standard.

</details>

---

<details>
<summary><h3>6. groupByGranularity uses entries[0].date for week/month groups</h3></summary>

**File**: `src/features/chart/chart-utils.ts` line 56

**Suggestion**: Maybe consider using the actual group key (the week key or month key) as the `date` field instead of `entries[0].date`? For week mode, this would produce dates like `2025-W02` instead of `2025-01-06`, making the chart X-axis labels more semantically meaningful. For session mode, `entries[0].date` is correct since the group key equals the date.

</details>

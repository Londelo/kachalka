# Progress Bar Modal — Click-to-Inspect Detail Modal

## Problem

The progress page uses Recharts' built-in `<Tooltip>` triggered on **hover**. We want a **click**-triggered **modal** (like the history page detail modal) that shows richer, aggregated workout data per bar.

## Requirements

### Behavior
- Clicking a bar opens a modal (no tooltip on hover)
- Clicking outside the modal dismisses it
- A **CLOSE** button at the bottom dismisses the modal
- A bar containing multiple sessions (week/month granularity) should **aggregate** data across all sessions — no duplicate exercise entries

### Modal Content (per bar)
| Section | Content |
|---------|---------|
| **Date** | Formatted date at the top (e.g., "W05, 01 APR 2025") |
| **Exercises** | Each exercise with: total sets, total reps, total volume (lbs), max weight from any single set |
| **Footer** | Grand total volume across all exercises + CLOSE button |

### Aggregation example
If a month bar contains 3 sessions of Bench Press (each 3 sets × 10 reps × 10 lbs):
- **Sets:** 9 (3 sessions × 3 sets)
- **Reps:** 30 (3 × 10)
- **Volume:** 30 lbs (9 sets × 10 reps × 10 lbs)
- **Max LB:** 10 (highest single set weight across all sessions)

## Implementation Plan

### 1. Add click state to `ProgressPage`

Replace the hover `<Tooltip>` with:

```tsx
const [selectedBar, setSelectedBar] = useState<DataPoint | null>(null)
```

### 2. Wire bar click to open modal

Use Recharts `<Bar onClick>` or wrap the chart in a `<ReferenceLine>`/`<Cell>` click handler. The simplest approach: use the `onClick` prop on `<Bar>`:

```tsx
<Bar
  dataKey="volume"
  fill="#a20000"
  radius={[4, 4, 0, 0]}
  onClick={(data) => {
    if (data && data.payload) {
      setSelectedBar(data.payload as DataPoint)
    }
  }}
/>
```

### 3. Build the modal component

Create `src/app/progress/ProgressDetailModal.tsx` mirroring the history modal pattern:

```tsx
// Structure
<div id="progress-detail-modal" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
     onClickCapture={(e) => { if (e.target === e.currentTarget) onClose() }}>
  <div className="w-full max-w-lg border-4 border-on-surface bg-background p-6 neo-shadow-lg">

    {/* Date header — matches history modal style */}
    <div className="mb-4">
      <div className="mt-1 border-4 border-on-surface bg-primary px-2 py-0.5 neo-shadow-sm inline-block">
        <span className="font-label-bold text-label-bold uppercase text-on-primary">
          {formatDate(selectedBar.date)}
        </span>
      </div>
    </div>

    {/* Exercise cards — one per exercise in this bar */}
    <div className="mb-6 flex flex-col gap-3">
      {barExercises.map((ex) => (
        <div key={ex.name} className="border-4 border-on-surface bg-surface-container p-4 neo-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="font-headline-md font-black uppercase text-on-surface">
              {ex.name}
            </span>
          </div>
          {/* Metrics grid — 2×2 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="border-4 border-on-surface bg-on-surface p-2 text-center">
              <p className="font-label-mono text-label-mono uppercase text-background">SETS</p>
              <p className="font-headline-sm text-headline-sm font-black text-tertiary-fixed">
                {ex.totalSets}
              </p>
            </div>
            <div className="border-4 border-on-surface bg-on-surface p-2 text-center">
              <p className="font-label-mono text-label-mono uppercase text-background">REPS</p>
              <p className="font-headline-sm text-headline-sm font-black text-tertiary-fixed">
                {ex.totalReps}
              </p>
            </div>
            <div className="border-4 border-on-surface bg-on-surface p-2 text-center">
              <p className="font-label-mono text-label-mono uppercase text-background">VOLUME</p>
              <p className="font-headline-sm text-headline-sm font-black text-tertiary-fixed">
                {ex.totalVolume.toLocaleString()}
              </p>
            </div>
            <div className="border-4 border-on-surface bg-on-surface p-2 text-center">
              <p className="font-label-mono text-label-mono uppercase text-background">MAX LB</p>
              <p className="font-headline-sm text-headline-sm font-black text-tertiary-fixed">
                {ex.maxWeight}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Grand total footer */}
    <div className="border-t-4 border-on-surface pt-4 text-center">
      <p className="font-label-mono text-label-mono uppercase text-secondary">TOTAL VOLUME</p>
      <p className="font-headline-md text-headline-md font-black text-primary">
        {grandTotalVolume.toLocaleString()}
      </p>
    </div>

    {/* Close button */}
    <button
      type="button"
      onClick={() => setSelectedBar(null)}
      className="mt-6 w-full border-4 border-on-surface bg-primary p-3 font-label-bold text-label-bold uppercase text-on-primary neo-shadow transition-all active-press"
    >
      CLOSE
    </button>
  </div>
</div>
```

### 4. Compute per-exercise metrics

Helper inside the page (or extracted to a shared util):

```tsx
function calcExerciseMetrics(exercises: DataPoint['exercises']): {
  name: string
  totalSets: number
  totalReps: number
  totalVolume: number
  maxWeight: number
}[] {
  return exercises.map((ex) => {
    const totalSets = ex.sets.length
    const totalReps = ex.sets.reduce((sum, s) => sum + s.reps, 0)
    const totalVolume = ex.sets.reduce((sum, s) => sum + s.reps * s.weight, 0)
    const maxWeight = ex.sets.length > 0 ? Math.max(...ex.sets.map((s) => s.weight)) : 0
    return { name: ex.name, totalSets, totalReps, totalVolume, maxWeight }
  })
}
```

### 5. Remove the old tooltip

Remove the `<Tooltip>` component from the `<BarChart>` — it's no longer needed. The chart still renders normally; clicking a bar is the only interaction.

### 6. Add E2E tests

Add tests in `tests/e2e/progress-page.spec.ts`:

| Test | Description |
|------|-------------|
| `clicking a bar opens detail modal` | Click a bar → modal appears with `id="progress-detail-modal"` |
| `modal shows date, exercise name, and metrics` | Verify date, exercise name, sets/reps/volume/max lb |
| `modal aggregates data at week granularity` | Create 3 sessions in same week → modal shows summed totals |
| `modal aggregates data at month granularity` | Create sessions in same month → modal shows summed totals |
| `closing modal via close button dismisses it` | Click CLOSE → modal gone |
| `closing modal via backdrop click dismisses it` | Click outside modal → modal gone |
| `modal shows all exercises in ALL mode` | ALL EXERCISES mode → modal lists all exercises in that bar |
| `modal does not open on hover` | Hover chart → no modal (confirming hover no longer triggers anything) |

## Files Changed

| File | Action |
|------|--------|
| `src/app/progress/page.tsx` | Replace `<Tooltip>` with click handler + modal state + modal render |
| `tests/e2e/progress-page.spec.ts` | Add modal E2E tests, update hover-based tooltip tests |

## Visual Reference

The modal follows the same neo-brutalism style as the history modal:
- `border-4 border-on-surface` + `neo-shadow-lg` for the modal container
- `bg-primary` + `neo-shadow-sm` for date badge
- `border-4 border-on-surface bg-on-surface` metric cards
- `bg-primary` CLOSE button with `active-press`
- `bg-black/50` backdrop for click-outside dismissal
- `onClickCapture` with `e.target === e.currentTarget` for backdrop detection

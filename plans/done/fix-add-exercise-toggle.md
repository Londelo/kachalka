# Plan 8 — Toggle Button Inside Modal Header

## WHAT

Move the "ADD EXERCISE / SELECT EXERCISE" toggle from outside the modal into the modal **header row**, as a small square icon button in the **top-right corner**. The modal always opens in **'select'** mode. The button toggles between modes:

- **Select mode** → button shows a **plus** icon (`add`) → clicking switches to New Exercise
- **New mode** → button shows a **back arrow** icon (`arrow_back`) → clicking switches back to Select

## CURRENT STATE

- Toggle button sits below the page content (lines 304–318), outside the modal overlay
- Modal opens in whatever `modalMode` was last set (stale state)
- No way to switch modes from within the modal without closing and reopening

## TARGET STATE

- Modal **always opens in 'select' mode** (reset `modalMode` in `handleAddExistingClick`)
- Modal header is a flex row: title on the left, small square icon button on the right
- Icon button toggles between modes without closing the modal
- The standalone toggle button below the page content is removed

## HOW

### Task 1: Confirm `handleAddExistingClick` resets mode on open

**File:** `src/app/(main)/plan/page.tsx` (lines 186–194)

The function already sets `modalMode` to `'select'` when exercises are available, or `'new'` when none are. **No change needed** — verify this is correct.

### Task 2: Remove the `toggleModalMode` function

**File:** `src/app/(main)/plan/page.tsx` (lines 196–198)

Delete this dead code:

```tsx
function toggleModalMode() {
  setModalMode((prev) => (prev === 'select' ? 'new' : 'select'))
}
```

### Task 3: Remove the standalone toggle button block

**File:** `src/app/(main)/plan/page.tsx` (lines 304–318)

Delete this entire block:

```tsx
{/* Toggle button between select/new modes — always visible when a day is selected */}
{isDaySelected(selectedDay, addingDay, selectedDay) && (
  <div className="mt-4 flex flex-col items-center gap-2">
    <button ...>ADD EXERCISE / SELECT EXERCISE</button>
  </div>
)}
```

After removal, the `</div>` on line 302 (closing `#plan-workspace`) should be followed directly by the modal overlay block.

### Task 4: Add toggle button to Select mode header

**File:** `src/app/(main)/plan/page.tsx` (lines 336–339)

Replace the standalone `<h3>` heading with a flex row:

```tsx
<div className="mb-4 flex items-center justify-between">
  <h3 className="font-headline-md text-headline-md font-black uppercase text-on-surface">
    ASSIGN EXERCISE
  </h3>
  <button
    type="button"
    onClick={() => setModalMode('new')}
    className="flex size-10 shrink-0 items-center justify-center border-2 border-on-surface bg-background font-headline-md uppercase font-bold text-on-surface transition-all active-press"
    aria-label="Create new exercise"
    title="Create new exercise"
  >
    <span className="material-symbols-outlined">add</span>
  </button>
</div>
```

### Task 5: Add toggle button to New mode header

**File:** `src/app/(main)/plan/page.tsx` (lines 395–398)

Replace the standalone `<h3>` heading with the same flex row pattern:

```tsx
<div className="mb-4 flex items-center justify-between">
  <h3 className="font-headline-md text-headline-md font-black uppercase text-on-surface">
    NEW EXERCISE
  </h3>
  <button
    type="button"
    onClick={() => setModalMode('select')}
    className="flex size-10 shrink-0 items-center justify-center border-2 border-on-surface bg-background font-headline-md uppercase font-bold text-on-surface transition-all active-press"
    aria-label="Select existing exercise"
    title="Select existing exercise"
  >
    <span className="material-symbols-outlined">arrow_back</span>
  </button>
</div>
```

### Task 6: Verify no references to `toggleModalMode` remain

Grep the file for `toggleModalMode` — zero references should remain.

### Task 7: Verify modal always opens in select mode

Trace the full flow: user clicks day → modal opens → `modalMode === 'select'` → "ASSIGN EXERCISE" header with `add` icon. Only exception: `availableExercises.length === 0` → `'new'` mode.

## FILES TO CHANGE

- `src/app/(main)/plan/page.tsx` (only file)

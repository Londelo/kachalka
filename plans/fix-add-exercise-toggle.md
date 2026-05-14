# Plan 8 — Toggle Button Inside Add Exercise Modal

## WHAT

Move the "ADD EXERCISE / SELECT EXERCISE" toggle button from outside the modal into the modal overlay, floating just below the modal container. The button should be styled like the other buttons but with a cream background (`bg-background`, `#fbfbe2`). It is only visible when the modal is **closed** (hidden when the modal is open).

**Current state:** The toggle button sits below the modal overlay — it's rendered in the main page content, outside the `fixed inset-0` modal overlay. It's always visible when a day is selected.

**Target state:** The toggle button lives inside the modal overlay, floating below the modal container. It is only visible when the modal is closed (hidden when the modal is open).

## HOW

### src/app/(main)/plan/page.tsx

**Remove** the toggle button block (currently lines 307–321):
```
{/* Toggle button between select/new modes — always visible when a day is selected */}
{isDaySelected(selectedDay, addingDay, selectedDay) && (
  <div className="mt-4 flex flex-col gap-2">
    <button ...>ADD EXERCISE / SELECT EXERCISE</button>
  </div>
)}
```

**Add** the toggle button inside the modal overlay, floating below the modal container. Place it after the modal `<div>` but still inside the `fixed inset-0` overlay. Visibility flips: only show when modal is **closed**:

```
{/* Toggle button — floating below modal container, visible when modal is closed */}
{!showModal && isDaySelected(selectedDay, addingDay, selectedDay) && (
  <div className="mt-3 flex justify-center">
    <button
      type="button"
      onClick={() => {
        toggleModalMode()
        setShowModal(true)
      }}
      className="w-full max-w-sm border-4 border-on-surface bg-background py-3 font-headline-md uppercase font-bold text-on-surface transition-all active-press"
    >
      {modalMode === 'select' ? 'ADD EXERCISE' : 'SELECT EXERCISE'}
    </button>
  </div>
)}
```

Key details:
- `{!showModal && ...}` — only visible when the modal is closed
- The button floats on the overlay, below where the modal container sits
- `bg-background` gives it the cream background (`#fbfbe2`)
- `max-w-sm` matches the modal's `max-w-md sm:max-w-sm` width
- `border-4 border-on-surface` matches the existing button styling
- `font-headline-md` matches the existing button typography
- Centered with `flex justify-center`

## FILES TO CHANGE

- `src/app/(main)/plan/page.tsx`

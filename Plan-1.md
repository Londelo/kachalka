# DESIGN-TUNE-UP: Today Page Button Styling

## Scope
Single file: `src/app/(main)/today/page.tsx`

## Changes

### 1. View Past Toggle Button
- **Current:** `bg-on-surface` (black background), black text, no shadow
- **New:** `bg-surface-container-low` (cream `#f5f5dc`) background, `border-on-surface` (black border), `text-on-surface` (black text), add `neo-shadow` class
- **Line ~69:** Update toggle button className

### 2. "VIEWING PAST" Title Bar
- **Current:** No title shown when in past view mode
- **New:** When `viewMode === 'past'`, render an inline banner/label on the same row as the toggle button saying "VIEWING PAST"
- **Implementation:** Wrap the header div (exercise name + toggle) in a flex row that includes a "VIEWING PAST" badge when in past mode. The badge should be `border-4 border-on-surface bg-surface-container p-2 neo-shadow font-label-bold text-label-bold uppercase text-on-surface`
- **Placement:** Inside the `ExerciseCard` header area, only when `viewMode === 'past'`

### 3. Set Input Rows — Button Style
- **Current:** Weight and reps inputs are transparent with no border/background
- **New:** Each input wrapped in a button-style container: `border-4 border-on-surface bg-surface-container p-2 neo-shadow font-body text-on-surface`
- **Weight input (~line 127):** Add cream background, black border, shadow styling
- **Reps input (~line 139):** Add cream background, black border, shadow styling
- **Delete button (~line 149):** Already looks good per user, leave as-is

### 4. Add Set Button — Red Color
- **Current:** `bg-surface-container` (cream), black text/border
- **New:** `bg-primary` (`#a20000` — the red from design schema), black text/border, shadow
- **Line ~164:** Change background to `bg-primary` and text to `text-on-primary`

## Design Tokens
- Cream: `surface-container-low` = `#f5f5dc`
- Black: `on-surface` = `#1b1d0e`
- Red: `primary` = `#a20000`
- Shadow: `neo-shadow` class (already defined)

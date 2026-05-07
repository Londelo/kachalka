# Plan 4 - Profile Page Redesign (TDD Steps)

## Design Changes Summary

Comparing `docs/mocks/routine.html` to `src/app/profile/page.tsx`:

| Section | Current | New (Mock) |
|---|---|---|
| Hero Header | "PROFILE" + subtitle line | "MY BATTLE PLAN" + "WEEKLY CAMPAIGN ASSIGNMENT" badge |
| Day Selector | 4px border, 5 buttons, justify-between | 7 buttons, 2px border, overflow-x-auto, bg-surface-container-low inactive |
| Exercise Display | All 7 days rendered simultaneously | Exercises only for selected day. Cards: colored left-accent bar, category line, name, close icon button |
| Add Exercise Panel | Inline per-day panel | Standalone "REINFORCE LINEUP" section, bg-surface-container-highest, neo-shadow-lg, bg-background select, "DEPLOY" button |
| Quick-Add Card | N/A | Dashed-border card with add_box icon, "CREATE NEW EXERCISE SPEC" |
| Empty State | "NO EXERCISES ASSIGNED" per empty day | Block icon + "NO ASSIGNMENTS - DEPLOY EXERCISES TO BEGIN YOUR CAMPAIGN" (global) |
| Campaign Logistics | Simple count badge per day header | 7-column grid section "CAMPAIGN LOGISTICS" with exercise counts |

## Architecture Decision

Extract pure utility functions into `src/app/profile/profile-utils.ts` for standalone unit testing. Keep React state logic and component rendering in `page.tsx`. This follows the existing project pattern of extracting testable logic (see `tests/features/user/create-user.test.ts`).

Vitest config uses `environment: 'node'` (no jsdom). Tests target pure functions, not React components - consistent with the project's existing test strategy.

---

## TDD Steps

### Step 1 - getAssignmentsForDay

**Write test first** -> `tests/app/profile/profile-utils.test.ts`

**Function:** `getAssignmentsForDay(routine: RoutineMap | null, dayIndex: number): RoutineAssignment[]`

- `RoutineMap` = `Record<DayName, RoutineAssignment[]>` (same shape as server returns)
- `dayIndex` = 0 (Monday) through 6 (Sunday)
- Returns assignments for the given day; [] if day has none or routine is null
- **Test cases:**
  1. Returns the assignments array for the correct day index
  2. Returns [] when the day key does not exist in routine
  3. Returns [] when routine is null
  4. Returns [] when routine is undefined
  5. Does not return assignments from other days (data isolation)
  6. Returns exact array reference (not mutated copy)

**Then implement** -> `src/app/profile/profile-utils.ts`

---

### Step 2 - getDayName

**Write test first** -> `tests/app/profile/profile-utils.test.ts`

**Function:** `getDayName(dayIndex: number): string`

- 0 -> "Monday", 1 -> "Tuesday", ..., 6 -> "Sunday"
- **Test cases:**
  1. `getDayName(0)` returns "Monday"
  2. `getDayName(3)` returns "Thursday"
  3. `getDayName(6)` returns "Sunday"

**Then implement** -> `src/app/profile/profile-utils.ts`

---

### Step 3 - getDayLabel

**Write test first** -> `tests/app/profile/profile-utils.test.ts`

**Function:** `getDayLabel(dayIndex: number): string`

- Returns short label: 0 -> "MON", 1 -> "TUE", ..., 6 -> "SUN"
- **Test cases:**
  1. `getDayLabel(0)` returns "MON"
  2. `getDayLabel(2)` returns "WED"
  3. `getDayLabel(5)` returns "SAT"
  4. `getDayLabel(6)` returns "SUN"

**Then implement** -> `src/app/profile/profile-utils.ts`

---

### Step 4 - hasAssignments

**Write test first** -> `tests/app/profile/profile-utils.test.ts`

**Function:** `hasAssignments(routine: RoutineMap | null, dayIndex: number): boolean`

- Returns true if the given day has at least one assignment
- **Test cases:**
  1. Returns true when day has 1+ assignments
  2. Returns false when day key is absent
  3. Returns false when routine is null
  4. Returns false when routine is undefined
  5. Returns false when day has an empty array []

**Then implement** -> `src/app/profile/profile-utils.ts`

---

### Step 5 - getExerciseCountPerDay

**Write test first** -> `tests/app/profile/profile-utils.test.ts`

**Function:** `getExerciseCountPerDay(routine: RoutineMap | null): number[]`

- Returns array of exactly 7 numbers: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
- **Test cases:**
  1. Returns [0,0,0,0,0,0,0] when routine is null
  2. Returns [0,0,0,0,0,0,0] when routine is undefined
  3. Returns correct count for a single-day routine
  4. Returns correct counts for all 7 days populated
  5. Counts match actual array lengths in the routine object
  6. Always returns an array of exactly length 7

**Then implement** -> `src/app/profile/profile-utils.ts`

---

### Step 6 - getExerciseCountForDay

**Write test first** -> `tests/app/profile/profile-utils.test.ts`

**Function:** `getExerciseCountForDay(routine: RoutineMap | null, dayIndex: number): number`

- Returns count of assignments for a single day; 0 if none/null
- **Test cases:**
  1. Returns correct count for day with assignments
  2. Returns 0 when routine is null
  3. Returns 0 when routine is undefined
  4. Returns 0 when day has no assignments

**Then implement** -> `src/app/profile/profile-utils.ts`

---

### Step 7 - resolveDaySelection

**Write test first** -> `tests/app/profile/profile-utils.test.ts`

**Function:** `resolveDaySelection(currentSelectedDay: number, currentAddingDay: number | null, clickedDayIndex: number): { nextSelectedDay: number; nextAddingDay: number | null }`

- Mirrors the current day-button click handler logic.
- If `currentSelectedDay === clickedDayIndex` AND `currentAddingDay === null` -> open add panel for that day
- Otherwise -> select the clicked day, close add panel
- **Test cases:**
  1. Selected=0, addingDay=null, clicked=0 -> { nextSelectedDay: 0, nextAddingDay: 0 } (open add)
  2. Selected=0, addingDay=null, clicked=3 -> { nextSelectedDay: 3, nextAddingDay: null } (switch day)
  3. Selected=2, addingDay=2, clicked=5 -> { nextSelectedDay: 5, nextAddingDay: null } (switch while adding)
  4. Selected=2, addingDay=2, clicked=2 -> { nextSelectedDay: 2, nextAddingDay: 2 } (keep open)
  5. Selected=0, addingDay=0, clicked=6 -> { nextSelectedDay: 6, nextAddingDay: null } (switch to Sunday)
  6. Selected=0, addingDay=0, clicked=0 -> { nextSelectedDay: 0, nextAddingDay: 0 } (click same day while adding)

**Then implement** -> `src/app/profile/profile-utils.ts`

---

### Step 8 - isDaySelected

**Write test first** -> `tests/app/profile/profile-utils.test.ts`

**Function:** `isDaySelected(selectedDay: number, addingDay: number | null, checkDay: number): boolean`

- Logic: `selectedDay === checkDay && addingDay === null`
- **Test cases:**
  1. Day matches selected, add panel closed -> true
  2. Day matches selected, add panel open (addingDay is that day) -> false
  3. Day does not match selected -> false
  4. Day matches selected, addingDay is a different day -> true

**Then implement** -> `src/app/profile/profile-utils.ts`

---

### Step 9 - Create test file skeleton

**File:** `tests/app/profile/profile-utils.test.ts`

Create the file with:
- `import { describe, it, expect } from 'vitest'`
- `import { ...all utils... } from '@/app/profile/profile-utils'`
- `describe('profile-utils', () => { ... })` wrapper
- All tests from Steps 1-8 go here **before any utils file exists**. All tests should initially FAIL (red).

---

### Step 10 - Create utils file + implement Steps 1-8

**File:** `src/app/profile/profile-utils.ts`

Pure functions only. No React imports. No component code. Export all functions.

**All tests from Steps 1-8 now pass** (green).

---

### Step 11 - Update Hero Header (UI only)

**File:** `src/app/profile/page.tsx`

**Changes:**
- Heading: "PROFILE" -> "MY BATTLE PLAN"
- Remove divider line `<div className="mt-2 h-1 w-full bg-on-surface" />`
- Replace subtitle with badge format:

```tsx
<span className="font-label-bold text-label-bold text-primary bg-on-surface text-background inline-block px-sm py-xs">
  WEEKLY CAMPAIGN ASSIGNMENT
</span>
```

- Loading state: "LOADING ROUTINE..." -> "LOADING BATTLE PLAN..."

---

### Step 12 - Rewrite Day Selector

**File:** `src/app/profile/page.tsx`

**From:** 5 buttons (Mon-Fri), border-4, justify-between gap-1, bg-surface inactive, bg-primary text-on-primary neo-shadow-sm active.

**To (per mock):**
- 7 buttons (MON through SUN)
- Container: `flex gap-sm overflow-x-auto pb-sm`
- Buttons: `flex-1 min-w-[60px] border-2 border-on-surface py-md font-label-bold text-label-bold`
- Active: `bg-primary text-on-primary shadow-[2px_2px_0px_0px_rgba(27,29,14,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]`
- Inactive: `bg-surface-container-low text-on-surface hover:bg-surface-variant transition-colors`
- Use imported `getDayLabel()` instead of local DAY_LABELS array
- Use `resolveDaySelection()` for click handler logic

---

### Step 13 - Exercise List for Selected Day Only

**File:** `src/app/profile/page.tsx`

**Remove:** The `.map(DAYS)` loop rendering all 7 days with their exercise lists.

**Add:** Single "CURRENT ASSETS" section that renders exercises for the selected day only.

**When a day is selected AND has assignments:**
```tsx
<section className="space-y-md">
  <div className="flex items-center gap-sm">
    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>military_tech</span>
    <h3 className="font-headline-md text-headline-md uppercase">CURRENT ASSETS</h3>
  </div>
  {assignments.map(assignment => (
    <div key={id} className="bg-surface-container border-2 border-on-surface p-md flex justify-between items-start neo-shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
      <div className="pl-sm space-y-xs">
        <p className="font-label-mono text-label-mono text-on-surface-variant uppercase">EXERCISE</p>
        <h4 className="font-headline-md text-headline-md leading-none">{name}</h4>
      </div>
      <button ...>
        <span className="material-symbols-outlined">close</span>
      </button>
    </div>
  ))}
</section>
```

**When a day is selected but has no assignments:**
```tsx
<section className="opacity-40 grayscale border-2 border-on-surface p-xl flex flex-col items-center text-center gap-md">
  <span className="material-symbols-outlined text-[64px]">block</span>
  <p className="font-headline-md text-headline-md uppercase leading-tight">NO ASSIGNMENTS - DEPLOY EXERCISES TO BEGIN YOUR CAMPAIGN</p>
</section>
```

**When no day is selected (edge case):** Same empty state.

**Category handling:** The data model has no category field. For now, render a placeholder `<p>EXERCISE</p>` line. Mark as TODO for when exercises gain a category field.

**Accent bar color:** Cycle bg-primary / bg-secondary based on assignment index modulo 2.

---

### Step 14 - Rewrite Add Exercise Panel

**File:** `src/app/profile/page.tsx`

**From:** Inline per-day panel with header "ADD TO {DAY_LABEL}".

**To (per mock):** Standalone section when `addingDay !== null`:

```tsx
<section className="bg-surface-container-highest border-4 border-on-surface p-lg neo-shadow-lg space-y-md">
  <h3 className="font-headline-md text-headline-md uppercase tracking-tight">REINFORCE LINEUP</h3>
  <label className="font-label-bold text-label-bold uppercase block">SELECT EXERCISE</label>
  <div className="relative">
    <select ... className="w-full bg-background border-2 border-on-surface p-md font-body-lg appearance-none">
      <option value="">CHOOSE DRILL...</option>
      {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
    </select>
    <div className="absolute right-md top-1/2 -translate-y-1/2 pointer-events-none">
      <span className="material-symbols-outlined">expand_more</span>
    </div>
  </div>
  <button ... className="w-full bg-primary-container text-on-primary-container border-4 border-on-surface py-md font-headline-md uppercase neo-shadow">DEPLOY</button>
</section>
```

**State changes:** Replace selectedExerciseId + handleAddExercise logic to use new selectedExerciseId (stored as number | null), updated handleAddExercise calling server action, "CANCEL" button removed (mock has no cancel), "DEPLOY" button replaces "ADD" button text.

---

### Step 15 - Add Quick-Add Card

**File:** `src/app/profile/page.tsx`

```tsx
<section className="border-2 border-dashed border-on-surface-variant p-lg flex flex-col items-center justify-center gap-sm bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer">
  <span className="material-symbols-outlined text-[48px] text-on-surface-variant">add_box</span>
  <span className="font-label-bold text-label-bold uppercase">CREATE NEW EXERCISE SPEC</span>
</section>
```

**Action:** No-op placeholder for now. Add comment noting TBD: wire to exercise creation flow.

---

### Step 16 - Add Campaign Logistics Grid

**File:** `src/app/profile/page.tsx`

```tsx
<section className="space-y-md pt-lg">
  <h3 className="font-label-bold text-label-bold uppercase">CAMPAIGN LOGISTICS</h3>
  <div className="grid grid-cols-7 border-2 border-on-surface bg-on-surface">
    {DAYS.map((day, i) => (
      <div key={day} className={
        count > 0
          ? 'bg-primary text-on-primary border-r border-on-surface flex flex-col items-center py-sm'
          : 'bg-surface-container-low text-on-surface border-r border-on-surface flex flex-col items-center py-sm'
      }>
        <span className="font-label-mono text-label-mono">{getDayLabel(i)}</span>
        <span className="font-headline-md text-headline-md">{count}</span>
      </div>
    ))}
  </div>
</section>
```

**Last day gets no border-r.** Uses `getExerciseCountPerDay()` from utils to compute counts.

---

### Step 17 - Wire Up handleRemoveExercise to Use Utils

**File:** `src/app/profile/page.tsx`

No functional change. Replace any remaining inline day-name / day-label lookup with imported utils. Ensure no duplicate constants (DAYS, DAY_LABELS removed if unused).

---

### Step 18 - Final Integration Review

**File:** `src/app/profile/page.tsx`

Checklist:
- [ ] Hero header: "MY BATTLE PLAN" + "WEEKLY CAMPAIGN ASSIGNMENT" badge
- [ ] Day selector: 7 buttons, 2px border, overflow-x-auto, bg-surface-container-low inactive
- [ ] Exercises only render for selected day
- [ ] Exercise cards: colored accent bar, category placeholder line, exercise name, close icon
- [ ] Empty state: block icon + "NO ASSIGNMENTS - DEPLOY EXERCISES TO BEGIN YOUR CAMPAIGN"
- [ ] Add panel: "REINFORCE LINEUP", bg-background select, "DEPLOY" button, neo-shadow-lg
- [ ] Quick-add card: dashed border, add_box icon, "CREATE NEW EXERCISE SPEC"
- [ ] Campaign logistics: 7-column grid, correct counts per day
- [ ] All utility functions imported from utils, none duplicated in page
- [ ] All unit tests from Steps 1-8 pass

---

## File Summary

| File | Purpose |
|---|---|
| `src/app/profile/profile-utils.ts` | Pure utility functions (Steps 1-8) |
| `src/app/profile/page.tsx` | React component, all UI changes (Steps 11-18) |
| `tests/app/profile/profile-utils.test.ts` | Unit tests for all utility functions (Steps 1-8) |

No changes to server actions. No changes to entity types. No changes to repositories.

## Open Decisions

| Decision | Recommendation | Reason |
|---|---|---|
| Exercise card category line | Placeholder text "EXERCISE" | Data model has no category. Add later when exercises gain a category field. |
| Accent bar color | Alternate bg-primary / bg-secondary based on index % 2 | Matches mock's alternating card colors |
| Quick-add card action | No-op placeholder | No exercise creation flow exists yet |
| Empty state visibility | Always shown when selected day has 0 assignments | Consistent UX - user always sees something for the selected day |
| Campaign logistics grid | Always visible | Provides at-a-glance weekly overview regardless of selection |

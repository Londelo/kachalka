## WHAT

Rename the "profile" page to "plan" across the entire codebase — routes, directories, imports, component names, HTML IDs, CSS classes, and nav references. Then enhance the exercise selection modal with filtering (show only unselected exercises), a toggle between "select existing" and "new exercise" modals, and an external "ADD EXERCISE" button outside the modal container.

Files to change:
- [src/app/(main)/profile/page.tsx](src/app/(main)/profile/page.tsx) → [src/app/(main)/plan/page.tsx](src/app/(main)/plan/page.tsx)
- [src/app/profile/profile-utils.ts](src/app/profile/profile-utils.ts) → [src/app/plan/plan-utils.ts](src/app/plan/plan-utils.ts)
- [tests/app/profile/profile-utils.spec.ts](tests/app/profile/profile-utils.spec.ts) → [tests/app/plan/plan-utils.spec.ts](tests/app/plan/plan-utils.spec.ts)
- [src/app/components/bottom-nav.tsx](src/app/components/bottom-nav.tsx)
- [src/app/components/nav-wrapper.client.tsx](src/app/components/nav-wrapper.client.tsx)
- [src/app/components/new-recruit-button.tsx](src/app/components/new-recruit-button.tsx)

## HOW

### src/app/(main)/profile/page.tsx → src/app/(main)/plan/page.tsx

Rename the page component from `ProfilePage` to `PlanPage`.

Rename the imported utils module:
- `@/app/profile/profile-utils` → `@/app/plan/plan-utils`

Rename all HTML IDs:
- `profile-loading` → `plan-loading`
- `profile-page` → `plan-page`
- `profile-header` → `plan-header`
- `profile-error` → `plan-error`
- `profile-workspace` → `plan-workspace`
- `profile-day-selector` → `plan-day-selector`
- `profile-current-assets` → `plan-current-assets`
- `profile-assignment-list` → `plan-assignment-list`

Rename all CSS class prefixes:
- `profile-*` → `plan-*` (for any custom profile- prefixed classes)

Exercise dropdown filtering:
- Compute the set of exercise IDs already assigned to the selected day
- Filter the exercises array to exclude those IDs before rendering the select options
- If all exercises are selected, show an empty state message in the dropdown

Modal toggle:
- Add a new state: `modalMode: 'select' | 'new'`
- Rename `modalOpen` to `showModal`
- Add a toggle button outside the modal container, below it, labeled "ADD EXERCISE" (when in 'select' mode) or "SELECT EXERCISE" (when in 'new' mode)
- When the toggle button is clicked:
  - If currently in 'select' mode: switch to 'new' mode, open the new exercise modal
  - If currently in 'new' mode: switch to 'select' mode, open the select exercise modal
- The "ADD EXERCISE" button on the plan page (currently "ADD EXISTING EXERCISE") should be renamed to "ADD EXERCISE"
- The NewRecruitButton should be replaced with this toggle button

New exercise modal:
- When modalMode is 'new', show the NewRecruitButton's form inline (the recruit name input + submit)
- When modalMode is 'select', show the existing exercise dropdown + deploy button

Select exercise modal:
- When modalMode is 'select', show the dropdown with filtered exercises + deploy button
- The "DEPLOY" button should be renamed to "ASSIGN"

### src/app/profile/profile-utils.ts → src/app/plan/plan-utils.ts

Rename the file and update all exports. No logic changes needed — this is a pure rename.

### tests/app/profile/profile-utils.spec.ts → tests/app/plan/plan-utils.spec.ts

Update the import path:
- `@/app/profile/profile-utils` → `@/app/plan/plan-utils`

No logic changes needed — pure rename.

### src/app/components/bottom-nav.tsx

Update the PROFILE tab:
- `id: 'PROFILE'` → `id: 'PLAN'`
- `label: 'PROFILE'` → `label: 'PLAN'`
- `href: '/profile'` → `href: '/plan'`

### src/app/components/nav-wrapper.client.tsx

Update the pathname check:
- `pathname?.startsWith('/profile')` → `pathname?.startsWith('/plan')`
- `activeTab = 'PROFILE'` → `activeTab = 'PLAN'`

### src/app/components/new-recruit-button.tsx

Rename the file to `add-exercise-button.tsx` and the component to `AddExerciseButton`.

- Update `id="new-recruit-button"` → `id="add-exercise-button"`
- Update `id="new-recruit-modal-overlay"` → `id="add-exercise-modal-overlay"`
- Update `id="new-recruit-modal"` → `id="add-exercise-modal"`
- Update `id="new-recruit-form"` → `id="add-exercise-form"`
- Update `id="new-recruit-submit"` → `id="add-exercise-submit"`
- Update `id="new-recruit-cancel"` → `id="add-exercise-cancel"`
- Update the heading "NEW RECRUIT" → "NEW EXERCISE" (for the exercise creation context)
- Update placeholder "Recruit name" → "Exercise name"

## WHY

The "profile" label doesn't match the page's actual purpose — it's a battle plan / exercise assignment page. Renaming to "plan" better communicates the feature's intent to users. The exercise dropdown filtering prevents users from re-assigning exercises already on a given day. The modal toggle gives users a streamlined way to either add existing exercises or create new ones without navigating away.

## QUESTIONS — RESOLVED

**Q1: When all exercises are already assigned to a day** → Leave the dropdown empty (no "ALL EXERCISES DEPLOYED" message, just an empty select).

**Q2: Should the "new exercise" modal create a new *user* (recruit) or a new *exercise*?** → No user manipulation at all. The modal creates a new exercise record only.

**Q3: Should the toggle button appear only when there are unselected exercises available?** → Yes. Default to 'select' mode. If no exercises are available to select, fall back to 'new' mode automatically.

## CRITIQUES

  • The rename touches 6+ files and a directory structure — high risk of missing a reference. Need thorough grep verification after the rename.
  • The modal toggle concept merges two distinct workflows (user creation vs exercise assignment) that may belong to different features. The NewRecruitButton creates users, not exercises — this needs clarification.
  • Filtering the dropdown by already-assigned exercises adds a new computation on every render. Should memoize the filtered list with `useMemo` to avoid unnecessary re-renders.
  • The `handleAddExercise` and `handleModalAddExercise` functions are duplicates — should be deduplicated into a single handler.
  • Renaming HTML IDs and CSS classes is cosmetic but affects debugging/automation tools that may reference the old IDs.

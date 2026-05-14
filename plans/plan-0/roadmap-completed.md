# Lifting App — Implementation Plan

## Overview

A Next.js web app for tracking weightlifting workouts, backed by SQLite via `better-sqlite3`. Built using Clean Architecture principles organized as deep feature modules.

**Design reference:** `docs/mocks/` — neo-brutalist "IRON COMMAND" visual identity with Tailwind CSS. Each page has its own HTML file. Use these as the UI reference when building Next.js components.

**Reference documents:**
- [Business Logic & UX Plan](lifting-app.md) — the "what"
- [Architecture Plan](lifting-app-architecture.md) — the "how"
- [Data Flow & Relationships](lifting-app-data-flow.md) — how data connects
- [Design Mocks](mocks/userpage.html) — visual identity, layout, and component patterns (per-page HTML files in `docs/mocks/`)

## Orchestrator Instructions

When executing work against this roadmap, team leads and orchestrators MUST:

- **Save plans** — any implementation plan derived from this roadmap goes in `docs/plans/` (e.g. `docs/plans/Phase-1-Users.md`)
- **Save reports** — upon completing a phase, leave a session report in `docs/reports/` (e.g. `docs/reports/report-phase-1-users.md`)

These directories are the single source of truth for planning artifacts and phase completion reports. Do not scatter them elsewhere.

---

## Design System

**Brand name:** IRON COMMAND (displayed in top-left of header, uppercase, bold)

### Visual Style
- **Neo-brutalist** — thick solid borders (`border-4 border-on-surface`), hard offset box-shadows (`box-shadow: 4px 4px 0px 0px rgba(27,29,14,1)`), no border-radius on cards, aggressive `active:translate` press effects
- **Military/tactical theme** — uppercase labels, session names like "AM SESSION", "EVENING RECON", intensity badges, "COMMANDER" terminology
- **Monochrome + red accent** — desaturated backgrounds with `#a20000` primary red for active states and CTAs

### Color Palette
| Token | Hex | Usage |
|---|---|---|
| `background` | `#fbfbe2` | Page background |
| `primary` | `#a20000` | Active nav, CTAs, emphasis |
| `primary-container` | `#d00000` | Input underlines, accent borders |
| `on-surface` | `#1b1d0e` | Text, borders, shadows |
| `tertiary-fixed` | `#e3e2e2` | Card backgrounds |
| `surface-container-high` | `#eaead1` | Elevated card backgrounds |
| `surface-container` | `#efefd7` | Section backgrounds |
| `secondary` | `#5f5e5e` | Inactive/subdued text |

### Typography
| Role | Font | Size | Usage |
|---|---|---|---|
| Headline XL | Epilogue (900) | 48px, -0.04em tracking | Page titles ("TODAY'S BATTLE", "SELECT COMMANDER") |
| Headline LG | Epilogue (800) | 32px, -0.02em tracking | Section headers |
| Headline MD | Epilogue (800) | 24px | Card titles, exercise names |
| Label Bold | Space Grotesk (700) | 14px, 0.05em tracking, uppercase | Badges, labels, nav labels |
| Label Mono | Space Grotesk (500) | 12px | Session numbers, timestamps |
| Body LG | Inter (500) | 18px | Key stats |
| Body MD | Inter (400) | 16px | Descriptions, notes |

### Iconography
- Google Material Symbols Outlined (outlined, not filled by default)
- Filled state only for active nav items (`font-variation-settings: 'FILL' 1`)
- Icons used: `fitness_center`, `calendar_today`, `monitoring`, `settings`, `account_circle`, `menu`, `add_circle`, `check_circle`, `bolt`, `warning`, `person_add`, `lock`, `chevron_right`, `expand_more`

### Layout Patterns
- **Fixed header** — top bar with hamburger menu, brand name, account icon; `z-50`, `border-b-4`, `shadow-[4px_4px_0px_0px_rgba(27,29,14,1)]`
- **Fixed bottom nav** — 4 tabs (WORKOUT, HISTORY, PROGRESS, CONFIG); active tab gets `bg-primary text-on-primary` with inset shadow; `z-50`
- **Content max-width** — `max-w-4xl mx-auto` centered content
- **Active press effect** — `active:translate-x-[2px] active:translate-y-[2px] active:shadow-none` on all interactive elements

### Components (from mocks)

**Exercise Card** (Today's Workout):
- Thick border, hard shadow, uppercase exercise name
- Subtitle with category tags ("PRIMARY PUSH // COMPOUND")
- 4-column input grid: WEIGHT (KG), REPS, RPE, REST (S)
- Full-width CTA button with neo-shadow
- Set progress badge ("SET 01/05") or "LOCKED" state
- Placeholder values from last session

**User Card** (User Selection):
- Profile image placeholder (grayscale, high contrast)
- Name + rank line ("LVL 48 HEAVYWEIGHT")
- 2-column stats grid (TOTAL LOAD, MAX SQUAT)
- "ACTIVE" badge for current user
- "QUICK ADD" card with dashed border for new users

**History Entry** (History Page):
- Session badge ("SESSION 082")
- Workout name ("BACK & BICEPS ANNIHILATION")
- 3-column stats: VOLUME, SETS, INTENSITY
- Chevron-right for detail view
- Grouped by date with left-border accent

**Progress Chart** (Force Progression):
- Exercise dropdown selector
- Time range filter buttons (1M, 3M, 6M, ALL)
- Bar chart with hover tooltips showing date + volume
- Intensity split breakdown (percentage bars)
- "Commander's Intel" insight card with warning icon
- Secondary progression placeholder (1RM prediction)

**Session Toggle** (Today's Workout):
- Pill-style badges for deployed sessions ("06:00 MORNING PUSH")
- Active session highlighted with primary bg
- Locked future sessions show lock icon
- Supports multiple sessions per day

### Additional Fields Beyond Original Plan
- **RPE** (Rate of Perceived Exertion) — logged per set, 1-10 scale
- **Rest timer** — rest duration in seconds logged per set
- **Session notes** — free-text notes from last session shown on Today's page
- **Intensity metric** — derived from session data (MAX, HIGH, PR labels)
- **Estimated 1RM** — shown in bento card on Today's page, requires 3+ high-intensity sessions

---

## Design System & UI Patterns

**All screens are in `docs/mocks/` — use as the single source of truth for styling when building Next.js components.**

### Brand
- **Name:** IRON COMMAND — displayed in header, uppercase, bold, red (`#a20000`)
- **Aesthetic:** Neo-brutalist, military/industrial theme

### Typography (Google Fonts)
| Role | Font | Size | Weight |
|---|---|---|---|
| Headline XL (page titles) | Epilogue | 48px | 900 |
| Headline LG (section headers) | Epilogue | 32px | 800 |
| Headline MD (card titles) | Epilogue | 24px | 800 |
| Body LG | Inter | 18px | 500 |
| Body MD | Inter | 16px | 400 |
| Label Bold (labels, badges) | Space Grotesk | 14px | 700 |
| Label Mono (session nums, timestamps) | Space Grotesk | 12px | 500 |

### Colors (key tokens)
| Token | Hex | Usage |
|---|---|---|
| `background` | `#fbfbe2` | Page background (warm cream) |
| `on-surface` | `#1b1d0e` | Text, borders (near-black) |
| `primary` | `#a20000` | Accent, active states, CTAs |
| `primary-container` | `#d00000` | Button fills, highlights |
| `on-primary` | `#ffffff` | Text on red backgrounds |
| `surface-container` / `surface-container-high` | `#efefd7` / `#eaead1` | Card backgrounds |
| `tertiary-fixed` | `#e3e2e2` | Exercise card backgrounds |
| `secondary` | `#5f5e5e` | Inactive text |
| `error` | `#ba1a1a` | Destructive actions |

### Neo-Brutalist Components
- **Cards:** Thick 4px solid borders (`border-on-surface`), hard offset shadows (`4px 4px 0 0 #1b1d0e` or `8px 8px 0 0`), no border-radius
- **Buttons:** Full-width CTA with `neo-shadow`, active press state: `translate(2px, 2px)` + shadow collapse
- **Inputs:** Bottom-border-only underline style (`border-b-4 border-primary-container`), no side borders, cream background
- **Badges:** Uppercase mono/label-bold text, pill or rectangular with thick border
- **Images:** Grayscale + contrast-125, thick border, hard shadow, optional text overlay

### Navigation Pattern
- **Header:** Fixed top bar — menu icon (left), "IRON COMMAND" brand (center), account circle icon (right). Thick bottom border + hard shadow.
- **Bottom Nav Bar:** Fixed bottom — 4 tabs (WORKOUT, HISTORY, PROGRESS, CONFIG). Active tab: red fill, white text, bordered. Inactive: cream fill, dark text. Icons from Material Symbols Outlined. Active press: `scale(0.95)`.

### Layout Conventions
- Max content width: `max-w-4xl` centered
- Page padding: `px-lg`, top offset for fixed header (`mt-24` or `pt-32`)
- Sections separated by `gap-xl` / `stack-heavy` (32px / 48px)
- Date group headers: left-bordered accent + full-width divider line
- Bento grid layouts: `grid grid-cols-1 md:grid-cols-2 gap-lg`

---

## Roadmap

### Phase 0 — Scaffolding

Set up the project foundation.

**Files to create:**
- `package.json` with Next.js, Drizzle, better-sqlite3 dependencies
- `tsconfig.json` with path aliases and strict mode
- `next.config.ts`
- `src/app/layout.tsx` — root layout with nav bar shell
- `src/app/globals.css` — base styles
- `src/config/db.ts` — SQLite singleton with Drizzle initialization
- `src/config/env.ts` — environment variable validation
- `src/db/schema.ts` — Drizzle table definitions (users, exercises, user_routines, workout_logs)
- `src/db/migrate.ts` — migration runner for app startup
- `src/shared/errors/app-error.ts` — base error class
- `src/shared/utils/volume.ts` — volume calculation helper
- `src/shared/utils/date.ts` — date formatting helpers
- `src/shared/types/day-of-week.ts` — DayOfWeek type
- `.gitignore` (include `data/` directory)
- `data/` directory for the SQLite file

**Acceptance criteria:**
- `npm run dev` starts the app and shows a blank page
- SQLite database file is created on first request
- All 4 tables exist with correct schema

---

### Phase 1 — Users

User selection and creation. The foundation — every other feature is per-user.

**Files to create:**
- `src/features/user/user-entity.ts` — User type, UserId value object, name validation
- `src/features/user/user-repository.ts` — UserRepository interface
- `src/features/user/create-user.ts` — CreateUser use case
- `src/features/user/get-users.ts` — GetUsers use case
- `src/features/user/user-server-actions.ts` — Next.js server action wrappers
- `src/features/user/user-repo-impl.ts` — Drizzle + SQLite implementation
- `src/app/page.tsx` — User selection page (list of users + add new)

**Acceptance criteria:**
- Can create a new user from the selection page
- Can select an existing user and get redirected
- User names are validated (not empty, max 100 chars)
- Users are stored in SQLite and listed on reload

**Design:** `docs/mocks/userpage.html` — "User Selection" page (SELECT COMMANDER). Convert to Next.js components preserving: centered hero header with full-width divider, 2-column grid of user cards with avatar/image, uppercase name, rank line ("LVL 48 HEAVYWEIGHT"), 2 stat tiles (TOTAL LOAD, MAX SQUAT), "ACTIVE" badge top-right on current user, "QUICK ADD" dashed-border card with add-circle icon, "NEW RECRUIT" full-width CTA button. Neo-brutalist: thick 4px borders, hard offset shadows, no border-radius, active press effects.

---

### Phase 2 — Exercises

Shared global exercise pool with ownership semantics.

**Files to create:**
- `src/features/exercise/exercise-entity.ts` — Exercise type
- `src/features/exercise/exercise-repository.ts` — ExerciseRepository interface
- `src/features/exercise/create-exercise.ts` — CreateExercise use case (with ownership)
- `src/features/exercise/rename-exercise.ts` — RenameExercise use case (owner-only)
- `src/features/exercise/delete-exercise.ts` — DeleteExercise use case (only if not in routines)
- `src/features/exercise/list-exercises.ts` — ListExercises use case
- `src/features/exercise/exercise-server-actions.ts` — Server action wrappers
- `src/features/exercise/exercise-repo-impl.ts` — SQLite implementation

**Acceptance criteria:**
- Users can create exercises (creator becomes owner)
- Only the owner can rename or delete their exercise
- Renaming cascades automatically (queries use exercise ID, not name)
- Can't delete an exercise that's in someone's routine

**Design:** `docs/mocks/todaysworkout.html` — exercise cards section. Convert to Next.js components preserving: neo-brutalist exercise cards with thick borders, hard shadows, uppercase names, category subtitle ("PRIMARY PUSH // COMPOUND"), 4-column input grid (WEIGHT, REPS, RPE, REST), "LOG SET" CTA button, "LOCKED" state with dashed separator and unlock message. Exercise cards reuse the same design system.

---

### Phase 3 — Routines

Per-user exercise-to-day assignments.

**Files to create:**
- `src/features/routine/routine-entity.ts` — RoutineAssignment type
- `src/features/routine/routine-repository.ts` — RoutineRepository interface
- `src/features/routine/assign-exercise.ts` — AssignExercise use case (no duplicates)
- `src/features/routine/remove-exercise.ts` — RemoveExercise use case
- `src/features/routine/get-user-routine.ts` — GetUserRoutine use case
- `src/features/routine/routine-server-actions.ts` — Server action wrappers
- `src/features/routine/routine-repo-impl.ts` — SQLite implementation
- `src/app/profile/page.tsx` — Routine setup page (days + exercise assignments)

**Acceptance criteria:**
- Users can assign exercises to days of the week
- Can't assign the same exercise twice on the same day
- Can remove exercises from days
- Routine is organized by day when fetched (matches UI shape)

**Design:** No dedicated mock for the routine editor page. Follow the established design system: neo-brutalist cards, thick borders, hard shadows. Days of the week as pill badges, exercise assignment as dropdown selectors with neo-brutalist styling. Reuse header/nav components from Phase 1.1.

---

### Phase 4 — Workout Logging

The core feature — log sets, reps, and weight for today's exercises.

**Files to create:**
- `src/features/workout/workout-entity.ts` — WorkoutLog, Set types, calculateVolume
- `src/features/workout/workout-repository.ts` — WorkoutRepository interface
- `src/features/workout/log-workout.ts` — LogWorkout use case
- `src/features/workout/update-workout.ts` — UpdateWorkout use case
- `src/features/workout/delete-workout.ts` — DeleteWorkout use case
- `src/features/workout/get-today-exercises.ts` — GetTodayExercises use case
- `src/features/workout/workout-server-actions.ts` — Server action wrappers
- `src/features/workout/workout-repo-impl.ts` — SQLite implementation
- `src/app/today/page.tsx` — Today's workout page (exercise cards + set logging modal)

**Acceptance criteria:**
- Today's page shows exercises scheduled for the current day
- Users can log sets (reps + weight) for each exercise
- Last session's numbers appear as placeholders
- Users can add/remove sets within a session
- Multiple sessions per day are supported (session toggle pills: "06:00 MORNING PUSH", "18:00 EVENING RECON")
- Volume is calculated correctly: Σ(reps × weight)
- **Per-set fields:** RPE (1-10), rest duration in seconds (logged alongside reps/weight)
- **Exercise card states:** Active (editable inputs), Locked (requires completing prior exercise), with category subtitle ("PRIMARY PUSH // COMPOUND")
- **Session notes:** Previous session's free-text notes displayed on Today's page
- **Intensity card:** Estimated 1RM shown in bento card (derived from workout data)

**Design:** `docs/mocks/todaysworkout.html` — "Today's Workout" page (TODAY'S BATTLE). Convert to Next.js components preserving: hero header with "TODAY'S BATTLE" title and AM/PM session badge, training image section (grayscale, contrast-125, neo-shadow), exercise cards with 4-column input grid (WEIGHT, REPS, RPE, REST), "LOG SET" CTA button, "LOCKED" state, bento grid for last session notes + intensity peak card, session toggle pills ("06:00 MORNING PUSH", "18:00 EVENING RECON").

---

### Phase 5 — History

View, edit, and delete past workout logs.

**Files to create:**
- `src/features/workout/get-workout-history.ts` — GetWorkoutHistory use case (update existing file)
- `src/features/workout/get-user-volume.ts` — GetUserVolume use case (update existing file)
- `src/app/history/page.tsx` — History page (scrollable, grouped by date)

**Acceptance criteria:**
- History shows past workouts grouped by date, newest first
- Each entry shows exercise name, number of sets, total volume
- Can click into an entry to see/set-level details
- Can edit or delete past entries

**Design:** `docs/mocks/history.html` — "History Log" page (WAR LOGS). Convert to Next.js components preserving: hero header "WAR LOGS" with subtitle "CAMPAIGN HISTORY & PERFORMANCE DATA", date groups with left-bordered headers (4px left border, red accent), log entry cards with session number badge ("SESSION 082"), exercise name, 3-column metrics grid (VOLUME, SETS, INTENSITY), industrial image break with "NEVER SURRENDER" overlay, bottom nav with HISTORY pill highlighted.

**Worktree instructions:**
1. Create a branch: `git checkout -b feat/history`
2. Create a worktree: `git worktree add ../kachalka-history feat/history`
3. `cd ../kachalka-history` — all work happens in this worktree
4. Implement all files listed above, commit changes within the worktree
5. When done, stay in the worktree and run visual verification (Playwright MCP) against `localhost:3000`
6. Return to the main repo: `cd ../kachalka`
7. When both Phase 5 and Phase 6 are complete, merge: `git checkout main && git merge feat/history && git merge feat/progress`

---

### Phase 6 — Progress Chart

Bar chart of volume over time per exercise.

**Files to create:**
- `src/features/chart/chart-entity.ts` — ChartDataPoint type
- `src/features/chart/chart-repository.ts` — ChartRepository interface
- `src/features/chart/chart-service.ts` — ChartService use case
- `src/features/chart/chart-server-actions.ts` — Server action wrappers
- `src/features/chart/chart-repo-impl.ts` — SQLite aggregation queries
- `src/app/progress/page.tsx` — Progress chart page (dropdown + bar chart)
- `src/app/config/page.tsx` — Config page (routine editor + delete account)

**Acceptance criteria:**
- User selects an exercise from a dropdown
- Bar chart shows volume over time (one bar per logged session)
- Hovering over a bar shows date, individual sets, total volume
- Shows "No data yet" when appropriate
- Time range filter: 1M / 3M / 6M / ALL toggle pills

**Design:** `docs/mocks/stats.html` — "Force Progression" page. Convert to Next.js components preserving: italic uppercase "FORCE PROGRESSION" header, exercise dropdown with neo-brutalist styling, bar chart in bordered container with hover tooltips, peak volume metric ("ALL TIME PEAK: 12,450"), bento grid with INTENSITY SPLIT percentage bar, COMMANDER'S INTEL card with warning icon, SECONDARY PROGRESSION placeholder ("NO DATA FOR ESTIMATED 1RM"), bottom nav with PROGRESS pill highlighted.

**Worktree instructions:**
1. Create a branch: `git checkout -b feat/progress`
2. Create a worktree: `git worktree add ../kachalka-progress feat/progress`
3. `cd ../kachalka-progress` — all work happens in this worktree
4. Implement all files listed above, commit changes within the worktree
5. When done, stay in the worktree and run visual verification (Playwright MCP) against `localhost:3000`
6. Return to the main repo: `cd ../kachalka`
7. When both Phase 5 and Phase 6 are complete, merge: `git checkout main && git merge feat/history && git merge feat/progress`

---

## Mock Usage Guidelines

When implementing phases from mock HTML files in `docs/mocks/`:

1. **Use what works** — visual styling, layout patterns, and component shapes from mocks are the UI reference
2. **Discard misaligned data** — any mock data (placeholder stats, hardcoded images, fake metrics) that does not align with the plan's data model should be left out; replace with real data or appropriate placeholders
3. **Discard misaligned elements** — any mock UI element (badges, sections, images) that has no corresponding feature or data in the plan should be omitted
4. **Preserve the design system** — colors, typography, neo-brutalist styling, and layout patterns are always preserved regardless of data availability

This ensures the UI looks like the mock but behaves according to the plan.

---

## Visual Verification Strategy (Playwright MCP)

After implementing each phase's design, visually verify the running app against the corresponding mock HTML file using Playwright MCP. This catches styling gaps that manual code review misses.

**Process:**

1. **Ensure dev server is running** — `npm run dev` on `localhost:3000`
2. **Navigate to the page** — Use `browser_navigate` to load the relevant route
3. **Capture screenshot** — Use `browser_take_screenshot` to get a visual snapshot
4. **Capture accessibility snapshot** — Use `browser_snapshot` for DOM structure verification
5. **Read the mock HTML** — Open `docs/mocks/<page>.html` and compare structure, styling, and layout
6. **Document differences** — Report issues by severity:
   - **SEVERITY 1** — Missing elements (entire components not rendered)
   - **SEVERITY 2** — Color/system broken (wrong colors, missing shadows, wrong fonts)
   - **SEVERITY 3** — Typography/layout issues (wrong fonts, spacing mismatches, missing icons)
   - **SEVERITY 4** — Neo-brutalist styling missing (shadows, borders, press effects)
   - **SEVERITY 5** — Minor polish (hover states, edge case styling)
7. **Fix identified issues** — Address each severity level in order
8. **Re-verify** — Repeat steps 2-4 until all issues are resolved
9. **Confirm match** — When zero issues remain, the phase UI is complete

**Key checks per phase:**
- Color utilities render correctly (computed styles match design tokens)
- Fonts load and apply (Epilogue, Inter, Space Grotesk)
- Material Symbols icons display (not showing text fallbacks)
- Neo-brutalist shadows visible (hard offset, no blur)
- Borders correct (thick 4px, solid vs dashed)
- Active press effects work (`:active` translate + shadow collapse)
- Layout matches grid/padding/spacing from mock
- No duplicate elements or misplaced components

**This process should be applied after every phase that has a corresponding mock HTML file.**

---

## Implementation Order Summary

```
Phase 0 — Scaffolding          (project setup, DB, folder structure)
    ↓
Phase 1 — Users                (user selection, creation, auth shell)
    ↓
Phase 2 — Exercises            (exercise pool, ownership, CRUD)
    ↓
Phase 3 — Routines             (assign exercises to days)
    ↓
Phase 4 — Workout Logging      (log sets, today's page) ← core feature
    ↓
Phase 5 — History              (view/edit/delete past logs)
    ↓
Phase 6 — Progress Chart       (volume chart, config page)
```

Each phase builds on the previous one. No phase depends on anything after it.

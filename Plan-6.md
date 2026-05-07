# Plan — Phase 6: Progress Chart

## WHAT

Build the Progress Chart page and extend the Config page. The Progress Chart displays volume-over-time bar charts per exercise with time-range filtering, hover tooltips, and intensity splits. The Config page (new route) provides account management with a delete account destructive action. The existing Profile page already handles routine editing.

**Files to create:**
- [src/features/chart/chart-entity.ts](src/features/chart/chart-entity.ts)
- [src/features/chart/chart-repository.ts](src/features/chart/chart-repository.ts)
- [src/features/chart/chart-service.ts](src/features/chart/chart-service.ts)
- [src/features/chart/chart-server-actions.ts](src/features/chart/chart-server-actions.ts)
- [src/features/chart/chart-repo-impl.ts](src/features/chart/chart-repo-impl.ts)
- [src/app/progress/page.tsx](src/app/progress/page.tsx)
- [src/app/config/page.tsx](src/app/config/page.tsx)

**Files to extend:**
- [src/app/layout.tsx](src/app/layout.tsx) — add progress/config nav routes
- [src/app/components/bottom-nav.tsx](src/app/components/bottom-nav.tsx) — ensure PROGRESS tab links to /progress
- [src/app/components/header.tsx](src/app/components/header.tsx) — ensure account icon links to /config

## HOW

### [src/features/chart/chart-entity.ts](src/features/chart/chart-entity.ts)

ChartDataPoint type
  • Fields: date (YYYY-MM-DD string), volume (number = Σ reps × weight), sets (WorkoutSet[])
  • Factory function: emptyChartDataPoint() returning a zero-volume data point

IntensitySplit type
  • Fields: type (string — "TOP SET", "VOLUME SET", etc.), percentage (number 0–100)

### [src/features/chart/chart-repository.ts](src/features/chart/chart-repository.ts)

ChartRepository interface
  • getVolumeByDate(userId, exerciseId, range?) → ChartDataPoint[] — aggregated volume grouped by date
  • getPeakVolume(userId, exerciseId) → number — max single-session volume
  • getIntensitySplit(userId, exerciseId) → IntensitySplit[] — breakdown of set types
  • getExercisesWithLogs(userId) → { id: number; name: string }[] — exercises that have logged data

### [src/features/chart/chart-repo-impl.ts](src/features/chart/chart-repo-impl.ts)

SqliteChartRepository implementing ChartRepository
  • getVolumeByDate — SQL query parsing sets JSON, SUM(reps * weight), GROUP BY date, ORDER BY date ASC
    – Apply date range filter: 1M = last 30 days, 3M = 90 days, 6M = 180 days, ALL = no filter
    – Use SQLite JSON functions: json_extract(sets, '$[0].reps'), json_extract(sets, '$[0].weight'), etc.
    – For arbitrary-length sets array, use a recursive CTE or json_each to unnest
  • getPeakVolume — MAX of the volume aggregation from getVolumeByDate
  • getIntensitySplit — classify sets by volume tier (top set = highest volume, etc.), compute percentages
  • getExercisesWithLogs — SELECT DISTINCT exercises JOIN workout_logs WHERE user_id = ? ORDER BY name

### [src/features/chart/chart-service.ts](src/features/chart/chart-service.ts)

ChartService use case
  • Constructor takes ChartRepository
  • getExerciseProgress(userId, exerciseId, range?) → ChartDataPoint[] — delegates to repo, sorts by date
  • getPeakVolume(userId, exerciseId) → number — delegates to repo
  • getIntensitySplit(userId, exerciseId) → IntensitySplit[] — delegates to repo

### [src/features/chart/chart-server-actions.ts](src/features/chart/chart-server-actions.ts)

Server action wrappers
  • getExerciseChartData(userId, exerciseId, range?) — constructs DB, repo, service; returns ChartDataPoint[]
  • getExercisesWithLogsAction(userId) — returns exercises that have logged data for dropdown
  • getPeakVolumeAction(userId, exerciseId) — returns peak volume number
  • getIntensitySplitAction(userId, exerciseId) — returns intensity splits

### [src/app/progress/page.tsx](src/app/progress/page.tsx)

ProgressChartPage — client component
  • State: selectedExerciseId, timeRange (1M/3M/6M/ALL), chartData, loading, error
  • On mount: load exercises list, load chart data for first exercise
  • Exercise dropdown: neo-brutalist styled select, populated from getExercisesWithLogsAction
    – If no exercises with data: show "NO DATA YET" message
  • Time range pills: 1M / 3M / 6M / ALL — toggle buttons, active pill gets primary bg
  • Bar chart:
    – Each bar = one logged session
    – Bar height proportional to volume
    – Hover tooltip: date, individual sets (reps × weight), total volume for that session
    – Bars styled with primary color, thick border, hard shadow
  • Peak volume card: "ALL TIME PEAK: {formatted number}"
  • Intensity split card: percentage bars for each intensity type
  • Commander's Intel card: warning icon + insight text (e.g., "INCREASE VOLUME TO SEE PROGRESSION")
  • Secondary Progression card: "NO DATA FOR ESTIMATED 1RM" placeholder
  • Empty state: "NO DATA YET" with icon when no workout logs exist for selected exercise

### [src/app/config/page.tsx](src/app/config/page.tsx)

ConfigPage — client component
  • Account section:
    – Display current user name (from cookie)
    – Delete account button: neo-brutalist destructive style, confirmation dialog
    – Delete account calls server action, clears cookie, redirects to /
  • Quick links section:
    – Link to Profile page ("MY BATTLE PLAN" / routine editor)
    – Link to Progress page
  • Neo-brutalist styling consistent with rest of app

### [src/app/components/bottom-nav.tsx](src/app/components/bottom-nav.tsx)

Ensure PROGRESS nav item links to /progress route

### [src/app/components/header.tsx](src/app/components/header.tsx)

Ensure account icon links to /config route

## WHY

Users need to visualize their progress over time to understand training trends, identify plateaus, and stay motivated. The bar chart transforms raw workout logs into actionable insights. The Config page provides account management and quick navigation to other app sections. This completes the core app experience (Workout → History → Progress → Config).

## QUESTIONS

**For you to answer:**
  • The stats.html mock is empty (0 bytes) — should I use the roadmap description alone, or should I look at the history.html mock for neo-brutalist pattern consistency?
  • For the intensity split: should "TOP SET", "VOLUME SET" etc. be derived from actual data (e.g., highest volume set per session) or shown as placeholder labels?
  • The Config page — should it include the routine editor from Profile, or just account management + quick links?
  • For "Commander's Intel": what insight logic should drive the message? Static placeholder or dynamic based on data?

**You can ask me:**
  • "What should the estimated 1RM calculation be based on?"
  • "Should the bar chart be horizontal or vertical?"
  • "How should the dropdown handle exercises with no logged data?"

## CRITIQUES

  • SQLite JSON aggregation for arbitrary-length sets arrays requires recursive CTEs or json_each — this is complex SQLite and may need careful testing
  • The Config page description is thin — routine editor already exists in Profile; config should focus on account management to avoid duplication
  • No server-side pagination for chart data — if a user has 500+ workout logs, the chart could be slow. Consider limiting to last 100 data points client-side
  • The "intensity split" concept is undefined in the data model — need to define clear classification rules
  • Hover tooltips on mobile: touch interactions don't have hover — need tap-to-show tooltip behavior for mobile users

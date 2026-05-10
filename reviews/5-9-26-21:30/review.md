# Code Review Summary - DESIGN-TUNE-UP

## The Story

This PR is a design tune-up across the kachalka fitness tracking app. It replaces the custom bar chart on the progress page with Recharts, adds time aggregation (session/week/month), introduces a debounced auto-save pattern on the today page, refactors the history page layout, simplifies the user selection and config flows, and adds a chart feature layer with repository, service, and server-action abstractions. The config page is deleted and the bottom nav is reduced to 4 tabs.

## Review Findings

**Prioritization**: Issues in changed code first (blocking), then issues in context files (non-blocking).

### Issues

**In Changed Code** (must be addressed before merge):

- **Missing `'use client'` directive on today page** — TodayPage uses `useState`, `useEffect`, `useRef`, and `useRouter` from React/Next.js but does not declare `'use client'` at the top of the file, which will cause a server component rendering error. - [reference](src/app/(main)/today/page.tsx#L1)
- **`groupByGranularity` mutates accumulator object inside Ramda `reduce`** — The `innerAcc` object is mutated directly via `existing.sets = R.concat(...)` and `innerAcc[ex.name] = {...}`, violating the no-mutation standard. Ramda `reduce` expects pure functions; mutating the accumulator can cause unexpected behavior in strict mode or with frozen objects. - [reference](src/features/chart/chart-utils.ts#L39)
- **ISO week key year calculation may produce incorrect keys at year boundaries** — The `toISOWeekKey` function derives the ISO week year from the adjusted date's `getFullYear()`, but the week number is calculated against `yearStart` of the *original* year (line 9: `new Date(date.getFullYear(), 0, 1)` where `date` has already been shifted). For dates near year boundaries, this can produce incorrect week keys. - [reference](src/features/chart/chart-utils.ts#L4)
- **Tests assert TypeScript types at runtime, which violates testing standards** — The `chart-entity.spec.ts` and `range-filter.spec.ts` tests use `toBeTypeOf()` and `expect(sample).toBe('6M')` to verify type shapes. Per unit-jest.md, type correctness in TypeScript projects is handled by the compiler — don't test types at runtime. - [reference](src/features/chart/chart-entity.test.ts#L10)
- **`getAllExerciseChartData` server action passes `exerciseId` as `null` without null-check in service** — The `getAllExerciseChartData` action passes `exerciseId` as `null` to `service.getAllExercisesProgress`, which calls `repo.getVolumeByDate(userId, null, range, granularity)`. The repo correctly handles `null` exerciseId, but `getIntensitySplit` is called with `exerciseId` from `getVolumeByDate` path — when `exerciseId` is null, `getIntensitySplit` returns `[]` early, but this is not tested. - [reference](src/features/chart/chart-service.ts#L22)

**In Context Files** (pre-existing issues, nice to fix):

- **Plan docs committed to repo root** — `Plan-1.md`, `Plan-2.md`, `Plan-3.md`, and `TASKS-PLAN-2.md` are planning documents that should not be in the main branch. These are scratch artifacts from the development process. - [reference](Plan-1.md#L1)
- **Screenshot images committed to repo root** — 16 progress page screenshots are committed to the repo root, bloating the repository. These should be in a `screenshots/` directory or excluded via `.gitignore`. - [reference](progress-page-initial.png#L1)
- **`data.db` committed to repo** — An empty SQLite database file is committed. This should be in `.gitignore`. - [reference](data.db#L1)
- **[`.claude/worktrees/agent-a2f7d3f2f5619b952`](.claude/worktrees/agent-a2f7d3f2f5619b952#L1) committed** — A Claude worktree marker file was committed. This should be in `.gitignore`. - [reference](.claude/worktrees/agent-a2f7d3f2f5619b952#L1)

### Questions

- **Why was the per-exercise delete button removed from the history page?** — The history page no longer shows delete buttons on exercise cards. Was this moved elsewhere, or is deletion no longer supported from history? - [reference](src/app/(main)/history/HistoryPageClient.tsx#L91)
- **Why does the today page read `userId` from cookies in both the component and the `getStoredUserId` helper?** — The `getStoredUserId` function is defined as a module-level function but also called inside `debouncedSave`. The cookie parsing logic is duplicated conceptually. - [reference](src/app/(main)/today/page.tsx#L33)
- **Should the `RangeFilter` type rename be reflected in the UI labels?** — The range pills changed from `1M/3M/6M/ALL` to `6M/1Y/ALL`. The `1Y` label might confuse users — should it say "1 YEAR" instead of "1Y" for consistency with the existing "ALL" label? - [reference](src/app/progress/page.tsx#L168)
- **Why does `groupByGranularity` use `entries[0].date` as the group key instead of the group key itself?** — The function returns `date: entries[0].date` for session mode, but for week/month modes, the actual group key (e.g., `2025-W02`) is discarded in favor of the first entry's date. This means week-grouped data shows the first date of the week rather than the ISO week key. - [reference](src/features/chart/chart-utils.ts#L56)

### Nits

**In Changed Code**:

- **`DEBOUNCE_MS` constant could be extracted to a config file** — The 500ms debounce value is hardcoded. If it needs tuning later, it should be a named constant at the top of the file or extracted to a config. - [reference](src/app/(main)/today/page.tsx#L20)
- **`vi.mocked(groupByGranularity)` in test uses implicit any** — The `groupByGranularity` mock in `chart-repo-impl.test.ts` uses `vi.mocked()` which may not have proper type inference. Consider adding a type annotation. - [reference](src/features/chart/chart-repo-impl.test.ts#L15)
- **`R.cond` in `applyDateFilter` could be a simple object lookup** — The range filter uses `R.cond` with `R.equals` and `R.always` pairs. A plain object lookup would be more readable for this simple mapping. - [reference](src/features/chart/chart-repo-impl.ts#L35)
- **`handleToggleView` clears `exerciseSets` on view change** — When toggling to past view, the exercise sets are deleted from state. This means switching back to current view loses any unsaved edits. Consider keeping the sets and just hiding the inputs. - [reference](src/app/(main)/today/page.tsx#L280)
- **`mapRowToDataPoint` is exported but only used internally** — The function is exported but only used within the same file. Consider removing the export to keep the module boundary clean. - [reference](src/features/chart/chart-repo-impl.ts#L11)
- **`toISOWeekKey` uses `getDay() || 7` for Monday-Sunday mapping** — The ISO week calculation uses `date.getDay() || 7` to convert Sunday (0) to 7, which is correct for ISO week calculation but could be confusing. A clarifying comment would help. - [reference](src/features/chart/chart-utils.ts#L7)
- **`seed-bruno-data.js` has a hardcoded date `new Date(2026, 4, 9)`** — The seed script has a hardcoded "today" date. If run on a different date, it will generate different data. Consider making the date range configurable. - [reference](scripts/seed-bruno-data.js#L22)
- **Test files use `vi.fn() as any` pattern extensively** — Multiple test files cast all mock repository methods to `any` to work around type mismatches. This suppresses type errors but loses the benefit of type checking on mock setups. - [reference](tests/features/exercise/create-exercise.spec.ts#L6)
- **`[eslint-disable]` comments missing for `fp/no-mutation` violations** — The `groupByGranularity` function mutates `innerAcc` inside a Ramda `reduce` without an eslint-disable comment for `fp/no-mutation`. - [reference](src/features/chart/chart-utils.ts#L43)
- **`getVolumeByDate` calls `groupByGranularity` then re-maps the result** — After `groupByGranularity` returns `ChartBarData[]`, the code immediately re-maps each bar to extract `sets`, `exercises`, `volume`, and `date`. The re-mapping could be done inside `groupByGranularity` to avoid the extra pass. - [reference](src/features/chart/chart-repo-impl.ts#L87)

**In Context Files** (optional):

- **`chart-entity.test.ts` has duplicate `describe('ChartBarData')` blocks** — The file has two separate `describe('ChartBarData')` blocks at lines 3 and 57, which is unusual organization. - [reference](src/features/chart/chart-entity.test.ts#L3)
- **`assertExerciseInfo` and `assertChartDataPoint` helper functions are no-ops** — These functions take a parameter and do nothing with it. They exist only to satisfy the TypeScript type checker at compile time, but since they're called at runtime with no assertion, they're dead code. - [reference](src/features/chart/chart-entity.test.ts#L43)
- **`tests/db/schema.spec.ts` removed `autoIncrement` assertions** — The test removed assertions for `autoIncrement` on primary keys. If this is intentional (because the underlying DB doesn't support it), the reason should be noted. - [reference](tests/db/schema.spec.ts#L14)

**Recommendation**: Approve after fixing the missing `'use client'` directive and the accumulator mutation in `groupByGranularity`. The ISO week key issue and type-testing tests should also be addressed before merge.

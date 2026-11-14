# Review — kachalka-1vz.4.2 · branch `feature/typed-set-count`

Reviewer: review agent, worktree `/home/londelo/CastleLondelo/projects/kachalka/.claude/worktrees/feature+typed-set-count`.
Remote: `https://github.com/Londelo/kachalka` (GitHub). **No PR was posted to** — see *Delivery* at the bottom.

Commits under review (from `git log`, newest first):

```
74d449d tester-feature:  Feature suite for the typed set count on Today's Battle (9 seam tests)
e19fa92 frontend:        Make the SET box a typed count input on Today's Battle
39d80be tester-unit:     Pin the full failure envelope on the non-Error throw (30 cases in file)
7115781 tester-unit:     Unit-test the today-workouts projection's set count (8 cases, projection + envelope)
a811600 engineer:        Carry set count through the today-workouts projection
```

---

## Blocker that bounds this whole review

**This session has no shell tool.** The declared toolset is Read / Write / Edit / Grep / Glob / Skill. Consequences, each one a step of the brief I could not perform:

| Step | Command that was required | Status |
|---|---|---|
| 1 — read the ticket | `bd show --json kachalka-1vz.4.2 --long`, plus its children and the gate above | **NOT DONE.** The beads store is embedded Dolt (`.beads/metadata.json`: `{"store":"dolt","embedded":{"database":"kachalka"}}`) and there is no `.beads/issues.jsonl` export in the worktree or in the parent checkout — the only copies of the ticket text are inside the Dolt binary, reachable only through `bd`. I did not guess at the brief. |
| 1 — lease | `bd heartbeat kachalka-1vz.4.2` | **NOT RUN.** The claim lease has not been renewed by me at any point. |
| 2 — read the diff | `git diff --stat feature/typed-set-count...HEAD`, `git diff ...` | **NOT RUN.** Substituted: every file on the count wire read whole in its committed state, plus the commit titles above. I cannot separate what this branch added from what it inherited, so findings that could be pre-existing are labelled *attribution uncertain*. |
| 4 — instrument | `console.log` traces + running the app | **NOT RUN.** No shell to boot Next, no shell to read a trace. Substituted a static data-flow trace (§ Map below). Nothing was instrumented, so there is nothing to strip — `git status` is clean apart from this file. |
| 5 — run the checks | `npm run typecheck`, `npm test`, `npm run test:e2e` | **NOT RUN.** No test result is claimed anywhere below. Every statement about a test is a statement about its *source* — whether it could have failed — read off the file, not off a runner. |
| 7 — post | `git remote get-url origin`, `gh auth status`, `gh pr view --json number,url`, `gh pr comment --body-file` | **NOT RUN.** Per the `pr-comments` skill's Step 0, a comment needs a proven PR; with no shell I cannot prove one exists, and the skill's instruction is to write the findings to a file rather than improvise. That is what this file is. |

**Question 1 ("does the code do what its source of truth demands?") is therefore unanswered.** The ticket is the only statement of what was owed and it is unreachable from here. I did not substitute the commit titles for the brief. Everything below is a review of the code and its tests; the verdict against the requirement is withheld, and the done-marker was deliberately not created.

---

## Map — the system the count sits in

**Entry points** (three, all client-driven):
1. `src/app/today/page.tsx` `handleSetChange` (L387) → `triggerSave` → `debouncedSave` (500 ms) → `logWorkoutAction`.
2. Same page's load: `getTodayWorkoutsAction` + `getTodayExercisesAction`, both called on mount.
3. `src/app/history/HistoryPageClient.tsx` → `getHistoryAction`; `src/app/progress` → `chart-server-actions`.

**Write path (the feature's main line):**

```
SET box  today/page.tsx:132-142   value={set.count ?? ''}  type=number min=1 step=1
  → onSetChange(index,'count',e.target.value)
  → handleSetChange  L387   [field]: field==='count' ? parseCount(value) : parseFloat(value)||0
  → parseCount       L31    '' → undefined ; Number(v) NaN → undefined ; else number
  → updateSets (Map<exerciseId, WorkoutSet[]>, immutable replace)
  → debouncedSave    L330   validSets = sets.filter(s => s.weight!==0 || s.reps!==0)
                            today = new Date().toISOString().split('T')[0]   ← client UTC
  → logWorkoutAction(userId, exerciseId, today, sets)          [server boundary]
  → logWorkoutUseCase.execute   log-workout.ts:7
       · sets.length===0 → throw 'Must log at least one set'
       · for each set: validateSet(set)                        ← throws before any write
       · normalizedSets = sets.map(s => ({...s, count: normalizeSetCount(s.count)}))   L16
       · repo.findByDateAndExercise → repo.update(existing.id, normalizedSets)!   OR
                                    → repo.create({...createEmptyLog(...), sets: normalizedSets})
  → workout-repo-impl  JSON.stringify(sets) → workout_logs.sets (text column)
```

**Read path A — today prefill (the path this feature is about):**
`getTodayWorkoutsAction` (workout-server-actions.ts:87) → `new Date().toISOString().split('T')[0]` (L93, **server** UTC) → `repo.findByDate` → `mapRowToWorkoutLog` (workout-repo-impl.ts:19, `parsedSets.map(line => ({...line, count: normalizeSetCount(line.count)}))`) → adapter re-projects `log.sets.map(s => ({weight, reps, count: normalizeSetCount(s.count)}))` (L97-101) → `TodayWorkouts` → page Map state → the box.

**Read path B — last session (the path the feature did not touch):**
`getTodayExercisesAction` → `getTodayExercisesUseCase` (get-today-exercises.ts:27) → `workoutRepo.findLatestForExercise` → `lastLog.sets.map(s => ({weight: s.weight, reps: s.reps}))` (**L35 — count dropped**) → past-session view renders `SET:` as `String(idx+1).padStart(2,'0')` (page.tsx:97-99) — a positional label, not the stored count.

**Read path C — everywhere else the same rows are read:**
- `workout-repo-impl.findHistoryByDate` (L263) repeats the identical normalize line in its own mapper, and computes `volume: calculateVolume(parsedSets)`.
- `workout-entity.calculateVolume` (L31) = `Σ reps*weight` — `count` ignored.
- `chart-repo-impl.ts:34` and `:123` — `sets.reduce((t,s) => t + s.reps*s.weight, 0)` — `count` ignored.
- `HistoryPageClient.tsx:14` local type `sets: {id,reps,weight}[]` (no `count`); `totalSets = log.sets.length` (L102); `exerciseSets = log.sets.length` (L125); `exerciseReps = Σ s.reps` (L126).

**Branches:** upsert create/update (log-workout.ts:20); count normalization accept vs throw; client empty-line filter; current vs past session view.

**External dependencies:** none beyond the repo boundary. SQLite via better-sqlite3 + Drizzle, `getDatabase()` singleton (`src/config/db.ts`, WAL + `foreign_keys=ON`, `DATABASE_PATH` defaulting to `$(pwd)/data/kachalka.db`). No third-party service, no network call on this wire.

```
SET box ─► parseCount ─► Map state ─► debounce ─► logWorkoutAction ─► useCase(validate→normalize)
                                                                        │
                                              update ◄── findByDateAndExercise ──► create
                                                                        │
                                                            JSON column workout_logs.sets
                                                                        │
        ┌───────────────────────────────┬───────────────────────────────┤
        ▼                               ▼                               ▼
 getTodayWorkoutsAction        findLatestForExercise            findHistoryByDate / chart
 normalize ×2 → box shows 3    map{weight,reps} → count GONE    volume & SETS ignore count
```

---

## The three questions

### 1. Does the code do what its source of truth demands? — **CANNOT ANSWER**

The source of truth is ticket `kachalka-1vz.4.2` and its feature gate; both are inside the embedded Dolt store and `bd` is unreachable without a shell. What I *can* say from the code alone:

- **Paid, on the path the commits name:** a count typed in the SET box reaches the JSON column and comes back onto the rendered line. Verified by reading the wire end to end (§ Map, write path + read path A) — every step is present, nothing is dropped, and the normalization is applied at the write boundary so a rejected count writes nothing at all.
- **Not paid, on the paths the feature left alone:** the count is dropped on the last-session wire (finding 1) and contradicted by every aggregate consumer (finding 2). Whether that was owed here is exactly the question only the ticket can settle, which is why I am not certifying this branch.
- **Beyond the stated scope:** the count is normalized on *read* paths too, which converts a corrupt stored value into a thrown error on a page load (finding 3). Nothing in the commit titles asks for read-side validation.

### 2. Do the tests prove it? — **PARTLY. Three of the nine seam tests cannot fail, and the central defect is unproven in both directions.**

What genuinely can fail, and does pin behaviour:
- `workout-entity.spec.ts` — the `normalizeSetCount` tables (floor-to-1 for `undefined/null/''/0/-0/0.5`; pass-through for `1/3/2.7→2/'3'/' 4 '/'3.9'→3/'0'→1`; rejection for `-1/-0.5/NaN/±Infinity/'abc'/'1abc'/{}/[]/true`) are real. Delete any branch and a case dies.
- `log-workout.spec.ts` — the rejected-count case asserts `expect(repo.findByDateAndExercise).not.toHaveBeenCalled()`, which is the only test that would catch a validation that wrote before it validated. Good assertion.
- `workout-repo-impl.spec.ts:412-658` — read-path normalization exercised against real in-memory SQLite across all seven readers. This is the strongest coverage in the change.
- `today-set-count.spec.ts` — the store assertions (`expectStoredSets`, and `expect(raw?.[0]).not.toHaveProperty('count')` on the legacy case) read the DB directly rather than trusting the UI. That is a real seam.

What is unproven:
- **The count-dropping on the last-session wire has no test on either side.** `get-today-exercises.spec.ts:89-116` asserts `lastLog` equals `[{weight,reps},…]` from a mock whose input lines carry **no `count` at all** — so the projection's omission is never exercised, and the test would pass unchanged whether or not the map dropped the field.
- **Corrupt stored counts are covered by exactly one value.** `{"count":0} → 1` across the readers; nothing throws a `'-1'`, `'abc'`, or `null` through a *read* path, which is where finding 3 bites.
- **The adapter's redundant normalization is invisible to its own test.** `workout-server-actions.spec.ts` mocks the repository, so the repo's normalization never runs; the test asserts the output shape and can only detect the adapter's `normalizeSetCount` call by deleting it and watching `count` go missing — but it never goes missing, because the mock returns already-normalized data. The test cannot distinguish "adapter normalizes" from "adapter passes through".
- **`parseCount`'s NaN branch is live and untested.** `pressSequentially('abc')` cannot reach it: Chromium's `input[type=number]` swallows letter keystrokes, so the two assertions that follow — `expect(typed).not.toContain('NaN')` and `expect(typed).not.toMatch(/[a-c]/i)` — assert *browser* behaviour and can never fail regardless of what the app does. The inputs that do reach the NaN branch (`-`, `.`, `e`) are never typed in any test.
- **`0 → 1` is pinned as correct alongside `-1 → throw`** (finding 4), so the arbitrary boundary is now frozen by two tests rather than examined by one.
- **`workout-repo-impl.spec.ts:645`** `expect(history[0].logs[0].volume).toBe(675)` — with a stored `count: 3` and `5×135`, this pins volume-at-reps×weight, converting finding 2's contradiction into specified behaviour.

### 3. Is it simple and readable? — **THE CORE IS; THE EDGES ARE NOT**

`normalizeSetCount` is a clean, total function and `logWorkout.ts` reads the way a use case should: validate everything, then write once. That part I would write the same way today.

What I would not write again: the same normalization call in four places (write boundary, repo mapper, history mapper, server adapter) — findings 5 and 6; two numeric parse dialects side by side in one handler (finding 7); and the canonical `getTodayISO()` left unused while its expression is hand-written three more times (finding 8). None of that is exotic, all of it is the kind of drift that makes the next change to this rule miss a copy.

---

## Findings

<details>
<summary><h3>1. The count is dropped on the last-session wire — the e2e header claims the whole wire</h3></summary>

**Problem:** `src/features/workout/get-today-exercises.ts:35` projects the previous session's sets as `lastLog.sets.map((s) => ({ weight: s.weight, reps: s.reps }))` — `count` is discarded. The past-session view at `src/app/today/page.tsx:97-99` then renders `SET:` as `String(idx + 1).padStart(2, '0')`, a row number. So the same word "SET" means *how many sets* on the current-session card and *which row* on the past-session card, and the count the user typed is invisible the moment they toggle to the last session. `tests/e2e/today-set-count.spec.ts:8-11` states the suite "proves the count travels the whole wire … onto the rendered line again" — it proves one of the three read paths.

**Solution:** carry `count` through the `lastLog` projection and render it in the past-session row beside weight and reps, or state in the ticket that the last-session view is out of scope and stop the test header from claiming it.

**Evidence:** Step 3 map, read path B; confirmed against `get-today-exercises.spec.ts:89-116`, whose mock input carries no `count`, so no test on either side can see the omission.

**Code:**
```ts
// src/features/workout/get-today-exercises.ts:34-36
lastLog: lastLog
  ? lastLog.sets.map((s) => ({ weight: s.weight, reps: s.reps }))
  : null
```
</details>

<details>
<summary><h3>2. Every consumer of a stored set still treats one line as exactly one set</h3></summary>

**Problem:** the new field says a line can represent *N* sets. Nothing downstream of Today's Battle was told. `src/app/history/HistoryPageClient.tsx:102` `totalSets = log.sets.length`, `:125` `exerciseSets = log.sets.length`, `:126` `exerciseReps = Σ s.reps`; `src/features/workout/workout-entity.ts:31` `calculateVolume = Σ reps*weight`; `src/features/chart/chart-repo-impl.ts:34` and `:123` the same product. A line of `count:3, reps:5, weight:135` is a 3×5@135 session and War Logs reports 1 set, 5 reps, 675 volume — where the user's own mental model says 15 reps and 2025 volume. The feature introduces a meaning and then leaves the meaning contradicted on the two screens that display the number.

**Solution:** decide the semantics once, in the entity — either `count` is a multiplier that `calculateVolume` and the SETS/REPS aggregates must apply, or it is display metadata that they must never see. Then make the aggregates agree with that decision and say which was chosen on the ticket.

**Evidence:** Step 3 map, read path C; `workout-repo-impl.spec.ts:645` shows the choice was made but never stated — and made silently.

**Code:**
```ts
// src/features/workout/workout-entity.ts:31-33  — count never enters the sum
export function calculateVolume(sets: { reps: number; weight: number }[]): number {
  return sets.reduce((total, set) => total + set.reps * set.weight, 0)
}
```
</details>

<details>
<summary><h3>3. Normalizing on the read path turns one corrupt stored row into a silently blank page</h3></summary>

**Problem:** `normalizeSetCount` throws, and it is now called from readers — `workout-repo-impl.ts:19`, `:263`, and `workout-server-actions.ts:100`. A row written before this change, or hand-edited, or holding `{"count":"abc"}`, makes `getTodayWorkoutsAction` throw inside its `try`, land in the `catch` at `:104`, and return `{ success: false, error: 'Set count must be at least 1', workouts: null }`. The user sees an empty Today's Battle with no stored data lost and no explanation, and cannot fix it from the UI because the box that would fix it is not rendered. This is the standards-errors rule against failing silently, inverted: the failure is real but invisible.

**Solution:** a read path should not validate. Normalize on the way in (which `log-workout.ts:16` already does, completely) and have readers coerce defensively — `Math.max(1, Math.floor(Number(line.count)) || 1)` — reserving the throw for user input at the write boundary.

**Evidence:** Step 3 map + Step 6 first-principles pass; `workout-repo-impl.spec.ts` corrupt-count coverage is `{"count":0} → 1` only, so no test has ever put a throwing value through a reader.

**Code:**
```ts
// src/features/workout/workout-server-actions.ts:97-102
workouts[log.exerciseId] = log.sets.map(s => ({
  weight: s.weight, reps: s.reps, count: normalizeSetCount(s.count),  // throws → whole page nulls
}))
```
</details>

<details>
<summary><h3>4. `0` is forgiven and `-1` is refused, with no stated reason, and both are pinned</h3></summary>

**Problem:** `workout-entity.ts:12` rejects on `value < 0`, then `:16` clamps with `Math.max(1, …)`. So `0`, `-0`, `0.5` silently become 1 while `-1` and `-0.5` throw `Set count must be at least 1`. The clamp already makes any value below 1 harmless, so the throw exists only for negatives — a boundary with no reason behind it, and the error message is a lie about the input that produced it (`-0.5` is not "at least 1" either, but never reaches that message). Two policies in six lines. `workout-entity.spec.ts` pins both halves, and `today-set-count.spec.ts:204` (`a count box of 0 stores and redisplays 1`) and `:292` (negative refused) pin them again at the seam, so the inconsistency is now specified behaviour with tests defending each side.

**Solution:** pick one. Either reject anything below 1 (`if (!Number.isFinite(value) || value < 1) throw …`) and drop the clamp, or clamp everything and never throw. Then delete the tests defending the half that goes.

**Evidence:** Step 6 first-principles pass against `workout-entity.ts:5-17`, cross-read with the two spec tables.

**Code:**
```ts
// src/features/workout/workout-entity.ts:12-16
if (!Number.isFinite(value) || value < 0) throw new Error('Set count must be at least 1')
return Math.max(1, Math.floor(value))
```
</details>

<details>
<summary><h3>5. `normalizeSetCount` runs twice on the same value, and the second copy is a domain rule living in the `'use server'` adapter</h3></summary>

**Problem:** by the time `workout-server-actions.ts:100` calls `normalizeSetCount(s.count)`, `s` came out of `mapRowToWorkoutLog` (`workout-repo-impl.ts:19`), which already normalized it. The adapter's call is dead weight on every load. Worse is the placement: every other read in this feature goes through a use case (`getWorkoutHistoryUseCase`, `getTodayExercisesUseCase`, `getUserVolumeUseCase`), and `getTodayWorkoutsAction` is the one that hand-rolls its projection in the `'use server'` file — a business rule in the outermost adapter, which is the layer the Dependency Rule says must hold no rules.

**Solution:** delete the adapter's `normalizeSetCount` call (the repo guarantees the value) and move the projection into a use case beside its siblings, so the adapter is composition and try/catch only.

**Evidence:** Step 3 map, read path A; Step 2 read of the whole adapter file against its neighbours. `workout-server-actions.spec.ts` mocks the repo, so no test can tell the redundant call from a necessary one.

**Code:**
```ts
// src/features/workout/workout-server-actions.ts:87-108 — no use case, hand-rolled projection
const today = new Date().toISOString().split('T')[0]
const logs = repo.findByDate(userId, today)
for (const log of logs) { workouts[log.exerciseId] = log.sets.map(s => ({ ...count: normalizeSetCount(s.count) })) }
```
</details>

<details>
<summary><h3>6. The same mapper line is written twice in one file</h3></summary>

**Problem:** `workout-repo-impl.ts:19` (`mapRowToWorkoutLog`) and `:263` (inside `findHistoryByDate`, which builds its own row mapper instead of reusing the first) both carry `parsedSets.map((line) => ({ ...line, count: normalizeSetCount(line.count) }))`. Two copies of the rule for decoding one column, in one file, 244 lines apart. The next change to how a set line is decoded has to find both, and nothing will tell the next reader there are two.

**Solution:** have `findHistoryByDate` use `mapRowToWorkoutLog` (or extract the set-line decoder alone and call it from both). One rule, one place.

**Evidence:** Step 2, reading the repo implementation whole rather than the diff hunk.

**Code:**
```ts
// workout-repo-impl.ts:19 and :263 — identical
parsedSets.map((line) => ({ ...line, count: normalizeSetCount(line.count) }))
```
</details>

<details>
<summary><h3>7. Two numeric parse dialects in one change handler</h3></summary>

**Problem:** `today/page.tsx:387` — `[field]: field === 'count' ? parseCount(value) : parseFloat(value) || 0`. The count field has a named parser returning `number | undefined`; weight and reps use an inline `parseFloat(value) || 0` that folds `NaN`, `''`, and a typed `0` into the same `0`. Two ways to read a number out of an input in one line of code, and the difference is invisible to whoever adds the fourth field. `parseCount` also has a NaN branch (`:31-35`) that no test reaches, because the only garbage-typing test types letters, which Chromium's number input swallows before the handler sees them.

**Solution:** one `parseNumericField(field, value)` covering all three, with the empty-vs-zero distinction explicit rather than a `|| 0` side effect.

**Evidence:** Step 6 readability pass; the unreachable-NaN conclusion from Step 2 read of `today-set-count.spec.ts:310-331`.

**Code:**
```ts
// src/app/today/page.tsx:387
[field]: field === 'count' ? parseCount(value) : parseFloat(value) || 0,
```
</details>

<details>
<summary><h3>8. The canonical date helper is unused while its expression is hand-written three times, and the client picks the date the server stores</h3></summary>

**Problem:** `src/shared/utils/date.ts` exports `getTodayISO()`, which is exactly `new Date().toISOString().split('T')[0]`. That expression is written by hand at `today/page.tsx:330` (the date the *client* asks to save under), at `workout-server-actions.ts:93` (the date the *server* reads back under), and at `tests/e2e/today-set-count.spec.ts:30`. `todayDayIndex()` at `:35` re-implements `jsDayToAppIndex()` from the same shared module for the same reason. Today's Battle writes under the client's UTC day and reads under the server's; a user on UTC+13 at 11pm writes to a date the server, at 10am UTC, will not read back as today — and the e2e cannot see it because browser and server share one clock. The repo already solved this once; the new code reached past the solution for the literal.

**Solution:** import `getTodayISO()` and `jsDayToAppIndex()` in the page and the spec. If the client is meant to own the date, say so and have the server take the date as a parameter instead of deriving its own.

**Evidence:** Step 3 map, write path and read path A; `shared/utils/date.ts` read against the three call sites.

**Code:**
```ts
// today/page.tsx:330 · workout-server-actions.ts:93 · tests/e2e/today-set-count.spec.ts:30
const today = new Date().toISOString().split('T')[0]
```
</details>

<details>
<summary><h3>9. A garbage-typing test asserts browser behaviour with assertions that cannot fail</h3></summary>

**Problem:** `today-set-count.spec.ts:317-321` types `'abc'` with `pressSequentially` and then asserts `expect(typed).not.toContain('NaN')` and `expect(typed).not.toMatch(/[a-c]/i)`. Chromium's `input[type=number]` discards letter keystrokes before any app code runs, so both assertions hold for every possible implementation of `parseCount` — including one that returned `NaN` for every input. The test reads as coverage of garbage input and provides none of the app's own logic; meanwhile the inputs that *do* reach the app's NaN branch (`-`, `.`, `e`) are typed by no test.

**Solution:** drive the parse directly — a unit test over `parseCount` for `''`, `'-'`, `'.'`, `'e'`, `'1e3'`, `' 4 '`, `'abc'` — and in the e2e type the characters the browser forwards, asserting the stored value rather than the box's string.

**Evidence:** Step 2, "could this test have failed" pass over the nine seam tests.

**Code:**
```ts
// tests/e2e/today-set-count.spec.ts:317-321
await countBox(page, exerciseId, 0).pressSequentially('abc')
const typed = await countBox(page, exerciseId, 0).inputValue()
expect(typed).not.toContain('NaN')      // true whatever the app does
expect(typed).not.toMatch(/[a-c]/i)     // true whatever the app does
```
</details>

<details>
<summary><h3>10. The row is located by `xpath=../..`, and the two boxes beside the count box have no selector</h3></summary>

**Problem:** `today-set-count.spec.ts:103-105` reaches a set row with `countBox(...).locator('xpath=../..')` — the test's idea of a row is "two levels above the count box" — and then addresses weight and reps positionally, `input[type="number"]` `.nth(1)` / `.nth(2)`, in five tests. The count box got `data-id` and `aria-label` (`page.tsx:141-142`); the LB and REPS boxes beside it got neither, so positional addressing is the only option the code leaves. The repo's own convention is that every interactive element carries a `data-id`. Reordering the three boxes, or adding a fourth, breaks five tests with no compile error and no useful failure message.

**Solution:** give the weight and reps inputs `data-id={`set-weight-input-${exerciseId}-${index}`}` / `set-reps-input-…` and a row `data-id`, then select by attribute everywhere and delete `setRow`'s xpath.

**Evidence:** Step 2 read of the spec against `today/page.tsx:130-150`; the missing attributes are visible in the same JSX block as the one that has them.

**Code:**
```ts
// tests/e2e/today-set-count.spec.ts:103-105
function setRow(page, exerciseId, index) {
  return countBox(page, exerciseId, index).locator('xpath=../..')
}
```
</details>

<details>
<summary><h3>11. A blanked or fractional count leaves the box disagreeing with the store until reload, and tests pin the disagreement</h3></summary>

**Problem:** `page.tsx:135` renders `value={set.count ?? ''}`, and `parseCount('')` returns `undefined`, so after clearing the box the component holds `count: undefined` while the server stores `1`. `today-set-count.spec.ts:193-201` asserts exactly this split state — box shows `''`, store holds `1`, and only after `page.reload()` does the box show `1`. The user who blanks the box, waits, and looks at it sees an empty field for a value that is already saved as one; if they navigate away before a refetch the two readings diverge in their head. The test documents the behaviour as intended, which means nobody decided it — the test followed the code.

**Solution:** normalize on the way into state, not only on the way out: store `count: parseCount(value) ?? 1` and render `value={set.count}`, accepting that a mid-typing empty box snaps to 1 — or keep the split deliberately and say why on the ticket, and change the test's name from "stores and redisplays 1" to name the intermediate lie.

**Evidence:** Step 2 read of the spec's blank-box case against `page.tsx:131-143` and `:31-35`.

**Code:**
```ts
// tests/e2e/today-set-count.spec.ts:193-196
await countBox(page, exerciseId, 0).fill('')
await expect(countBox(page, exerciseId, 0)).toHaveValue('')      // box says nothing
await expectStoredSets(exerciseId, [{ count: 1, weight: 225, reps: 3 }])  // store says 1
```
</details>

<details>
<summary><h3>12. Nit — `defaultSet()` seeds `reps: 1`, so the documented empty-line filter can never fire</h3></summary>

**Suggestion:** `page.tsx:28` `return { id: generateId(), count: 1, reps: 1, weight: 0 }` — a fresh line starts at `reps: 1`, so `debouncedSave`'s `sets.filter(s => s.weight !== 0 || s.reps !== 0)` (`:330`) is never true-by-zero for a new line, and the CLAUDE.md rule "auto-save filters out sets where both weight and reps are 0" describes a branch that a UI-created line cannot reach. `reps: 0` would make the documented rule live. *Attribution uncertain — without `git diff` I cannot tell whether `reps: 1` is new here or inherited; the `count: 1` beside it certainly is.*
</details>

---

## Standards — house-rule breaches, kept separate from the three answers

Against `standards-coding`, `standards-naming`, `standards-errors`, `standards-file-organization`:

| # | Rule | Where | What |
|---|---|---|---|
| S1 | FCIS / Dependency Rule — "the core holds the rules, the shell holds I/O" | `workout-server-actions.ts:87-108` | A read projection with a business rule inside the `'use server'` adapter, while every sibling read goes through a use case. Finding 5. |
| S2 | "Don't fail silently" | `workout-server-actions.ts:104-107` | A thrown validation on the read path is swallowed into `{success:false, workouts:null}`; the user loses the page and the cause. Finding 3. |
| S3 | Pure core never throws on data it did not receive as input | `workout-repo-impl.ts:19`, `:263` | Readers throw on stored data. Validation belongs at the inbound boundary only. Finding 3. |
| S4 | DRY / Common Closure — one rule, one home | `workout-repo-impl.ts:19` vs `:263`; adapter `:100`; `log-workout.ts:16` | One normalization rule in four places. Findings 5, 6. |
| S5 | Naming — normalizer vs formatter must not share a file, and a normalizer is inbound | `workout-entity.ts` | `normalizeSetCount` is an inbound normalizer being used as an outbound formatter on read paths — the naming standard's "opposite directions" rule, violated by usage rather than by file layout. Finding 3's root. |
| S6 | Declarative style — no loops | `log-workout.ts:12-14` (`for (const set of sets) validateSet(set)`), `workout-server-actions.ts:96` (`for (const log of logs)`) | `fp/no-loops` in the paradigm's enforced-rules table. Both are `forEach`/`reduce`-shaped. Pre-existing style in `log-workout.ts`; the loop at `workout-server-actions.ts:96` is new in this change. |
| S7 | Repo convention — "every interactive element has `data-id`" | `today/page.tsx` weight/reps inputs | Missing on the two boxes the feature shipped beside. Finding 10. |
| S8 | Use the shared utility, don't re-literal it | `page.tsx:330`, `workout-server-actions.ts:93`, spec `:30`,`:35` | `getTodayISO()` and `jsDayToAppIndex()` exist and are bypassed four times. Finding 8. |

Not breached: vertical slices (all changes landed inside `features/workout` and the page that owns them), factory-function style (no classes introduced), immutability (the Map updates and the `sets.map` normalization are spread-based, no mutation), and file naming.

---

## Delivery

`pr-comments` Step 0 requires `git remote get-url origin`, `gh auth status`, and `gh pr view --json number,url` run from inside this worktree before anything is posted. **No shell tool exists in this session, so none of the three could be run, and I could not prove a PR exists.** The skill's instruction on a failed check is explicit — do not improvise, write the findings to a file in the worktree and name the file. That is this file:

`/home/londelo/CastleLondelo/projects/kachalka/.claude/worktrees/feature+typed-set-count/REVIEW-kachalka-1vz.4.2.md`

The remote is GitHub (`https://github.com/Londelo/kachalka`, and `feature/typed-set-count` is tracked on origin per `.git/config:16-18`), so when a shell is available the findings post with:

```bash
gh pr view --json number,url                                   # confirm the PR for this branch
gh pr review --comment --body-file REVIEW-kachalka-1vz.4.2.md  # neutral: never certifies the branch
```

Nothing was committed, staged, pushed, closed, or spawned. No trace logs were added, so there is nothing to strip — the working tree holds this file and nothing else.

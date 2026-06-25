# Lifting App — Data Flow & Relationships

Real-life example: Alice, Bob, and Charlie tracking their workouts.

---

## Entities

### `users`

| Column | Type | Example |
|---|---|---|
| `id` | INTEGER (PK) | 1 |
| `name` | TEXT | "Alice" |

### `exercises`

| Column | Type | Example |
|---|---|---|
| `id` | INTEGER (PK) | 1 |
| `name` | TEXT | "Bench Press" |
| `created_by` | INTEGER (FK → users) | 1 (Alice owns it) |

### `user_routines`

| Column | Type | Example |
|---|---|---|
| `id` | INTEGER (PK) | 1 |
| `user_id` | INTEGER (FK → users) | 1 (Alice) |
| `exercise_id` | INTEGER (FK → exercises) | 1 (Bench Press) |
| `day_of_week` | TEXT | "Monday" |

Unique constraint: `(user_id, exercise_id, day_of_week)` — no duplicate exercise on the same day.

### `workout_logs`

| Column | Type | Example |
|---|---|---|
| `id` | INTEGER (PK) | 1 |
| `user_id` | INTEGER (FK → users) | 1 (Alice) |
| `exercise_id` | INTEGER (FK → exercises) | 1 (Bench Press) |
| `date` | TEXT | "2025-01-06" |
| `sets` | TEXT (JSON) | `[{"reps":5,"weight":185}, ...]` |

---

## Real-Life Example

### Step 1: Users sign up

```
users
┌──────┬──────────┐
│  id  │   name   │
├──────┼──────────┤
│  1   │  Alice   │
│  2   │   Bob    │
│  3   │ Charlie  │
└──────┴──────────┘
```

### Step 2: Alice creates exercises (she becomes owner)

```
exercises
┌────┬─────────────┬──────────────┐
│ id │    name     │ created_by   │
├────┼─────────────┼──────────────┤
│  1 │ Bench Press │ 1 (Alice)    │
│  2 │   Squat     │ 1 (Alice)    │
└────┴─────────────┴──────────────┘
```

Bob creates his own:

```
┌────┬──────────┬──────────────┐
│ id │   name   │ created_by   │
├────┼──────────┼──────────────┤
│  3 │ Deadlift │ 2 (Bob)      │
└────┴──────────┴──────────────┘
```

All exercises live in a **shared pool** — Charlie can use Alice's Bench Press and Alice can use Bob's Deadlift. But only Alice can delete/rename Bench Press, and only Bob can delete/rename Deadlift.

### Step 3: Alice builds her weekly routine

```
user_routines
┌────┬─────────┬─────────────┬───────────────┐
│ id │ user_id │ exercise_id │ day_of_week   │
├────┼─────────┼─────────────┼───────────────┤
│  1 │   1     │     1       │ Monday        │  ← Alice: Bench Press on Mon
│  2 │   1     │     2       │ Monday        │  ← Alice: Squat on Mon
│  3 │   1     │     1       │ Thursday      │  ← Alice: Bench Press on Thu
└────┴─────────┴─────────────┴───────────────┘
```

### Step 4: Alice logs her Monday workout

```
workout_logs
┌────┬─────────┬─────────────┬────────────┬──────────────────────────────────────────┐
│ id │ user_id │ exercise_id │   date     │ sets                                     │
├────┼─────────┼─────────────┼────────────┼──────────────────────────────────────────┤
│  1 │   1     │      1      │ 2025-01-06 │ [{"reps":5,"weight":185},               │
│    │         │             │            │  {"reps":5,"weight":195},               │
│    │         │             │            │  {"reps":5,"weight":205}]               │
├────┼─────────┼─────────────┼────────────┼──────────────────────────────────────────┤
│  2 │   1     │      2      │ 2025-01-06 │ [{"reps":5,"weight":225},               │
│    │         │             │            │  {"reps":5,"weight":245}]               │
└────┴─────────┴─────────────┴────────────┴──────────────────────────────────────────┘
```

### Step 5: Volume is derived

```
Bench Press volume = (5×185) + (5×195) + (5×205) = 3,075 lbs
Squat volume       = (5×225) + (5×245)       = 2,350 lbs
Total volume       = 3,075 + 2,350            = 5,425 lbs
```

---

## How It All Connects

```
users (1: Alice)
  │
  ├─── creates ──→ exercises (1: Bench Press, 2: Squat) — Alice is owner
  │
  └─── has ─────→ user_routines (links Alice → exercises → days)
         │
         └─── on Monday → logs ──→ workout_logs (date, sets as JSON)
                │
                └─── derived ──→ History (grouped by date, newest first)
                │
                └─── derived ──→ Progress Chart (volume over time per exercise)
```

---

## Key Rules

1. **Exercise ownership** — only the creator can rename/delete their exercise
2. **Cascade renames** — when Alice renames "Bench Press" → "Flat Bench", it updates everywhere automatically
3. **No orphan deletes** — you can't delete an exercise that's in someone's routine
4. **One exercise per day** — Alice can't put Bench Press twice on Monday
5. **Multiple sessions per day** — Alice could log morning and evening workouts separately
6. **Volume = Σ(reps × weight)** — calculated per session, never stored in DB
7. **Data isolation** — Charlie never sees Alice's logs; they share only the exercise pool

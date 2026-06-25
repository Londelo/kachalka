# Lifting App — Business Logic, Schema & UX Plan

## 1. Business Logic

### User Selection
- On app launch, user sees a list of known users
- User selects their name from the list
- If their name is not listed, they can type a new name and add it
- Adding a new user creates an empty profile with no exercises assigned

### Exercise Management
- Exercises exist in a **shared global pool** — any user can create or reference them
- When creating an exercise, the creating user becomes the owner
- **Only the owner can rename or delete** their exercise
- An exercise **cannot be deleted** if it is currently referenced in any user's routine
- When an owner renames an exercise, the new name **auto-updates** in all users' routines

### Routine Management
- Each user has their own routine: a mapping of exercises to days of the week (Monday through Sunday)
- An exercise can be assigned to multiple days
- An exercise cannot be assigned twice on the same day for the same user

### Workout Logging
- Each day, the user can log their workout sets
- A workout log includes: exercise, date, and an array of sets (each with reps and weight)
- Users can log multiple sessions per day (e.g., morning and evening workouts)
- Logs are saved with the current date

### History & Stats
- History shows a scrollable list of past workout logs, grouped by date
- Users can **edit or delete** past entries
- Volume metric: **sum of (sets x reps x weight)** — for each logged set, multiply reps x weight, then sum across all sets for the total volume
- Exercise progress chart: user selects an exercise from a dropdown, sees a bar chart of volume over time
- Hovering over a bar shows the raw set-level details (individual reps, weights, and the calculated volume)

### Data Isolation
- All data (routines, workout logs) is per-user
- Users cannot see other users' workout logs or history
- Users can see and reference the shared exercise pool

---

## 2. Database Schema

### `users`
| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| `name` | TEXT | UNIQUE, NOT NULL |

### `exercises`
| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| `name` | TEXT | NOT NULL |
| `created_by` | INTEGER | REFERENCES users(id), NOT NULL |

### `user_routines`
| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| `user_id` | INTEGER | REFERENCES users(id), NOT NULL |
| `exercise_id` | INTEGER | REFERENCES exercises(id), NOT NULL |
| `day_of_week` | TEXT | CHECK IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), NOT NULL |

- **Unique constraint**: (`user_id`, `exercise_id`, `day_of_week`) -- prevents duplicate exercise assignments on the same day

### `workout_logs`
| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| `user_id` | INTEGER | REFERENCES users(id), NOT NULL |
| `exercise_id` | INTEGER | REFERENCES exercises(id), NOT NULL |
| `date` | TEXT | FORMAT YYYY-MM-DD, NOT NULL |
| `sets` | TEXT | JSON array of `[{rep: number, weight: number}]`, NOT NULL |

- Multiple logs allowed per user/exercise/date (supports multiple sessions per day)

---

## 3. Frontend Design & User Flow

### Page 1: User Selection (Login)
- Title: "Select your user"
- List of existing user names as clickable cards/buttons
- Text input + "Add" button to create a new user
- On selection or creation -> redirect to Profile page

### Page 2: Profile / Routine Setup
- Title: "Your Routine"
- Section for each day of the week (Monday through Sunday)
- Each section shows:
  - Day name as a header
  - List of exercises currently assigned to that day
  - "Add exercise" dropdown (populated from global exercise pool)
  - "Remove" button next to each assigned exercise
- "Save" button to persist changes
- On first-time setup (no exercises assigned), user is guided to add at least one exercise
- After setup is complete -> redirect to Today's Workouts page

### Page 3: Today's Workouts
- Title: "Today's Workout"
- Shows exercises scheduled for the current day
- Each exercise card displays:
  - Exercise name
  - "Add Set" button (or "Edit" if sets already logged for today)
  - If sets have been logged today, shows a summary: "X sets logged"
- Clicking an exercise opens a set logging modal/panel:
  - List of sets, each with inputs: Reps, Weight
  - "Add Set" / "Remove Set" buttons
  - Last session's numbers appear as placeholder values in inputs
  - "Save" button to persist the logged sets
- If no exercises are scheduled for today -> shows "No workout scheduled for today" message
- Navigation to History and Config pages available via top nav bar

### Page 4: History
- Title: "Workout History"
- Scrollable list grouped by date (most recent first)
- Each date group shows:
  - Date header
  - List of exercises logged on that date
  - Each exercise shows: name, number of sets, total volume
- Clicking an exercise entry opens a detail view:
  - List of all sets (reps, weight)
  - Edit button to modify sets
  - Delete button to remove the entire log entry
- No chart on this page (separate chart page)

### Page 5: Exercise Progress Chart
- Title: "Exercise Progress"
- Dropdown to select an exercise (populated from user's logged exercises)
- Bar chart showing volume over time (one bar per logged session)
- X-axis: date, Y-axis: volume (sets x reps x weight)
- Hovering over a bar shows tooltip with:
  - Date
  - Individual sets (reps x weight for each set)
  - Total volume for that session
- If no data exists for the selected exercise -> shows "No data yet" message

### Page 6: Config
- Title: "Settings"
- Same routine editor as the Profile page (days + exercise assignments)
- Option to delete user account (with confirmation)
- Navigation back to Today's Workouts

### Navigation
- Top nav bar visible on all pages after login:
  - "Today" -> Today's Workouts
  - "History" -> History
  - "Progress" -> Exercise Progress Chart
  - "Config" -> Config
  - "Logout" -> User Selection page

---

## 4. User Flow Summary

```
[App Launch]
      |
      v
User Selection ---> [Select existing user] ---> Profile Setup
      |                        |
      |                        +---> [Add new user] ---> Profile Setup
      |
      v
Profile Setup ---> [Add exercises to days] ---> Today's Workouts
      |
      +---> [Skip / already set up] ---> Today's Workouts
      |
      v
Today's Workouts <----------------------------------------
      |                                                     |
      +---> [Log workout] ---> Save sets ----+              |
      |                                      |              |
      +---> [History] ---> View/Edit logs ---+              |
      |                                      |              |
      +---> [Progress Chart] ---> Select exercise, view chart | |
      |                                                     |
      +---> [Config] ---> Edit routine ----------------------+
      |
      +---> [Logout] ---> User Selection
```

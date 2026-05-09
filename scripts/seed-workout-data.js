// Quick script to reset and seed workout data into the SQLite DB.
// Run with: node scripts/seed-workout-data.js
const Database = require('better-sqlite3')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'data', 'kachalka.db')
const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

// ---- Phase 1A: DELETE ALL existing workout data ----
console.log('=== CLEARING EXISTING DATA ===')

db.exec('DELETE FROM workout_logs')
db.exec('DELETE FROM user_routines')
db.exec('DELETE FROM exercises')
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'exercises', 'workout_logs', 'user_routines')")

const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get()
console.log(`Users remaining: ${userCount.c}`)

if (userCount.c === 0) {
  console.error('ERROR: no users found. Cannot seed data without a user.')
  db.close()
  process.exit(1)
}

// Use user 2 (Brodie) for the seed data
const user = db.prepare('SELECT id FROM users WHERE id = 2').get()
const userId = user ? user.id : 1
console.log(`Using user id=${userId}`)

// ---- Phase 1B: SEED DATA ----
console.log('\n=== SEEDING WORKOUT DATA ===')

const insertExercise = db.prepare(
  'INSERT INTO exercises (name, user_id) VALUES (?, ?)',
)

const insertLog = db.prepare(
  'INSERT INTO workout_logs (user_id, exercise_id, date, sets) VALUES (?, ?, ?, ?)',
)

// Build exercise list
const exerciseNames = [
  'Bench Press',
  'Overhead Press',
  'Squat',
  'Leg Press',
  'Deadlift',
  'Barbell Row',
  'Incline Dumbbell Press',
  'Pull-Up',
]

const exerciseIds = {}
for (const name of exerciseNames) {
  const result = insertExercise.run(name, userId)
  exerciseIds[name] = result.lastInsertRowid
  console.log(`  Created exercise "${name}" (id=${exerciseIds[name]})`)
}

// Workout sessions: each session has a date and list of exercises
// Each exercise has sets: [{reps, weight}]
// "bodyweight" is represented as weight=0 with a note in the output
const sessions = [
  {
    date: '2026-01-05',
    label: 'Session 1 — MON 05 JAN 2026',
    exercises: [
      {
        name: 'Bench Press',
        sets: [
          { reps: 10, weight: 95 },
          { reps: 10, weight: 95 },
          { reps: 10, weight: 95 },
          { reps: 8, weight: 125 },
        ],
      },
      {
        name: 'Overhead Press',
        sets: [
          { reps: 10, weight: 65 },
          { reps: 10, weight: 65 },
          { reps: 10, weight: 65 },
          { reps: 8, weight: 85 },
        ],
      },
    ],
  },
  {
    date: '2026-01-07',
    label: 'Session 2 — WED 07 JAN 2026',
    exercises: [
      {
        name: 'Squat',
        sets: [
          { reps: 10, weight: 135 },
          { reps: 10, weight: 135 },
          { reps: 10, weight: 135 },
          { reps: 8, weight: 165 },
        ],
      },
      {
        name: 'Leg Press',
        sets: [
          { reps: 10, weight: 185 },
          { reps: 10, weight: 185 },
          { reps: 10, weight: 185 },
          { reps: 8, weight: 225 },
        ],
      },
    ],
  },
  {
    date: '2026-01-09',
    label: 'Session 3 — FRI 09 JAN 2026',
    exercises: [
      {
        name: 'Deadlift',
        sets: [
          { reps: 5, weight: 185 },
          { reps: 5, weight: 185 },
          { reps: 5, weight: 185 },
          { reps: 3, weight: 225 },
        ],
      },
      {
        name: 'Barbell Row',
        sets: [
          { reps: 10, weight: 95 },
          { reps: 10, weight: 95 },
          { reps: 10, weight: 95 },
          { reps: 8, weight: 115 },
        ],
      },
    ],
  },
  {
    date: '2026-01-12',
    label: 'Session 4 — MON 12 JAN 2026',
    exercises: [
      {
        name: 'Bench Press',
        sets: [
          { reps: 10, weight: 105 },
          { reps: 10, weight: 105 },
          { reps: 10, weight: 105 },
          { reps: 8, weight: 135 },
        ],
      },
      {
        name: 'Incline Dumbbell Press',
        sets: [
          { reps: 10, weight: 60 },
          { reps: 10, weight: 60 },
          { reps: 10, weight: 60 },
          { reps: 8, weight: 70 },
        ],
      },
    ],
  },
  {
    date: '2026-01-14',
    label: 'Session 5 — WED 14 JAN 2026',
    exercises: [
      {
        name: 'Squat',
        sets: [
          { reps: 10, weight: 145 },
          { reps: 10, weight: 145 },
          { reps: 10, weight: 145 },
          { reps: 8, weight: 175 },
        ],
      },
      {
        name: 'Leg Press',
        sets: [
          { reps: 10, weight: 205 },
          { reps: 10, weight: 205 },
          { reps: 10, weight: 205 },
          { reps: 8, weight: 245 },
        ],
      },
    ],
  },
  {
    date: '2026-01-16',
    label: 'Session 6 — FRI 16 JAN 2026',
    exercises: [
      {
        name: 'Deadlift',
        sets: [
          { reps: 5, weight: 205 },
          { reps: 5, weight: 205 },
          { reps: 5, weight: 205 },
          { reps: 3, weight: 245 },
        ],
      },
      {
        name: 'Pull-Up',
        sets: [
          { reps: 10, weight: 0 },
          { reps: 10, weight: 0 },
          { reps: 10, weight: 0 },
          { reps: 8, weight: 0 },
        ],
      },
    ],
  },
]

let totalLogs = 0

for (const session of sessions) {
  console.log(`\n${session.label}`)
  for (const ex of session.exercises) {
    const setsJson = JSON.stringify(ex.sets.map((s) => ({ reps: s.reps, weight: s.weight })))
    const result = insertLog.run(userId, exerciseIds[ex.name], session.date, setsJson)
    totalLogs++
    const totalSets = ex.sets.length
    const totalReps = ex.sets.reduce((sum, s) => sum + s.reps, 0)
    const maxWeight = Math.max(...ex.sets.map((s) => s.weight))
    const totalVol = ex.sets.reduce((sum, s) => sum + s.reps * s.weight, 0)
    const weightDisplay = ex.sets[0].weight === 0 ? 'bodyweight' : `${maxWeight} lb`
    console.log(
      `  ${ex.name}: ${totalSets} sets, ${totalReps} reps, max ${weightDisplay}, vol ${totalVol} lb`,
    )
  }
}

// ---- Phase 1C: VERIFY ----
console.log('\n=== VERIFICATION ===')

const logCount = db.prepare('SELECT COUNT(*) AS c FROM workout_logs').get()
const exCount = db.prepare('SELECT COUNT(*) AS c FROM exercises').get()
console.log(`Total exercises: ${exCount.c}`)
console.log(`Total workout logs: ${logCount.c}`)

const rows = db.prepare(`
  SELECT wl.date, e.name AS exercise, wl.sets
  FROM workout_logs wl
  JOIN exercises e ON e.id = wl.exercise_id
  WHERE wl.user_id = ?
  ORDER BY wl.date ASC, wl.id ASC
`).all(userId)

console.log('\nDetailed breakdown:')
let currentDate = ''
for (const row of rows) {
  if (row.date !== currentDate) {
    currentDate = row.date
    const d = new Date(row.date + 'T00:00:00')
    const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    console.log(`\n  ${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`)
  }
  const sets = JSON.parse(row.sets)
  const totalSets = sets.length
  const totalReps = sets.reduce((s, ss) => s + ss.reps, 0)
  const maxW = Math.max(...sets.map((s) => s.weight))
  const vol = sets.reduce((s, ss) => s + ss.reps * ss.weight, 0)
  const weightStr = sets[0].weight === 0 ? 'bodyweight' : `${maxW} lb`
  console.log(`    - ${row.exercise}: ${totalSets}x${totalReps}, max ${weightStr}, vol ${vol} lb`)
}

db.close()
console.log('\nDone. Database seeded successfully.')

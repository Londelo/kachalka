// Seed Bruno's routine: Mon/Wed/Fri, barbell curls + pull-ups + squats, 7 months of data
const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'data', 'kachalka.db')

// Delete the entire DB to start fresh
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath)
  console.log('=== DELETED EXISTING DB ===')
}

const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

// Run migrations to create schema
console.log('\n=== RUNNING MIGRATIONS ===')
const migrationsDir = path.join(__dirname, '..', 'src', 'db', 'migrations')
const sqlFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
for (const file of sqlFiles) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
  db.exec(sql)
  console.log(`  Applied ${file}`)
}
console.log('  Schema ready.')

// ---- Phase 0: CREATE BRUNO (user) ----
console.log('\n=== CREATING BRUNO ===')
const insertUser = db.prepare('INSERT INTO users (name, is_active) VALUES (?, ?)')
const insertResult = insertUser.run('Bruno', 1)
const userId = insertResult.lastInsertRowid

// ---- Phase 1: DELETE existing data for Bruno ----
console.log('=== CLEARING BRUNO DATA ===')
db.prepare('DELETE FROM workout_logs WHERE user_id = ?').run(userId)
db.prepare('DELETE FROM user_routines WHERE user_id = ?').run(userId)
db.prepare('DELETE FROM exercises WHERE user_id = ?').run(userId)
db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('users', 'exercises', 'workout_logs', 'user_routines') AND name != 'users'").run()

// ---- Phase 2: CREATE EXERCISES ----
console.log('\n=== CREATING EXERCISES ===')
const insertExercise = db.prepare(
  'INSERT INTO exercises (name, user_id) VALUES (?, ?)',
)
const exerciseNames = ['Barbell Curl', 'Pull-Up', 'Squat']
const exerciseIds = {}
for (const name of exerciseNames) {
  const result = insertExercise.run(name, userId)
  exerciseIds[name] = result.lastInsertRowid
  console.log(`  ${name} -> id=${exerciseIds[name]}`)
}

// ---- Phase 3: GENERATE DATES ----
console.log('\n=== GENERATING SESSIONS ===')

// Last 7 months from today (May 2026), going back to Oct 2025
const today = new Date(2026, 4, 9) // May 9, 2026
const startDate = new Date(2025, 9, 1) // Oct 1, 2025

const sessions = []
let d = new Date(startDate)
while (d <= today) {
  const day = d.getDay() // 1=Mon, 3=Wed, 5=Fri
  if (day === 1 || day === 3 || day === 5) {
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    sessions.push(dateStr)
  }
  d.setDate(d.getDate() + 1)
}

console.log(`  Generated ${sessions.length} sessions from ${sessions[0]} to ${sessions[sessions.length - 1]}`)

// ---- Phase 3.5: CREATE ROUTINES ----
console.log('\n=== CREATING ROUTINES ===')
const insertRoutine = db.prepare(
  'INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)',
)
const workoutDays = [1, 3, 5] // Mon, Wed, Fri
for (const day of workoutDays) {
  for (const name of exerciseNames) {
    insertRoutine.run(userId, exerciseIds[name], day)
  }
}
console.log(`  Created ${workoutDays.length} workout days × ${exerciseNames.length} exercises = ${workoutDays.length * exerciseNames.length} routines`)

// ---- Phase 4: INSERT WORKOUT LOGS ----
console.log('\n=== INSERTING WORKOUT LOGS ===')
const insertLog = db.prepare(
  'INSERT INTO workout_logs (user_id, exercise_id, date, sets) VALUES (?, ?, ?, ?)',
)

// Each session: 3 sets per exercise
// Set 1: 10 reps @ 100 lbs
// Set 2: 10 reps @ 100 lbs
// Set 3: 10 reps @ 125 lbs
const setsData = [
  { reps: 10, weight: 100 },
  { reps: 10, weight: 100 },
  { reps: 10, weight: 125 },
]
const setsJson = JSON.stringify(setsData)

let totalLogs = 0
for (const date of sessions) {
  for (const name of exerciseNames) {
    insertLog.run(userId, exerciseIds[name], date, setsJson)
    totalLogs++
  }
}

console.log(`  Inserted ${totalLogs} workout logs`)

// ---- Phase 5: VERIFY ----
console.log('\n=== VERIFICATION ===')
const rows = db.prepare(`
  SELECT wl.date, e.name AS exercise, wl.sets
  FROM workout_logs wl
  JOIN exercises e ON e.id = wl.exercise_id
  WHERE wl.user_id = ?
  ORDER BY wl.date ASC, e.name ASC
`).all(userId)

let currentDate = ''
let sessionCount = 0
for (const row of rows) {
  if (row.date !== currentDate) {
    currentDate = row.date
    sessionCount++
    const d = new Date(row.date + 'T00:00:00')
    const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    console.log(`\n  Session ${sessionCount} — ${DAYS[d.getDay()]} ${row.date}`)
  }
  const sets = JSON.parse(row.sets)
  const vol = sets.reduce((s, ss) => s + ss.reps * ss.weight, 0)
  console.log(`    - ${row.exercise}: 3 sets, vol ${vol} lb`)
}

console.log(`\n  Total sessions: ${sessionCount}`)
console.log(`  Total logs: ${rows.length}`)

db.close()
console.log('\nDone.')

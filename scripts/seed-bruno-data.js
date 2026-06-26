// Seed Bruno's routine: Mon/Wed/Fri, bench press + squat + deadlift, 3 months of progressive data
// Only runs in development — gate keeps prod/staging from wiping data.
if (process.env.NODE_ENV !== 'development') {
  process.exit(0)
}

const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'kachalka.db')

// Delete the entire DB to start fresh (including WAL/SHM files)
const walPath = dbPath + '-wal'
const shmPath = dbPath + '-shm'
const dbExists = fs.existsSync(dbPath)
const walExists = fs.existsSync(walPath)
const shmExists = fs.existsSync(shmPath)
if (dbExists) {
  fs.unlinkSync(dbPath)
}
if (walExists) {
  fs.unlinkSync(walPath)
}
if (shmExists) {
  fs.unlinkSync(shmPath)
}
if (dbExists || walExists || shmExists) {
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

// ---- Phase 0: CREATE BRUNO (user_id=1) ----
console.log('\n=== CREATING BRUNO ===')
db.prepare('DELETE FROM workout_logs WHERE user_id = ?').run(1)
db.prepare('DELETE FROM user_routines WHERE user_id = ?').run(1)
db.prepare('DELETE FROM exercises WHERE user_id = ?').run(1)
db.prepare('DELETE FROM users WHERE id = ?').run(1)
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'exercises', 'workout_logs', 'user_routines')")

const insertUser = db.prepare('INSERT INTO users (id, name, is_active) VALUES (?, ?, ?)')
insertUser.run(1, 'Bruno', 1)
const userId = 1
console.log(`  Bruno -> id=${userId}`)

// ---- Phase 1: CREATE EXERCISES ----
console.log('\n=== CREATING EXERCISES ===')
const insertExercise = db.prepare(
  'INSERT INTO exercises (name, user_id) VALUES (?, ?)',
)
const exerciseNames = ['Bench Press', 'Squat', 'Deadlift']
const exerciseIds = {}
for (const name of exerciseNames) {
  const result = insertExercise.run(name, userId)
  exerciseIds[name] = result.lastInsertRowid
  console.log(`  ${name} -> id=${exerciseIds[name]}`)
}

// ---- Phase 2: GENERATE DATES ----
console.log('\n=== GENERATING SESSIONS ===')

// Last 3 calendar months from today (2026-06-23):
// Month 1 (oldest): March 2026
// Month 2 (middle): April 2026
// Month 3 (newest): May 2026 through mid-June 2026
const today = new Date(2026, 5, 23) // June 23, 2026
const startDate = new Date(2026, 2, 1) // March 1, 2026

const sessions = []
let d = new Date(startDate)
while (d <= today) {
  const day = d.getDay() // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  if (day === 1 || day === 3 || day === 5) { // Mon=1, Wed=3, Fri=5
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    sessions.push(dateStr)
  }
  d.setDate(d.getDate() + 1)
}

console.log(`  Generated ${sessions.length} sessions from ${sessions[0]} to ${sessions[sessions.length - 1]}`)

// ---- Phase 2.5: CREATE ROUTINES ----
console.log('\n=== CREATING ROUTINES ===')
const insertRoutine = db.prepare(
  'INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)',
)
const workoutDays = [0, 2, 4] // Mon=0, Wed=2, Fri=4 (app internal day numbering)
for (const day of workoutDays) {
  for (const name of exerciseNames) {
    insertRoutine.run(userId, exerciseIds[name], day)
  }
}
console.log(`  Created ${workoutDays.length} workout days × ${exerciseNames.length} exercises = ${workoutDays.length * exerciseNames.length} routines`)

// ---- Phase 3: INSERT WORKOUT LOGS ----
console.log('\n=== INSERTING WORKOUT LOGS ===')
const insertLog = db.prepare(
  'INSERT INTO workout_logs (user_id, exercise_id, date, sets) VALUES (?, ?, ?, ?)',
)

// Determine which month a date string belongs to
function getMonthIndex(dateStr) {
  const year = parseInt(dateStr.substring(0, 4))
  const month = parseInt(dateStr.substring(5, 7))
  // Month 1 = March, Month 2 = April, Month 3 = May+
  if (month === 3) return 1 // March
  if (month === 4) return 2 // April
  return 3 // May, June, ...
}

// Weight per exercise by month tier
const weightsByMonth = {
  1: 10,   // Month 1 (March): 10 lbs
  2: 50,   // Month 2 (April): 50 lbs
  3: 100,  // Month 3 (May-Jun): 100 lbs
}

let totalLogs = 0
for (const date of sessions) {
  const monthIdx = getMonthIndex(date)
  const weight = weightsByMonth[monthIdx]

  // Each exercise gets 3 sets: { id, reps: 10, weight }
  const setsData = [
    { id: 's1', reps: 10, weight },
    { id: 's2', reps: 10, weight },
    { id: 's3', reps: 10, weight },
  ]
  const setsJson = JSON.stringify(setsData)

  for (const name of exerciseNames) {
    insertLog.run(userId, exerciseIds[name], date, setsJson)
    totalLogs++
  }
}

console.log(`  Inserted ${totalLogs} workout logs`)

// ---- Phase 4: VERIFY ----
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
let currentMonth = 0
let monthVolumes = {}
for (const row of rows) {
  if (row.date !== currentDate) {
    if (currentDate) {
      const m = getMonthIndex(currentDate)
      monthVolumes[m] = (monthVolumes[m] || 0) + 1
    }
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

// Tally month volumes
const m = getMonthIndex(currentDate)
monthVolumes[m] = (monthVolumes[m] || 0) + 1

console.log(`\n  Total sessions: ${sessionCount}`)
console.log(`  Total logs: ${rows.length}`)
const monthLabels = { 1: 'Month 1 (March)', 2: 'Month 2 (April)', 3: 'Month 3 (May-Jun)' }
for (const [key, count] of Object.entries(monthVolumes)) {
  console.log(`  ${monthLabels[key]}: ${count} sessions`)
}

db.close()
console.log('\nDone.')

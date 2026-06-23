// Minimal seed for E2E tests — runs migrations + creates Bruno + exercises.
// Tests create their own routine assignments via the UI.

const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'data', 'kachalka.db')
const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

// Run migrations only if tables don't exist
const tablesExist = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'exercises', 'user_routines', 'workout_logs')").all()
if (tablesExist.length === 0) {
  const migrationsDir = path.join(__dirname, '..', 'src', 'db', 'migrations')
  const sqlFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  for (const file of sqlFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
    db.exec(sql)
  }
  console.log('  Migrations applied.')
} else {
  console.log('  Tables already exist, skipping migrations.')
}

// Create Bruno user (id=1) — ignore if already exists
const insertUser = db.prepare('INSERT OR IGNORE INTO users (name, is_active) VALUES (?, ?)')
insertUser.run('Bruno', 1)

// Create exercises (only if Bruno exists)
const user = db.prepare('SELECT id FROM users WHERE name = ?').get('Bruno')
if (user) {
  const insertExercise = db.prepare('INSERT INTO exercises (name, user_id) VALUES (?, ?)')
  const exerciseNames = ['Barbell Curl', 'Pull-Up', 'Squat']
  let created = 0
  for (const name of exerciseNames) {
    const exists = db.prepare('SELECT id FROM exercises WHERE name = ? AND user_id = ?').get(name, user.id)
    if (!exists) {
      insertExercise.run(name, user.id)
      created++
    }
  }
  console.log(`  Created ${created} exercises for Bruno`)
}

db.close()
console.log('Test data seeded.')

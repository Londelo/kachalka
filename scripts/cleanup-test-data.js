// Wipe ALL test data — deletes everything from all tables.
// Called by Playwright tests and codegen to ensure a clean database.

const Database = require('better-sqlite3')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'data', 'kachalka.db')
const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

db.exec('DELETE FROM workout_logs')
db.exec('DELETE FROM user_routines')
db.exec('DELETE FROM exercises')
db.exec('DELETE FROM users')
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('users', 'exercises', 'workout_logs', 'user_routines')")

db.close()
console.log('All test data wiped.')

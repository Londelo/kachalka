// Wipe ALL test data — deletes everything from all tables.
// Called by Playwright tests and codegen to ensure a clean database.
// This runs before the dev server starts, so it builds the schema rather than assuming it.

const path = require('path')

const { ensureSchema, openE2eDatabase, wipeE2eData } = require('../tests/harness/e2e-database.ts')

const CHECKOUT_ROOT = path.join(__dirname, '..')

const db = openE2eDatabase(CHECKOUT_ROOT)
ensureSchema(db, CHECKOUT_ROOT)
wipeE2eData(db)
db.exec(
  "DELETE FROM sqlite_sequence WHERE name IN ('users', 'exercises', 'workout_logs', 'user_routines')",
)

db.close()
console.log('All test data wiped.')

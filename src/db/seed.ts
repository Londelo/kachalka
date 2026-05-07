import { getDatabase } from '@/config/db'

export function seedDatabase(): void {
  const db = getDatabase()

  // Only seed when the database is empty so existing workout data
  // is preserved across dev restarts and server restarts.
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }
  if ((count as number) > 0) {
    return
  }

  // Delete all existing data so the seed is idempotent and produces
  // a deterministic database state regardless of prior runs.
  db.exec('DELETE FROM workout_logs')
  db.exec('DELETE FROM user_routines')
  db.exec('DELETE FROM exercises')
  db.exec('DELETE FROM users')

  const insertUser = db.prepare(
    'INSERT INTO users (name, email) VALUES (?, ?)',
  )
  const insertExercise = db.prepare(
    'INSERT INTO exercises (name, user_id) VALUES (?, ?)',
  )
  const insertRoutine = db.prepare(
    'INSERT INTO user_routines (user_id, exercise_id, day_of_week) VALUES (?, ?, ?)',
  )

  const seedBruno = db.transaction(() => {
    const user = insertUser.run('Bruno', '')
    const userId = user.lastInsertRowid as number

    const exercise = insertExercise.run('Pull Up', userId)
    const exerciseId = exercise.lastInsertRowid as number

    for (let day = 0; day <= 6; day++) {
      insertRoutine.run(userId, exerciseId, day)
    }
  })

  seedBruno()
}

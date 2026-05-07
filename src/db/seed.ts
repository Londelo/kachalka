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
  const insertWorkoutLog = db.prepare(
    'INSERT INTO workout_logs (user_id, exercise_id, date, sets, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  )

  const seedBruno = db.transaction(() => {
    const user = insertUser.run('Bruno', '')
    const userId = user.lastInsertRowid as number

    const exercise = insertExercise.run('Pull Up', userId)
    const exerciseId = exercise.lastInsertRowid as number

    for (let day = 0; day <= 6; day++) {
      insertRoutine.run(userId, exerciseId, day)
    }

    // Workout logs — realistic pull-up history across multiple dates
    const workoutLogs = [
      {
        date: '2025-01-13',
        sets: JSON.stringify([
          { reps: 8, weight: 0 },
          { reps: 7, weight: 0 },
          { reps: 6, weight: 0 },
          { reps: 5, weight: 0 },
        ]),
        created: 1736726400,
        updated: 1736726400,
      },
      {
        date: '2025-01-15',
        sets: JSON.stringify([
          { reps: 5, weight: 135 },
          { reps: 5, weight: 140 },
          { reps: 4, weight: 145 },
          { reps: 3, weight: 155 },
        ]),
        created: 1736899200,
        updated: 1736899200,
      },
      {
        date: '2025-01-15',
        sets: JSON.stringify([
          { reps: 8, weight: 0 },
          { reps: 7, weight: 0 },
          { reps: 6, weight: 0 },
        ]),
        created: 1736906400,
        updated: 1736906400,
      },
      {
        date: '2025-01-18',
        sets: JSON.stringify([
          { reps: 5, weight: 140 },
          { reps: 5, weight: 145 },
          { reps: 5, weight: 150 },
          { reps: 3, weight: 160 },
        ]),
        created: 1737172400,
        updated: 1737172400,
      },
      {
        date: '2025-01-20',
        sets: JSON.stringify([
          { reps: 10, weight: 0 },
          { reps: 9, weight: 0 },
          { reps: 8, weight: 0 },
          { reps: 7, weight: 0 },
          { reps: 6, weight: 0 },
        ]),
        created: 1737361200,
        updated: 1737361200,
      },
      {
        date: '2025-01-22',
        sets: JSON.stringify([
          { reps: 5, weight: 145 },
          { reps: 5, weight: 150 },
          { reps: 4, weight: 155 },
          { reps: 3, weight: 165 },
        ]),
        created: 1737547200,
        updated: 1737547200,
      },
    ]

    for (const log of workoutLogs) {
      insertWorkoutLog.run(userId, exerciseId, log.date, log.sets, log.created, log.updated)
    }
  })

  seedBruno()
}

/**
 * Seed workout log data for Progress page testing.
 *
 * Creates exercises and realistic workout logs spanning 6+ months.
 * Safe to run multiple times — skips if all 6 progress exercises already exist.
 */
export function seedProgressData(): void {
  const db = getDatabase()

  // Skip if the progress exercises are already seeded — preserves existing data.
  const progressExerciseCount = db
    .prepare(
      "SELECT COUNT(*) AS count FROM exercises WHERE name IN ('Bench Press','Squat','Deadlift','Overhead Press','Barbell Row','Barbell Curl')",
    )
    .get() as { count: number }
  if ((progressExerciseCount.count as number) > 0) return

  // Need at least one user to attach logs to.
  const { count: userCount } = db
    .prepare('SELECT COUNT(*) AS count FROM users')
    .get() as { count: number }
  if (userCount === 0) {
    console.warn('seedProgressData: no users found — skipping')
    return
  }

  const insertExercise = db.prepare(
    `INSERT INTO exercises (name, user_id) VALUES (?, ?)`,
  )

  const insertLog = db.prepare(
    `INSERT INTO workout_logs (user_id, exercise_id, date, sets) VALUES (?, ?, ?, ?)`,
  )

  const seedProgress = db.transaction(() => {
    // Grab the first user.
    const { id: userId } = db
      .prepare('SELECT id FROM users LIMIT 1')
      .get() as { id: number }

    // Exercises to seed. "Barbell Curl" gets only 1-2 logs for the
    // "no data yet" edge case.
    const exercises = [
      { name: 'Bench Press' },
      { name: 'Squat' },
      { name: 'Deadlift' },
      { name: 'Overhead Press' },
      { name: 'Barbell Row' },
      { name: 'Barbell Curl' },
    ]

    const exerciseIds: Record<string, number> = {}

    for (const ex of exercises) {
      const result = insertExercise.run(ex.name, userId)
      exerciseIds[ex.name] = result.lastInsertRowid as number
    }

    // Workout log entries: date, exercise, sets (weight, reps)
    // Spans 2025-07-01 → 2026-01-01 (6+ months).
    const logs: {
      date: string
      exercise: string
      sets: [number, number][]
    }[] = [
      // July 2025
      {
        date: '2025-07-05',
        exercise: 'Bench Press',
        sets: [
          [95, 10],
          [135, 8],
          [155, 6],
          [165, 5],
        ],
      },
      {
        date: '2025-07-05',
        exercise: 'Squat',
        sets: [
          [115, 10],
          [165, 8],
          [185, 6],
          [205, 5],
          [225, 3],
        ],
      },
      {
        date: '2025-07-05',
        exercise: 'Barbell Row',
        sets: [[95, 10], [115, 8], [135, 6]],
      },
      {
        date: '2025-07-12',
        exercise: 'Deadlift',
        sets: [[135, 8], [185, 5], [225, 3]],
      },
      {
        date: '2025-07-12',
        exercise: 'Overhead Press',
        sets: [[65, 10], [85, 8], [95, 6]],
      },
      // August 2025
      {
        date: '2025-08-02',
        exercise: 'Bench Press',
        sets: [
          [95, 10],
          [145, 8],
          [165, 6],
          [175, 5],
          [185, 3],
        ],
      },
      {
        date: '2025-08-02',
        exercise: 'Squat',
        sets: [
          [135, 10],
          [175, 8],
          [195, 6],
          [215, 5],
        ],
      },
      {
        date: '2025-08-09',
        exercise: 'Deadlift',
        sets: [[155, 8], [205, 5], [245, 3]],
      },
      {
        date: '2025-08-09',
        exercise: 'Overhead Press',
        sets: [[75, 8], [95, 6], [105, 5]],
      },
      // September 2025
      {
        date: '2025-09-06',
        exercise: 'Bench Press',
        sets: [
          [95, 10],
          [155, 8],
          [175, 6],
          [185, 5],
          [195, 3],
        ],
      },
      {
        date: '2025-09-06',
        exercise: 'Barbell Row',
        sets: [[105, 10], [135, 8], [155, 6], [165, 5]],
      },
      {
        date: '2025-09-13',
        exercise: 'Squat',
        sets: [
          [145, 10],
          [185, 8],
          [205, 6],
          [225, 5],
          [245, 3],
        ],
      },
      // October 2025
      {
        date: '2025-10-04',
        exercise: 'Bench Press',
        sets: [
          [95, 10],
          [165, 8],
          [185, 6],
          [195, 5],
        ],
      },
      {
        date: '2025-10-04',
        exercise: 'Deadlift',
        sets: [[165, 8], [225, 5], [265, 3]],
      },
      {
        date: '2025-10-11',
        exercise: 'Overhead Press',
        sets: [[75, 8], [105, 6], [115, 5]],
      },
      {
        date: '2025-10-11',
        exercise: 'Barbell Row',
        sets: [[115, 10], [145, 8], [165, 6]],
      },
      // November 2025
      {
        date: '2025-11-01',
        exercise: 'Squat',
        sets: [
          [155, 10],
          [195, 8],
          [215, 6],
          [235, 5],
          [255, 3],
        ],
      },
      {
        date: '2025-11-01',
        exercise: 'Bench Press',
        sets: [
          [95, 10],
          [175, 8],
          [195, 6],
          [205, 5],
          [215, 3],
        ],
      },
      {
        date: '2025-11-08',
        exercise: 'Deadlift',
        sets: [[185, 8], [245, 5], [275, 3]],
      },
      // December 2025
      {
        date: '2025-12-06',
        exercise: 'Bench Press',
        sets: [
          [95, 10],
          [185, 8],
          [205, 6],
          [215, 5],
        ],
      },
      {
        date: '2025-12-06',
        exercise: 'Squat',
        sets: [
          [165, 10],
          [205, 8],
          [225, 6],
          [245, 5],
        ],
      },
      {
        date: '2025-12-13',
        exercise: 'Overhead Press',
        sets: [[85, 8], [115, 6], [125, 5]],
      },
      // January 2026 — only Barbell Curl gets 2 logs (edge case)
      {
        date: '2026-01-03',
        exercise: 'Barbell Curl',
        sets: [[35, 10], [45, 8]],
      },
      {
        date: '2026-01-10',
        exercise: 'Barbell Curl',
        sets: [[45, 10], [55, 8], [60, 6]],
      },
    ]

    for (const log of logs) {
      const setsJson = JSON.stringify(
        log.sets.map(([weight, reps]) => ({ weight, reps })),
      )
      insertLog.run(userId, exerciseIds[log.exercise], log.date, setsJson)
    }
  })

  seedProgress()
}

// Run seeds when the module is loaded.
// Bruno first (creates the user), then progress data (creates exercises + logs).
seedDatabase()
seedProgressData()

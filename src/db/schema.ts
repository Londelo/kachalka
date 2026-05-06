import {
  sqliteTable,
  integer,
  text,
  unique,
} from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  email: text('email').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
})

export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
})

export const userRoutines = sqliteTable(
  'user_routines',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').references(() => users.id).notNull(),
    exerciseId: integer('exercise_id').references(() => exercises.id).notNull(),
    dayOfWeek: integer('day_of_week').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  },
  (t) => [
    unique('user_routine_unique').on(t.userId, t.exerciseId, t.dayOfWeek),
  ],
)

export const workoutLogs = sqliteTable('workout_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id).notNull(),
  exerciseId: integer('exercise_id').references(() => exercises.id).notNull(),
  date: text('date').notNull(),
  sets: text('sets', { mode: 'json' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(new Date()),
})

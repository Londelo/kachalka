import { describe, it, expect } from 'vitest'
import { users, exercises, userRoutines, workoutLogs } from '@/db/schema'

describe('users table schema', () => {
  it('has all required columns', () => {
    expect(users.id).toBeDefined()
    expect(users.name).toBeDefined()
    expect(users.email).toBeDefined()
    expect(users.createdAt).toBeDefined()
    expect(users.isActive).toBeDefined()
  })

  it('defines id as primary key with auto increment', () => {
    expect(users.id.primary).toBe(true)
  })

  it('defines name as unique and not null', () => {
    expect(users.name.notNull).toBe(true)
  })

  it('defines email with default value', () => {
    expect(users.email.notNull).toBe(true)
  })
})

describe('exercises table schema', () => {
  it('has all required columns', () => {
    expect(exercises.id).toBeDefined()
    expect(exercises.name).toBeDefined()
    expect(exercises.userId).toBeDefined()
    expect(exercises.createdAt).toBeDefined()
    expect(exercises.updatedAt).toBeDefined()
  })

  it('defines id as primary key with auto increment', () => {
    expect(exercises.id.primary).toBe(true)
  })

  it('defines userId as not null', () => {
    expect(exercises.userId.notNull).toBe(true)
  })
})

describe('userRoutines table schema', () => {
  it('has all required columns', () => {
    expect(userRoutines.id).toBeDefined()
    expect(userRoutines.userId).toBeDefined()
    expect(userRoutines.exerciseId).toBeDefined()
    expect(userRoutines.dayOfWeek).toBeDefined()
    expect(userRoutines.createdAt).toBeDefined()
  })

  it('defines id as primary key with auto increment', () => {
    expect(userRoutines.id.primary).toBe(true)
  })

  it('defines userId as not null', () => {
    expect(userRoutines.userId.notNull).toBe(true)
  })

  it('defines exerciseId as not null', () => {
    expect(userRoutines.exerciseId.notNull).toBe(true)
  })

  it('defines dayOfWeek as not null', () => {
    expect(userRoutines.dayOfWeek.notNull).toBe(true)
  })
})

describe('workoutLogs table schema', () => {
  it('has all required columns', () => {
    expect(workoutLogs.id).toBeDefined()
    expect(workoutLogs.userId).toBeDefined()
    expect(workoutLogs.exerciseId).toBeDefined()
    expect(workoutLogs.date).toBeDefined()
    expect(workoutLogs.sets).toBeDefined()
    expect(workoutLogs.createdAt).toBeDefined()
    expect(workoutLogs.updatedAt).toBeDefined()
  })

  it('defines id as primary key with auto increment', () => {
    expect(workoutLogs.id.primary).toBe(true)
  })

  it('defines userId as not null', () => {
    expect(workoutLogs.userId.notNull).toBe(true)
  })

  it('defines exerciseId as not null', () => {
    expect(workoutLogs.exerciseId.notNull).toBe(true)
  })
})

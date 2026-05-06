import { describe, it, expect } from 'vitest'
import { users, exercises, userRoutines, workoutLogs } from '@/db/schema'

describe('users table schema', () => {
  it('has id column', () => {
    expect(users.id).toBeDefined()
  })

  it('has name column', () => {
    expect(users.name).toBeDefined()
  })

  it('has email column', () => {
    expect(users.email).toBeDefined()
  })

  it('has createdAt column', () => {
    expect(users.createdAt).toBeDefined()
  })

  it('has isActive column', () => {
    expect(users.isActive).toBeDefined()
  })
})

describe('exercises table schema', () => {
  it('has id column', () => {
    expect(exercises.id).toBeDefined()
  })

  it('has name column', () => {
    expect(exercises.name).toBeDefined()
  })

  it('has userId column', () => {
    expect(exercises.userId).toBeDefined()
  })
})

describe('userRoutines table schema', () => {
  it('has id column', () => {
    expect(userRoutines.id).toBeDefined()
  })

  it('has userId column', () => {
    expect(userRoutines.userId).toBeDefined()
  })

  it('has exerciseId column', () => {
    expect(userRoutines.exerciseId).toBeDefined()
  })

  it('has dayOfWeek column', () => {
    expect(userRoutines.dayOfWeek).toBeDefined()
  })
})

describe('workoutLogs table schema', () => {
  it('has id column', () => {
    expect(workoutLogs.id).toBeDefined()
  })

  it('has userId column', () => {
    expect(workoutLogs.userId).toBeDefined()
  })

  it('has exerciseId column', () => {
    expect(workoutLogs.exerciseId).toBeDefined()
  })

  it('has date column', () => {
    expect(workoutLogs.date).toBeDefined()
  })

  it('has sets column', () => {
    expect(workoutLogs.sets).toBeDefined()
  })
})

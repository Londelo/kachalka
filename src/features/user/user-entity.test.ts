import { describe, it, expect } from 'vitest'
import { createUser } from './user-entity'

describe('createUser', () => {
  it('creates user with valid name', () => {
    const user = createUser('Alice')

    expect(user.name).toBe('Alice')
    expect(user.id).toEqual({ value: 0 })
  })

  it('trims whitespace from name', () => {
    const user = createUser('  Bob  ')
    expect(user.name).toBe('Bob')
  })

  it('throws when name is empty', () => {
    expect(() => createUser('')).toThrow('Name cannot be empty')
  })

  it('throws when name is whitespace only', () => {
    expect(() => createUser('   ')).toThrow('Name cannot be empty')
  })

  it('throws when name exceeds 100 characters', () => {
    const longName = 'a'.repeat(101)
    expect(() => createUser(longName)).toThrow('Name too long')
  })
})

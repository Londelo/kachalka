import { describe, it, expect } from 'vitest'
import { UserId, createUser } from './user-entity'

describe('UserId', () => {
  describe('make', () => {
    it('creates a UserId from a positive integer', () => {
      const id = UserId.make(1)
      expect(id).toEqual({ value: 1 })
    })

    it('creates a UserId from zero', () => {
      const id = UserId.make(0)
      expect(id).toEqual({ value: 0 })
    })

    it('creates a UserId from a large integer', () => {
      const id = UserId.make(999999)
      expect(id).toEqual({ value: 999999 })
    })

    it('rejects negative numbers', () => {
      expect(() => UserId.make(-1)).toThrow()
    })

    it('rejects negative numbers beyond -1', () => {
      expect(() => UserId.make(-100)).toThrow()
    })

    it('rejects floats', () => {
      expect(() => UserId.make(1.5)).toThrow()
    })

    it('rejects strings', () => {
      expect(() => UserId.make('1' as unknown as number)).toThrow()
    })

    it('rejects null', () => {
      expect(() => UserId.make(null as unknown as number)).toThrow()
    })

    it('rejects undefined', () => {
      expect(() => UserId.make(undefined as unknown as number)).toThrow()
    })

    it('rejects NaN', () => {
      expect(() => UserId.make(NaN)).toThrow()
    })

    it('rejects Infinity', () => {
      expect(() => UserId.make(Infinity)).toThrow()
    })
  })
})

describe('createUser', () => {
  it('creates a user with a valid name', () => {
    const user = createUser('Alice')
    expect(user).toEqual({ id: { value: 0 }, name: 'Alice' })
  })

  it('trims leading whitespace from name', () => {
    const user = createUser('  Alice')
    expect(user.name).toBe('Alice')
  })

  it('trims trailing whitespace from name', () => {
    const user = createUser('Alice  ')
    expect(user.name).toBe('Alice')
  })

  it('trims both leading and trailing whitespace', () => {
    const user = createUser('  Alice  ')
    expect(user.name).toBe('Alice')
  })

  it('rejects empty string', () => {
    expect(() => createUser('')).toThrow('Name cannot be empty')
  })

  it('rejects whitespace-only string', () => {
    expect(() => createUser('   ')).toThrow('Name cannot be empty')
  })

  it('rejects names longer than 100 characters', () => {
    const longName = 'a'.repeat(101)
    expect(() => createUser(longName)).toThrow('Name too long')
  })

  it('accepts a name of exactly 100 characters', () => {
    const name100 = 'a'.repeat(100)
    const user = createUser(name100)
    expect(user.name).toBe(name100)
  })

  it('returns a placeholder id with value 0', () => {
    const user = createUser('Bob')
    expect(user.id.value).toBe(0)
  })
})

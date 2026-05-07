import { describe, it, expect } from 'vitest'
import { UserId, createUser } from '@/features/user/user-entity'

describe('UserId', () => {
  it('creates a value object from a positive integer', () => {
    const result = UserId.make(42)
    expect(result).toEqual({ value: 42 })
  })

  it('creates a value object from a large integer', () => {
    const result = UserId.make(999999)
    expect(result).toEqual({ value: 999999 })
  })

  it('accepts zero', () => {
    const result = UserId.make(0)
    expect(result).toEqual({ value: 0 })
  })

  it('throws for negative numbers', () => {
    expect(() => UserId.make(-1)).toThrow('UserId must be a non-negative integer')
  })

  it('throws for non-integers', () => {
    expect(() => UserId.make(1.5)).toThrow('UserId must be a non-negative integer')
  })

  it('throws for strings', () => {
    expect(() => UserId.make('1' as unknown as number)).toThrow('UserId must be a non-negative integer')
  })

  it('throws for null', () => {
    expect(() => UserId.make(null as unknown as number)).toThrow('UserId must be a non-negative integer')
  })

  it('throws for undefined', () => {
    expect(() => UserId.make(undefined as unknown as number)).toThrow('UserId must be a non-negative integer')
  })

  it('throws for NaN', () => {
    expect(() => UserId.make(NaN)).toThrow('UserId must be a non-negative integer')
  })

  it('throws for Infinity', () => {
    expect(() => UserId.make(Infinity)).toThrow('UserId must be a non-negative integer')
  })
})

describe('createUser', () => {
  it('returns a user with trimmed name and placeholder id', () => {
    const result = createUser('  Alice  ')
    expect(result).toEqual({ id: { value: 0 }, name: 'Alice' })
  })

  it('trims leading whitespace', () => {
    const result = createUser('  Bob')
    expect(result.name).toBe('Bob')
  })

  it('trims trailing whitespace', () => {
    const result = createUser('Bob  ')
    expect(result.name).toBe('Bob')
  })

  it('throws for empty string', () => {
    expect(() => createUser('')).toThrow('Name cannot be empty')
  })

  it('throws for whitespace-only string', () => {
    expect(() => createUser('   ')).toThrow('Name cannot be empty')
  })

  it('throws for 101-character name', () => {
    const longName = 'a'.repeat(101)
    expect(() => createUser(longName)).toThrow('Name too long')
  })

  it('accepts exactly 100-character name', () => {
    const name100 = 'a'.repeat(100)
    const result = createUser(name100)
    expect(result.name).toHaveLength(100)
  })

  it('returns a placeholder id with value 0', () => {
    const user = createUser('Bob')
    expect(user.id.value).toBe(0)
  })
})

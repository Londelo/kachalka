import { describe, it, expect } from 'vitest'
import { UserId, createUser, validateEmail } from '@/features/user/user-entity'

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

describe('validateEmail', () => {
  it('returns trimmed email', () => {
    const result = validateEmail('  alice@example.com  ')
    expect(result).toBe('alice@example.com')
  })

  it('returns email unchanged when no whitespace', () => {
    const result = validateEmail('alice@example.com')
    expect(result).toBe('alice@example.com')
  })

  it('throws for empty string', () => {
    expect(() => validateEmail('')).toThrow('Email cannot be empty')
  })

  it('throws for whitespace-only string', () => {
    expect(() => validateEmail('   ')).toThrow('Email cannot be empty')
  })

  it('throws for non-string type (number)', () => {
    expect(() => validateEmail(123 as unknown as string)).toThrow('Email must be a string')
  })

  it('throws for non-string type (null)', () => {
    expect(() => validateEmail(null as unknown as string)).toThrow('Email must be a string')
  })

  it('throws for non-string type (undefined)', () => {
    expect(() => validateEmail(undefined as unknown as string)).toThrow('Email must be a string')
  })

  it('throws for non-string type (object)', () => {
    expect(() => validateEmail({} as unknown as string)).toThrow('Email must be a string')
  })

  it('throws for 255-character email', () => {
    const longEmail = 'a'.repeat(255)
    expect(() => validateEmail(longEmail)).toThrow('Email too long')
  })

  it('accepts exactly 254-character email', () => {
    const email254 = 'a'.repeat(254)
    const result = validateEmail(email254)
    expect(result).toHaveLength(254)
  })
})

describe('createUser', () => {
  it('returns a user with trimmed name and email', () => {
    const result = createUser('  Alice  ', '  alice@example.com  ')
    expect(result).toEqual({ id: { value: 0 }, name: 'Alice', email: 'alice@example.com' })
  })

  it('trims leading whitespace from name', () => {
    const result = createUser('  Bob', 'bob@example.com')
    expect(result.name).toBe('Bob')
  })

  it('trims trailing whitespace from name', () => {
    const result = createUser('Bob  ', 'bob@example.com')
    expect(result.name).toBe('Bob')
  })

  it('trims leading whitespace from email', () => {
    const result = createUser('Bob', '  bob@example.com')
    expect(result.email).toBe('bob@example.com')
  })

  it('trims trailing whitespace from email', () => {
    const result = createUser('Bob', 'bob@example.com  ')
    expect(result.email).toBe('bob@example.com')
  })

  it('throws for empty name', () => {
    expect(() => createUser('', 'alice@example.com')).toThrow('Name cannot be empty')
  })

  it('throws for whitespace-only name', () => {
    expect(() => createUser('   ', 'alice@example.com')).toThrow('Name cannot be empty')
  })

  it('throws for 101-character name', () => {
    const longName = 'a'.repeat(101)
    expect(() => createUser(longName, 'test@example.com')).toThrow('Name too long')
  })

  it('accepts exactly 100-character name', () => {
    const name100 = 'a'.repeat(100)
    const result = createUser(name100, 'test@example.com')
    expect(result.name).toHaveLength(100)
  })

  it('throws for empty email', () => {
    expect(() => createUser('Alice', '')).toThrow('Email cannot be empty')
  })

  it('throws for whitespace-only email', () => {
    expect(() => createUser('Alice', '   ')).toThrow('Email cannot be empty')
  })

  it('throws for 255-character email', () => {
    const longEmail = 'a'.repeat(255)
    expect(() => createUser('Alice', longEmail)).toThrow('Email too long')
  })

  it('accepts exactly 254-character email', () => {
    const email254 = 'a'.repeat(254)
    const result = createUser('Alice', email254)
    expect(result.email).toHaveLength(254)
  })

  it('returns a placeholder id with value 0', () => {
    const user = createUser('Bob', 'bob@example.com')
    expect(user.id.value).toBe(0)
  })

  it('includes email in return value', () => {
    const user = createUser('Alice', 'alice@example.com')
    expect(user.email).toBe('alice@example.com')
  })
})

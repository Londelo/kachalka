import { describe, it, expect } from 'vitest'
import { createUser, validateEmail } from './user-entity'

describe('validateEmail', () => {
  it('returns trimmed email for valid input', () => {
    expect(validateEmail('  test@example.com  ')).toBe('test@example.com')
  })

  it('returns unmodified email for already-trimmed input', () => {
    expect(validateEmail('user@domain.org')).toBe('user@domain.org')
  })

  it('throws when email is not a string', () => {
    expect(() => validateEmail(123 as unknown as string)).toThrow('Email must be a string')
    expect(() => validateEmail(null as unknown as string)).toThrow('Email must be a string')
    expect(() => validateEmail(undefined as unknown as string)).toThrow('Email must be a string')
  })

  it('throws when email is empty', () => {
    expect(() => validateEmail('')).toThrow('Email cannot be empty')
  })

  it('throws when email is whitespace only', () => {
    expect(() => validateEmail('   ')).toThrow('Email cannot be empty')
  })

  it('throws when email exceeds 254 characters', () => {
    const longEmail = 'a'.repeat(254) + '@x.com'
    expect(() => validateEmail(longEmail)).toThrow('Email too long')
  })

  it('allows 254 character email', () => {
    const email = 'a'.repeat(250) + '@x.c'
    expect(email.length).toBe(254)
    expect(() => validateEmail(email)).not.toThrow()
  })
})

describe('createUser', () => {
  it('creates user with valid name and email', () => {
    const user = createUser('Alice', 'alice@example.com')

    expect(user.name).toBe('Alice')
    expect(user.email).toBe('alice@example.com')
    expect(user.id).toEqual({ value: 0 })
  })

  it('trims whitespace from name', () => {
    const user = createUser('  Bob  ', 'bob@test.com')
    expect(user.name).toBe('Bob')
  })

  it('trims whitespace from email', () => {
    const user = createUser('Charlie', '  charlie@test.com  ')
    expect(user.email).toBe('charlie@test.com')
  })

  it('throws when name is empty', () => {
    expect(() => createUser('', 'a@b.com')).toThrow('Name cannot be empty')
  })

  it('throws when name is whitespace only', () => {
    expect(() => createUser('   ', 'a@b.com')).toThrow('Name cannot be empty')
  })

  it('throws when name exceeds 100 characters', () => {
    const longName = 'a'.repeat(101)
    expect(() => createUser(longName, 'a@b.com')).toThrow('Name too long')
  })

  it('throws when email is empty', () => {
    expect(() => createUser('Alice', '')).toThrow('Email cannot be empty')
  })

  it('throws when email is whitespace only', () => {
    expect(() => createUser('Alice', '   ')).toThrow('Email cannot be empty')
  })

  it('throws when email is not a string', () => {
    expect(() => createUser('Alice', 42 as unknown as string)).toThrow('Email must be a string')
  })

  it('throws when email exceeds 254 characters', () => {
    const longEmail = 'a'.repeat(254) + '@x.com'
    expect(() => createUser('Alice', longEmail)).toThrow('Email too long')
  })
})

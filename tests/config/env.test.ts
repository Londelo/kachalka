import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { validateEnv } from '@/config/env'

describe('validateEnv', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clear all env vars before each test
    for (const key of Object.keys(process.env)) {
      delete process.env[key]
    }
  })

  afterEach(() => {
    // Restore original env
    Object.keys(process.env).forEach((key) => delete process.env[key])
    Object.assign(process.env, originalEnv)
  })

  describe('success case', () => {
    it('returns validated config when all required vars are present', () => {
      process.env.NODE_ENV = 'development'
      process.env.DATABASE_PATH = './data/lifting.db'

      const result = validateEnv()

      expect(result.nodeEnv).toBe('development')
      expect(result.databasePath).toBe('./data/lifting.db')
    })

    it('works with NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production'
      process.env.DATABASE_PATH = './data/lifting.db'

      const result = validateEnv()

      expect(result.nodeEnv).toBe('production')
    })

    it('works with DATABASE_PATH set to absolute path', () => {
      process.env.NODE_ENV = 'development'
      process.env.DATABASE_PATH = '/absolute/path/to/db.sqlite'

      const result = validateEnv()

      expect(result.databasePath).toBe('/absolute/path/to/db.sqlite')
    })
  })

  describe('missing DATABASE_PATH', () => {
    it('throws when DATABASE_PATH is not set', () => {
      process.env.NODE_ENV = 'development'

      expect(() => validateEnv()).toThrow('DATABASE_PATH')
    })

    it('throws when DATABASE_PATH is empty string', () => {
      process.env.NODE_ENV = 'development'
      process.env.DATABASE_PATH = ''

      expect(() => validateEnv()).toThrow('DATABASE_PATH')
    })
  })

  describe('missing NODE_ENV', () => {
    it('throws when NODE_ENV is not set', () => {
      process.env.DATABASE_PATH = './data/lifting.db'

      expect(() => validateEnv()).toThrow('NODE_ENV')
    })

    it('throws when NODE_ENV is empty string', () => {
      process.env.NODE_ENV = ''
      process.env.DATABASE_PATH = './data/lifting.db'

      expect(() => validateEnv()).toThrow('NODE_ENV')
    })
  })

  describe('invalid NODE_ENV values', () => {
    it('throws for invalid NODE_ENV value', () => {
      process.env.NODE_ENV = 'staging'
      process.env.DATABASE_PATH = './data/lifting.db'

      expect(() => validateEnv()).toThrow(/NODE_ENV/)
    })

    it('accepts NODE_ENV=development', () => {
      process.env.NODE_ENV = 'development'
      process.env.DATABASE_PATH = './data/lifting.db'

      expect(() => validateEnv()).not.toThrow()
    })

    it('accepts NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production'
      process.env.DATABASE_PATH = './data/lifting.db'

      expect(() => validateEnv()).not.toThrow()
    })

    it('accepts NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test'
      process.env.DATABASE_PATH = './data/lifting.db'

      expect(() => validateEnv()).not.toThrow()
    })
  })
})

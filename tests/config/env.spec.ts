import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { validateEnv } from '@/config/env'

describe('validateEnv', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key]
    }
  })

  afterEach(() => {
    Object.assign(process.env, originalEnv)
  })

  describe('returns validated config', () => {
    it('when all required vars are present', () => {
      process.env.NODE_ENV = 'development'
      process.env.DATABASE_PATH = './data/lifting.db'

      const result = validateEnv()

      expect(result.nodeEnv).toBe('development')
      expect(result.databasePath).toBe('./data/lifting.db')
    })

    it('with NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production'
      process.env.DATABASE_PATH = './data/lifting.db'

      const result = validateEnv()

      expect(result.nodeEnv).toBe('production')
    })

    it('with absolute DATABASE_PATH', () => {
      process.env.NODE_ENV = 'development'
      process.env.DATABASE_PATH = '/absolute/path/to/db.sqlite'

      const result = validateEnv()

      expect(result.databasePath).toBe('/absolute/path/to/db.sqlite')
    })

    it('accepts NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test'
      process.env.DATABASE_PATH = './data/lifting.db'

      const result = validateEnv()

      expect(result.nodeEnv).toBe('test')
    })
  })

  describe('throws for missing DATABASE_PATH', () => {
    it('when not set', () => {
      process.env.NODE_ENV = 'development'

      expect(() => validateEnv()).toThrow('DATABASE_PATH')
    })

    it('when empty string', () => {
      process.env.NODE_ENV = 'development'
      process.env.DATABASE_PATH = ''

      expect(() => validateEnv()).toThrow('DATABASE_PATH')
    })
  })

  describe('throws for missing NODE_ENV', () => {
    it('when not set', () => {
      process.env.DATABASE_PATH = './data/lifting.db'

      expect(() => validateEnv()).toThrow('NODE_ENV')
    })

    it('when empty string', () => {
      process.env.NODE_ENV = ''
      process.env.DATABASE_PATH = './data/lifting.db'

      expect(() => validateEnv()).toThrow('NODE_ENV')
    })
  })

  describe('throws for invalid NODE_ENV', () => {
    it('for unsupported values like staging', () => {
      process.env.NODE_ENV = 'staging'
      process.env.DATABASE_PATH = './data/lifting.db'

      expect(() => validateEnv()).toThrow(/NODE_ENV/)
    })
  })
})

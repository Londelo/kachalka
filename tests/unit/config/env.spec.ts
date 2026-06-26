import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { validateEnv } from '@/config/env'

function setEnv(key: string, value: string | undefined): void {
  Object.defineProperty(process.env, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  })
}

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
      setEnv('NODE_ENV', 'development')
      setEnv('DATABASE_PATH', './data/lifting.db')

      const result = validateEnv()

      expect(result.nodeEnv).toBe('development')
      expect(result.databasePath).toBe('./data/lifting.db')
    })

    it('with NODE_ENV=production', () => {
      setEnv('NODE_ENV', 'production')
      setEnv('DATABASE_PATH', './data/lifting.db')

      const result = validateEnv()

      expect(result.nodeEnv).toBe('production')
    })

    it('with absolute DATABASE_PATH', () => {
      setEnv('NODE_ENV', 'development')
      setEnv('DATABASE_PATH', '/absolute/path/to/db.sqlite')

      const result = validateEnv()

      expect(result.databasePath).toBe('/absolute/path/to/db.sqlite')
    })

    it('accepts NODE_ENV=test', () => {
      setEnv('NODE_ENV', 'test')
      setEnv('DATABASE_PATH', './data/lifting.db')

      const result = validateEnv()

      expect(result.nodeEnv).toBe('test')
    })
  })

  describe('defaults DATABASE_PATH', () => {
    it('when not set', () => {
      setEnv('NODE_ENV', 'development')

      const result = validateEnv()

      expect(result.databasePath).toContain('data/kachalka.db')
    })

    it('when empty string', () => {
      setEnv('NODE_ENV', 'development')
      setEnv('DATABASE_PATH', '')

      const result = validateEnv()

      expect(result.databasePath).toContain('data/kachalka.db')
    })
  })

  describe('throws for missing NODE_ENV', () => {
    it('when not set', () => {
      setEnv('DATABASE_PATH', './data/lifting.db')

      expect(() => validateEnv()).toThrow('NODE_ENV')
    })

    it('when empty string', () => {
      setEnv('NODE_ENV', '')
      setEnv('DATABASE_PATH', './data/lifting.db')

      expect(() => validateEnv()).toThrow('NODE_ENV')
    })
  })

  describe('throws for invalid NODE_ENV', () => {
    it('for unsupported values like staging', () => {
      setEnv('NODE_ENV', 'staging')
      setEnv('DATABASE_PATH', './data/lifting.db')

      expect(() => validateEnv()).toThrow(/NODE_ENV/)
    })
  })
})

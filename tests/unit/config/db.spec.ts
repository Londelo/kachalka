import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDatabase, resetDatabase } from '@/config/db'
import fs from 'fs'
import path from 'path'

function setEnv(key: string, value: string | undefined): void {
  Object.defineProperty(process.env, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  })
}

describe('getDatabase', () => {
  let dbPath: string
  let dataDir: string

  beforeEach(() => {
    resetDatabase()
    dbPath = path.join(process.cwd(), 'data', 'kachalka.db')
    dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
  })

  afterEach(() => {
    const actualPath = process.env.DATABASE_PATH ?? dbPath
    const cleanupFiles = [
      actualPath,
      actualPath + '-wal',
      actualPath + '-shm',
    ]
    for (const file of cleanupFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
      }
    }
    resetDatabase()
  })

  describe('singleton behavior', () => {
    it('returns the same database instance on consecutive calls', () => {
      const first = getDatabase()
      const second = getDatabase()

      expect(first).toBe(second)
    })
  })

  describe('database initialization', () => {
    it('enables WAL mode', () => {
      const db = getDatabase()
      const pragma = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }
      expect(pragma.journal_mode).toBe('wal')
    })

    it('enables foreign keys', () => {
      const db = getDatabase()
      const pragma = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }
      expect(pragma.foreign_keys).toBe(1)
    })

    it('can execute queries', () => {
      const db = getDatabase()
      const result = db.prepare('SELECT 1 AS one').get() as { one: number }
      expect(result.one).toBe(1)
    })
  })

  describe('respects DATABASE_PATH env var', () => {
    it('uses ~/.kachalka/prod.db when set', () => {
      setEnv('DATABASE_PATH', '/tmp/.kachalka/prod.db')
      resetDatabase()

      const db = getDatabase()
      const info = db.prepare('PRAGMA database_list').all() as { file: string | null }[]
      expect(info[0].file).toContain('.kachalka/prod.db')
    })

    it('uses ./data/custom.db when set', () => {
      setEnv('DATABASE_PATH', './data/custom.db')
      resetDatabase()

      const db = getDatabase()
      const info = db.prepare('PRAGMA database_list').all() as { file: string | null }[]
      expect(info[0].file).toContain('custom.db')
    })

    it('uses absolute path when set', () => {
      setEnv('DATABASE_PATH', '/tmp/test-db.sqlite')
      resetDatabase()

      const db = getDatabase()
      const info = db.prepare('PRAGMA database_list').all() as { file: string | null }[]
      expect(info[0].file).toContain('test-db.sqlite')
    })

    it('throws when DATABASE_PATH is not set', () => {
      delete process.env.DATABASE_PATH
      resetDatabase()

      expect(() => getDatabase()).toThrow('DATABASE_PATH is required')
    })
  })
})

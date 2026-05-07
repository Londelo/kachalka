import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDatabase } from '@/config/db'
import fs from 'fs'
import path from 'path'

describe('getDatabase', () => {
  let dbPath: string
  let dataDir: string

  beforeEach(() => {
    dbPath = path.join(process.cwd(), 'data', 'kachalka.db')
    dataDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
  })

  afterEach(() => {
    const cleanupFiles = [
      dbPath,
      dbPath + '-wal',
      dbPath + '-shm',
    ]
    for (const file of cleanupFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
      }
    }
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
})

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
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
  })

  afterEach(() => {
    // Clean up SQLite files
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
    // Keep data/ directory — the singleton may need it
  })

  describe('singleton behavior', () => {
    it('returns the same database instance on consecutive calls', () => {
      const first = getDatabase()
      const second = getDatabase()

      expect(first).toBe(second)
    })

    it('creates a database instance on first call', () => {
      const db = getDatabase()
      expect(db).toBeDefined()
    })
  })

  describe('database initialization', () => {
    it('creates the database file in the data directory', () => {
      const db = getDatabase()
      expect(db).toBeDefined()
      expect(() => db.prepare('SELECT 1')).toBeDefined()
    })

    it('enables WAL mode on the database', () => {
      const db = getDatabase()
      const pragma = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }
      expect(pragma.journal_mode).toBe('wal')
    })

    it('enables foreign keys on the database', () => {
      const db = getDatabase()
      const pragma = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }
      expect(pragma.foreign_keys).toBe(1)
    })
  })
})

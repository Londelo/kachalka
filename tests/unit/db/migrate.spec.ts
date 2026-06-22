import { describe, it, expect } from 'vitest'
import * as migrateModule from '@/db/migrate'

describe('runMigrations', () => {
  it('is exported as a function', () => {
    expect(typeof migrateModule.runMigrations).toBe('function')
  })
})

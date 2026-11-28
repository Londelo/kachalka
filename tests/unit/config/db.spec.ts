import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import { getDatabase, resetDatabase } from '@/config/db'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  DEVELOPER_DATABASE_FILENAME,
  TEST_DATABASE_FILENAME,
} from '../../harness/test-database-path'

const CHECKOUT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
)

const DATA_DIRECTORY = path.join(CHECKOUT_ROOT, 'data')
const TEMP_DIRECTORY = path.resolve(os.tmpdir())
const SPEC_DIRECTORY_NAME = 'kachalka-db-spec'
const SPEC_DATA_DIRECTORY = path.join(DATA_DIRECTORY, SPEC_DIRECTORY_NAME)
const SPEC_TEMP_DIRECTORY = path.join(TEMP_DIRECTORY, SPEC_DIRECTORY_NAME)
const SPEC_OWNED_DIRECTORIES = [SPEC_DATA_DIRECTORY, SPEC_TEMP_DIRECTORY]

const DEVELOPER_DATABASE_PATH = path.join(DATA_DIRECTORY, DEVELOPER_DATABASE_FILENAME)
const DEFAULT_TEST_DATABASE_PATH = path.join(DATA_DIRECTORY, TEST_DATABASE_FILENAME)
const WAL_SUFFIX = '-wal'
const SHM_SUFFIX = '-shm'
const DEVELOPER_ARTIFACT_BASENAMES = [
  DEVELOPER_DATABASE_FILENAME,
  `${DEVELOPER_DATABASE_FILENAME}${WAL_SUFFIX}`,
  `${DEVELOPER_DATABASE_FILENAME}${SHM_SUFFIX}`,
]

const ORIGINAL_DATABASE_PATH = process.env.DATABASE_PATH

const CASE_DATABASE_FILES: string[] = []
let developerBefore: FileSnapshot
let developerWalBefore: FileSnapshot
let developerShmBefore: FileSnapshot

interface FileSnapshot {
  exists: boolean
  size: number
  mtimeMs: number
}

function setEnv(key: string, value: string | undefined): void {
  Object.defineProperty(process.env, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  })
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function canonicalPath(candidate: string): string {
  const absolute = path.resolve(candidate)

  try {
    return fs.realpathSync(absolute)
  } catch {
    /* the file may not exist yet; fall through to its parent */
  }

  try {
    return path.join(fs.realpathSync(path.dirname(absolute)), path.basename(absolute))
  } catch {
    return absolute
  }
}

function liesWithin(candidate: string, directory: string): boolean {
  const relative = path.relative(directory, candidate)

  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )
}

function allowedRoots(): string[] {
  return [canonicalPath(DATA_DIRECTORY), canonicalPath(TEMP_DIRECTORY)]
}

function allowedRootsDescription(): string {
  return allowedRoots()
    .map((root) => `"${root}"`)
    .join(' or the temporary directory ')
}

function refusalReason(target: string): string | undefined {
  const canonical = canonicalPath(target)

  if (DEVELOPER_ARTIFACT_BASENAMES.includes(path.basename(canonical))) {
    return `"${target}" is named after the developer database "${DEVELOPER_DATABASE_FILENAME}", ` +
      `the file the developer's own dev server reads and writes`
  }

  if (allowedRoots().some((root) => liesWithin(canonical, root))) {
    return undefined
  }

  return `"${target}" resolves to "${canonical}", which lies inside neither the checkout data ` +
    `directory nor the temporary directory (${allowedRootsDescription()})`
}

function deletionTargets(target: string): string[] {
  return [target, `${target}${WAL_SUFFIX}`, `${target}${SHM_SUFFIX}`]
}

function removeProvenDatabaseArtifacts(target: string): void {
  const refusal = refusalReason(target)

  if (refusal) {
    throw new Error(
      `Refusing to delete ${refusal}. A unit teardown may only remove a file it can prove is a ` +
        `test artefact, so the unlink was skipped.`,
    )
  }

  for (const file of deletionTargets(target)) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file)
    }
  }
}

function currentCleanupTarget(): string {
  return process.env.DATABASE_PATH ?? ORIGINAL_DATABASE_PATH ?? DEFAULT_TEST_DATABASE_PATH
}

function runTeardown(target: string): void {
  try {
    resetDatabase()
    removeProvenDatabaseArtifacts(target)
  } finally {
    setEnv('DATABASE_PATH', ORIGINAL_DATABASE_PATH)
  }
}

function ensureDirectory(directory: string): void {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
  }
}

function snapshotOf(file: string): FileSnapshot {
  try {
    const stats = fs.statSync(file)
    return { exists: true, size: stats.size, mtimeMs: stats.mtimeMs }
  } catch {
    return { exists: false, size: 0, mtimeMs: 0 }
  }
}

function describeSnapshot(snapshot: FileSnapshot): string {
  return snapshot.exists
    ? `exists, ${snapshot.size} bytes, mtime ${snapshot.mtimeMs}`
    : 'does not exist'
}

function writeSpecFile(file: string): void {
  ensureDirectory(path.dirname(file))
  fs.writeFileSync(file, 'kachalka unit teardown fixture')
}

function removeSpecOwnedDirectory(candidate: string): void {
  if (!SPEC_OWNED_DIRECTORIES.includes(candidate)) {
    throw new Error(
      `Refusing to remove "${candidate}": it is not one of this spec's own directories ` +
        `(${SPEC_OWNED_DIRECTORIES.join(', ')}).`,
    )
  }

  const canonical = canonicalPath(candidate)

  if (!allowedRoots().some((root) => liesWithin(canonical, root))) {
    throw new Error(
      `Refusing to remove "${candidate}": it resolves to "${canonical}", inside neither the ` +
        `checkout data directory nor the temporary directory (${allowedRootsDescription()}).`,
    )
  }

  fs.rmSync(canonical, { recursive: true, force: true })
}

describe('getDatabase', () => {
  beforeAll(() => {
    for (const directory of SPEC_OWNED_DIRECTORIES) {
      removeSpecOwnedDirectory(directory)
    }

    developerBefore = snapshotOf(DEVELOPER_DATABASE_PATH)
    developerWalBefore = snapshotOf(`${DEVELOPER_DATABASE_PATH}${WAL_SUFFIX}`)
    developerShmBefore = snapshotOf(`${DEVELOPER_DATABASE_PATH}${SHM_SUFFIX}`)
  })

  beforeEach(() => {
    resetDatabase()
    ensureDirectory(DATA_DIRECTORY)
    ensureDirectory(SPEC_DATA_DIRECTORY)
    ensureDirectory(SPEC_TEMP_DIRECTORY)
  })

  afterEach(() => {
    runTeardown(currentCleanupTarget())
  })

  afterAll(() => {
    const problems: string[] = []

    const compare = (file: string, before: FileSnapshot): void => {
      const after = snapshotOf(file)

      if (after.exists !== before.exists) {
        problems.push(
          `"${file}" ${before.exists ? 'existed' : 'did not exist'} before this file ran ` +
            `(${describeSnapshot(before)}) and ${after.exists ? 'exists' : 'does not exist'} ` +
            `after it (${describeSnapshot(after)}).`,
        )
        return
      }

      if (!after.exists) {
        return
      }

      if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
        problems.push(
          `"${file}" was modified by this file: before — ${describeSnapshot(before)}, ` +
            `after — ${describeSnapshot(after)}.`,
        )
      }
    }

    compare(DEVELOPER_DATABASE_PATH, developerBefore)
    compare(`${DEVELOPER_DATABASE_PATH}${WAL_SUFFIX}`, developerWalBefore)
    compare(`${DEVELOPER_DATABASE_PATH}${SHM_SUFFIX}`, developerShmBefore)

    for (const file of CASE_DATABASE_FILES) {
      const left = deletionTargets(file).filter((candidate) => fs.existsSync(candidate))

      if (left.length > 0) {
        problems.push(`this file left its own database artefacts behind: ${left.join(', ')}.`)
      }
    }

    for (const directory of SPEC_OWNED_DIRECTORIES) {
      removeSpecOwnedDirectory(directory)
    }

    if (problems.length > 0) {
      expect.fail(problems.join('\n'))
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

  describe('respects DATABASE_PATH env var', () => {
    const NESTED_PATH = path.join(SPEC_DATA_DIRECTORY, 'nested', 'deep', 'nested-case.db')
    const RELATIVE_PATH = './data/kachalka-db-spec/relative-case.db'
    const ABSOLUTE_PATH = path.join(SPEC_TEMP_DIRECTORY, 'absolute-case.sqlite')

    it('uses a nested path under the checkout data directory when set', () => {
      setEnv('DATABASE_PATH', NESTED_PATH)
      resetDatabase()

      const db = getDatabase()
      const info = db.prepare('PRAGMA database_list').all() as { file: string | null }[]

      CASE_DATABASE_FILES.push(NESTED_PATH)
      expect(path.basename(info[0].file ?? '')).toBe('nested-case.db')
      expect(info[0].file).toContain(path.join('nested', 'deep', 'nested-case.db'))
      expect(fs.existsSync(NESTED_PATH)).toBe(true)
    })

    it('uses a relative path when set', () => {
      setEnv('DATABASE_PATH', RELATIVE_PATH)
      resetDatabase()

      const db = getDatabase()
      const info = db.prepare('PRAGMA database_list').all() as { file: string | null }[]

      CASE_DATABASE_FILES.push(path.resolve(CHECKOUT_ROOT, RELATIVE_PATH))
      expect(path.basename(info[0].file ?? '')).toBe('relative-case.db')
      expect(fs.existsSync(path.resolve(process.cwd(), RELATIVE_PATH))).toBe(true)
    })

    it('uses an absolute path in the temporary directory when set', () => {
      setEnv('DATABASE_PATH', ABSOLUTE_PATH)
      resetDatabase()

      const db = getDatabase()
      const info = db.prepare('PRAGMA database_list').all() as { file: string | null }[]

      CASE_DATABASE_FILES.push(ABSOLUTE_PATH)
      expect(path.basename(info[0].file ?? '')).toBe('absolute-case.sqlite')
      expect(info[0].file).toBe(ABSOLUTE_PATH)
      expect(fs.existsSync(ABSOLUTE_PATH)).toBe(true)
    })

    it('throws when DATABASE_PATH is not set', () => {
      delete process.env.DATABASE_PATH
      resetDatabase()

      expect(() => getDatabase()).toThrow('DATABASE_PATH is required')
    })

    it('restores DATABASE_PATH after the case that deleted it', () => {
      expect(process.env.DATABASE_PATH).toBe(ORIGINAL_DATABASE_PATH)
    })

    it('resolves a relative DATABASE_PATH against the checkout root', () => {
      expect(process.cwd()).toBe(CHECKOUT_ROOT)
    })
  })

  describe('teardown deletion guard', () => {
    const DEVELOPER_WAL_PATH = `${DEVELOPER_DATABASE_PATH}${WAL_SUFFIX}`
    const DEVELOPER_SHM_PATH = `${DEVELOPER_DATABASE_PATH}${SHM_SUFFIX}`
    const CHECKOUT_FILE_OUTSIDE_DATA = path.join(CHECKOUT_ROOT, 'package.json')
    const OUTSIDE_THE_CHECKOUT = path.join(path.parse(TEMP_DIRECTORY).root, 'etc', 'kachalka-db-spec-stray.db')
    const DEVELOPER_NAMED_IN_TEMP = path.join(SPEC_TEMP_DIRECTORY, DEVELOPER_DATABASE_FILENAME)
    const DEVELOPER_NAMED_WAL_IN_TEMP = path.join(
      SPEC_TEMP_DIRECTORY,
      `${DEVELOPER_DATABASE_FILENAME}${WAL_SUFFIX}`,
    )

    it.each([
      {
        label: 'the developer database inside the checkout data directory',
        target: DEVELOPER_DATABASE_PATH,
        fixture: false,
      },
      {
        label: 'the developer database -wal sibling',
        target: DEVELOPER_WAL_PATH,
        fixture: false,
      },
      {
        label: 'the developer database -shm sibling',
        target: DEVELOPER_SHM_PATH,
        fixture: false,
      },
      {
        label: 'the developer database filename anywhere else',
        target: DEVELOPER_NAMED_IN_TEMP,
        fixture: true,
      },
      {
        label: 'a -wal sibling of any file named like the developer database',
        target: DEVELOPER_NAMED_WAL_IN_TEMP,
        fixture: true,
      },
      {
        label: 'a real file inside the checkout but outside data/',
        target: CHECKOUT_FILE_OUTSIDE_DATA,
        fixture: false,
      },
      {
        label: 'a path outside the checkout entirely',
        target: OUTSIDE_THE_CHECKOUT,
        fixture: false,
      },
    ])('refuses to delete $label and names the path', ({ target, fixture }) => {
      if (fixture) {
        writeSpecFile(target)
      }

      expect(() => runTeardown(target)).toThrow(new RegExp(escapeForRegExp(target)))

      if (fixture || target === CHECKOUT_FILE_OUTSIDE_DATA) {
        expect(fs.existsSync(target), `refused target still exists: ${target}`).toBe(true)
      }
    })

    it('refuses a symlink that resolves outside both allowed roots', () => {
      const link = path.join(SPEC_TEMP_DIRECTORY, 'escaping-symlink.db')
      const outside = CHECKOUT_FILE_OUTSIDE_DATA

      fs.symlinkSync(outside, link)

      try {
        expect(() => runTeardown(link)).toThrow(/neither the checkout data directory nor/)
        expect(fs.existsSync(outside)).toBe(true)
      } finally {
        fs.rmSync(link, { force: true })
      }
    })

    it('deletes a proven test database in data/ together with its -wal and -shm siblings', () => {
      const target = path.join(SPEC_DATA_DIRECTORY, 'proven-in-data.db')
      for (const file of deletionTargets(target)) {
        writeSpecFile(file)
        expect(fs.existsSync(file)).toBe(true)
      }

      runTeardown(target)

      for (const file of deletionTargets(target)) {
        expect(fs.existsSync(file), `removed: ${file}`).toBe(false)
      }
    })

    it('deletes a proven test database in the temporary directory with its siblings', () => {
      const target = path.join(SPEC_TEMP_DIRECTORY, 'proven-in-temp.sqlite')
      for (const file of deletionTargets(target)) {
        writeSpecFile(file)
      }

      runTeardown(target)

      for (const file of deletionTargets(target)) {
        expect(fs.existsSync(file), `removed: ${file}`).toBe(false)
      }
    })

    it('removes nothing and does not throw when the target never existed', () => {
      const target = path.join(SPEC_TEMP_DIRECTORY, 'never-created.db')

      expect(() => runTeardown(target)).not.toThrow()
      expect(fs.existsSync(target)).toBe(false)
    })

    it('closes the open handle before unlinking so the files really go', () => {
      const target = path.join(SPEC_DATA_DIRECTORY, 'closed-first.db')
      setEnv('DATABASE_PATH', target)
      resetDatabase()
      getDatabase().prepare('CREATE TABLE closed_first_probe (id INTEGER PRIMARY KEY)').run()

      runTeardown(target)

      expect(fs.existsSync(target)).toBe(false)
      expect(fs.existsSync(`${target}${WAL_SUFFIX}`)).toBe(false)
      expect(fs.existsSync(`${target}${SHM_SUFFIX}`)).toBe(false)
    })

    it('restores DATABASE_PATH even when the teardown refuses its target', () => {
      setEnv('DATABASE_PATH', DEVELOPER_DATABASE_PATH)

      expect(() => runTeardown(DEVELOPER_DATABASE_PATH)).toThrow(/Refusing to delete/)
      expect(process.env.DATABASE_PATH).toBe(ORIGINAL_DATABASE_PATH)
    })

    it('refuses every developer database artefact name in any directory', () => {
      const neverAllowed = [
        DEVELOPER_DATABASE_PATH,
        DEVELOPER_WAL_PATH,
        DEVELOPER_SHM_PATH,
        path.join(SPEC_TEMP_DIRECTORY, DEVELOPER_DATABASE_FILENAME),
        path.join(SPEC_DATA_DIRECTORY, `${DEVELOPER_DATABASE_FILENAME}${SHM_SUFFIX}`),
      ]

      for (const target of neverAllowed) {
        expect(refusalReason(target), target).toBeDefined()
      }
    })

    it('accepts this spec\'s own test database and the suite test database', () => {
      expect(
        refusalReason(path.join(SPEC_DATA_DIRECTORY, 'proven-in-data.db')),
      ).toBeUndefined()
      expect(refusalReason(path.join(SPEC_TEMP_DIRECTORY, 'proven-in-temp.sqlite'))).toBeUndefined()
      expect(refusalReason(DEFAULT_TEST_DATABASE_PATH)).toBeUndefined()
    })
  })
})

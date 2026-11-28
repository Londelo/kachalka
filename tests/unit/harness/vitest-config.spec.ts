// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import config from '../../../vitest.config'
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

const BARE_JEST_DOM_SPECIFIER = '@testing-library/jest-dom/vitest'
const JEST_DOM_PACKAGE_SCOPE = '@testing-library'
const JEST_DOM_PACKAGE_NAME = 'jest-dom'
const NODE_MODULES_DIRECTORY = 'node_modules'
const DATA_DIRECTORY = 'data'
const UNIT_SPEC_PATTERN = 'tests/unit/**/*.spec.ts'
const UNIT_TEST_PATTERN = 'tests/unit/**/*.test.ts'
const UNIT_DIRECTORY = 'tests/unit'
const UNIT_FILE_SUFFIXES = ['.spec.ts', '.test.ts']
const E2E_PATTERN = 'tests/e2e/**'
const E2E_DIRECTORY = 'tests/e2e'
const HARNESS_DIRECTORY = path.join(CHECKOUT_ROOT, 'tests', 'unit', 'harness')

const ORIGINAL_DATABASE_PATH = process.env.DATABASE_PATH

const setupFiles = config.test?.setupFiles
const setupFileEntries = Array.isArray(setupFiles) ? setupFiles : []

const fsAllow = config.server?.fs?.allow
const fsAllowEntries = Array.isArray(fsAllow) ? fsAllow : []

const aliasEntries = config.resolve?.alias as Record<string, string> | undefined

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
    return
  }

  Object.defineProperty(process.env, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  })
}

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile()
  } catch {
    return false
  }
}

function isDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory()
  } catch {
    return false
  }
}

function nearestDirectoryWithNodeModules(startingDirectory: string): string | undefined {
  let current = path.resolve(startingDirectory)

  while (current !== path.parse(current).root) {
    if (isDirectory(path.join(current, NODE_MODULES_DIRECTORY))) {
      return current
    }
    const parent = path.dirname(current)
    if (parent === current) {
      return undefined
    }
    current = parent
  }

  return undefined
}

function nodeModulesOwnerOf(file: string): string | undefined {
  const segments = file.split(path.sep)
  const index = segments.lastIndexOf(NODE_MODULES_DIRECTORY)

  return index > 0 ? segments.slice(0, index).join(path.sep) : undefined
}

function toFiles(matches: string[]): string[] {
  const files = new Set<string>()

  for (const match of matches) {
    const absolute = path.resolve(CHECKOUT_ROOT, match)
    if (isFile(absolute)) {
      files.add(absolute)
    }
  }

  return [...files].sort()
}

function filesMatching(patterns: string[]): string[] {
  const matches: string[] = []

  for (const pattern of patterns) {
    matches.push(...fs.globSync(pattern, { cwd: CHECKOUT_ROOT }))
  }

  return toFiles(matches)
}

function unitTestFilesOnDisk(): string[] {
  return toFiles(fs.globSync(`${UNIT_DIRECTORY}/**`, { cwd: CHECKOUT_ROOT })).filter((file) =>
    UNIT_FILE_SUFFIXES.some((suffix) => file.endsWith(suffix)),
  )
}

function liesInsidePackage(entry: string, scope: string, name: string): boolean {
  const segments = entry.split(path.sep)
  return segments.includes(scope) && segments.includes(name)
}

async function loadConfigFresh(): Promise<void> {
  vi.resetModules()
  await import('../../../vitest.config')
}

afterEach(() => {
  setEnv('DATABASE_PATH', ORIGINAL_DATABASE_PATH)
  vi.resetModules()
})

describe('vitest.config.ts', () => {
  describe('test.setupFiles', () => {
    it('is an array with at least one entry', () => {
      expect(Array.isArray(setupFiles)).toBe(true)
      expect(setupFileEntries.length).toBeGreaterThanOrEqual(1)
    })

    it('lists only absolute paths', () => {
      for (const entry of setupFileEntries) {
        expect(path.isAbsolute(entry), entry).toBe(true)
      }
    })

    it('lists only files that exist on disk', () => {
      for (const entry of setupFileEntries) {
        expect(fs.existsSync(entry), entry).toBe(true)
      }
    })

    it('never lists the bare jest-dom specifier', () => {
      expect(setupFileEntries).not.toContain(BARE_JEST_DOM_SPECIFIER)
    })

    it('lists at least one entry inside the @testing-library/jest-dom package', () => {
      const insidePackage = setupFileEntries.filter((entry) =>
        liesInsidePackage(entry, JEST_DOM_PACKAGE_SCOPE, JEST_DOM_PACKAGE_NAME),
      )

      expect(insidePackage.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('server.fs.allow', () => {
    it('is an array with at least one entry', () => {
      expect(Array.isArray(fsAllow)).toBe(true)
      expect(fsAllowEntries.length).toBeGreaterThanOrEqual(1)
    })

    it('contains the checkout root', () => {
      expect(fsAllowEntries).toContain(CHECKOUT_ROOT)
    })

    it('contains the nearest ancestor holding a node_modules directory', () => {
      const inheritedRoot = nearestDirectoryWithNodeModules(CHECKOUT_ROOT)

      if (!inheritedRoot) {
        throw new Error('expected an ancestor node_modules directory to exist')
      }

      expect(fsAllowEntries).toContain(inheritedRoot)
    })

    it('allows Vite to serve the directory that owns each setup file', () => {
      expect(setupFileEntries.length).toBeGreaterThan(0)

      for (const entry of setupFileEntries) {
        const owner = nodeModulesOwnerOf(entry)

        if (!owner) {
          throw new Error(`"${entry}" does not live inside a node_modules directory`)
        }

        expect(fsAllowEntries, owner).toContain(owner)
      }
    })

    it('contains no entry equal to the filesystem root', () => {
      expect(fsAllowEntries).not.toContain('/')
    })

    it('has no duplicate entries', () => {
      expect(new Set(fsAllowEntries).size).toBe(fsAllowEntries.length)
    })
  })

  describe('process.env.DATABASE_PATH after the config loads', () => {
    it('is set and never empty', () => {
      expect(process.env.DATABASE_PATH).toBeDefined()
      expect(process.env.DATABASE_PATH).not.toBe('')
    })

    it('is absolute', () => {
      expect(path.isAbsolute(process.env.DATABASE_PATH ?? '')).toBe(true)
    })

    it('names the test database and not the developer database', () => {
      const basename = path.basename(process.env.DATABASE_PATH ?? '')

      expect(basename).toBe(TEST_DATABASE_FILENAME)
      expect(basename).not.toBe(DEVELOPER_DATABASE_FILENAME)
    })

    it('lives in the checkout data directory', () => {
      expect(path.dirname(process.env.DATABASE_PATH ?? '')).toBe(
        path.join(CHECKOUT_ROOT, DATA_DIRECTORY),
      )
    })

    it('is not the developer database path', () => {
      expect(process.env.DATABASE_PATH).not.toBe(
        path.join(CHECKOUT_ROOT, DATA_DIRECTORY, DEVELOPER_DATABASE_FILENAME),
      )
    })

    it.each([
      {
        label: 'an absolute path inside the checkout',
        exported: path.join(CHECKOUT_ROOT, 'data', 'operator-exported.db'),
        expected: path.join(CHECKOUT_ROOT, 'data', 'operator-exported.db'),
      },
      {
        label: 'a relative path inside the checkout',
        exported: './data/operator-exported.db',
        expected: path.join(CHECKOUT_ROOT, 'data', 'operator-exported.db'),
      },
      {
        label: 'a path inside the temporary directory',
        exported: path.join(os.tmpdir(), 'operator-exported.db'),
        expected: path.join(os.tmpdir(), 'operator-exported.db'),
      },
    ])('lets the operator export survive: $label', async ({ exported, expected }) => {
      setEnv('DATABASE_PATH', exported)

      await loadConfigFresh()

      expect(process.env.DATABASE_PATH).toBe(expected)
    })

    it('throws instead of accepting the developer database path', async () => {
      const developerPath = path.join(CHECKOUT_ROOT, DATA_DIRECTORY, DEVELOPER_DATABASE_FILENAME)
      setEnv('DATABASE_PATH', developerPath)

      await expect(loadConfigFresh()).rejects.toThrow(/developer database/)
    })
  })

  describe('test.include and test.exclude', () => {
    it('still collects both unit spec patterns', () => {
      expect(config.test?.include ?? []).toEqual(
        expect.arrayContaining([UNIT_SPEC_PATTERN, UNIT_TEST_PATTERN]),
      )
    })

    it('still excludes the end-to-end directory', () => {
      expect(config.test?.exclude ?? []).toContain(E2E_PATTERN)
    })

    it('actually matches files on disk', () => {
      const collected = filesMatching(config.test?.include ?? [])
      const onDisk = unitTestFilesOnDisk()

      console.info(
        `[vitest-config] test.include matched ${collected.length} of ${onDisk.length} files on disk`,
      )

      expect(collected).toEqual(onDisk)
    })

    it('collects none of the end-to-end specs', () => {
      const collected = filesMatching(config.test?.include ?? [])
      const e2eDirectory = path.join(CHECKOUT_ROOT, E2E_DIRECTORY)

      expect(collected.filter((file) => file.startsWith(e2eDirectory + path.sep))).toEqual([])
    })

    it('excludes a pattern that really matches the end-to-end specs', () => {
      const excluded = new Set(filesMatching(config.test?.exclude ?? []))
      const e2eSpecs = filesMatching([E2E_PATTERN]).filter((file) => file.endsWith('.spec.ts'))

      expect(e2eSpecs.length).toBeGreaterThan(0)

      for (const spec of e2eSpecs) {
        expect(excluded.has(spec), spec).toBe(true)
      }
    })

    it('collects every harness spec', () => {
      const harnessSpecs = fs
        .readdirSync(HARNESS_DIRECTORY)
        .filter((entry) => entry.endsWith('.spec.ts'))
        .map((entry) => path.join(HARNESS_DIRECTORY, entry))
      const collected = new Set(filesMatching(config.test?.include ?? []))

      expect(harnessSpecs.length).toBeGreaterThan(0)

      for (const spec of harnessSpecs) {
        expect(collected.has(spec), spec).toBe(true)
      }
    })
  })

  describe('unchanged surface', () => {
    it('enables globals', () => {
      expect(config.test?.globals).toBe(true)
    })

    it('uses the jsdom environment', () => {
      expect(config.test?.environment).toBe('jsdom')
    })

    it('aliases @ to the checkout src directory', () => {
      expect(aliasEntries?.['@']).toBe(path.resolve(CHECKOUT_ROOT, 'src'))
    })

    it('still registers plugins', () => {
      expect(Array.isArray(config.plugins)).toBe(true)
      expect(config.plugins?.length).toBeGreaterThanOrEqual(1)
    })
  })
})

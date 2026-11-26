import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { resolveSetupFiles, resolveServerFsAllow } from '../../harness/vitest-resolve'

const BARE_SPECIFIER = '@testing-library/jest-dom/vitest'
const PACKAGE_SCOPE = '@testing-library'
const PACKAGE_NAME = 'jest-dom'
const NODE_MODULES_DIRECTORY = 'node_modules'
const RESOLUTION_ANCHOR = 'harness-anchor.js'
const PROBE_NAME = '__vitest-resolve-probe__'

const CHECKOUT_ROOT = process.cwd()

function isDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory()
  } catch {
    return false
  }
}

function isGitRepositoryRoot(candidate: string): boolean {
  try {
    return fs.statSync(path.join(candidate, '.git')).isDirectory()
  } catch {
    return false
  }
}

function nearestGitRepositoryRoot(startingDirectory: string): string | undefined {
  let current = path.resolve(startingDirectory)

  while (current !== path.parse(current).root) {
    if (isGitRepositoryRoot(current)) {
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

function isStrictAncestor(ancestor: string, target: string): boolean {
  const relative = path.relative(ancestor, target)

  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function packageDirectoryOf(entry: string): string | undefined {
  const segments = entry.split(path.sep)
  const scopeIndex = segments.lastIndexOf(PACKAGE_SCOPE)

  if (scopeIndex === -1 || segments[scopeIndex + 1] !== PACKAGE_NAME) {
    return undefined
  }

  return segments.slice(0, scopeIndex + 2).join(path.sep) || path.sep
}

function listingOf(directory: string): string[] {
  try {
    return fs.readdirSync(directory).sort()
  } catch {
    return []
  }
}

// The real repository root: the checkout whose `.git` is a directory, so a worker's
// worktree — where `.git` is a file, and where Vite may have written a node_modules
// cache — never passes for it. Equals the running checkout when Vitest runs from the
// main checkout; names the main checkout when it runs from a worker's worktree.
const REPO = nearestGitRepositoryRoot(CHECKOUT_ROOT) ?? CHECKOUT_ROOT

const REPO_NODE_MODULES_ROOT = nearestDirectoryWithNodeModules(REPO)

const WORKTREES_DIRECTORY = path.join(REPO, '.claude', 'worktrees')
const PROBE_DIR = path.join(WORKTREES_DIRECTORY, PROBE_NAME)

const ROOT_VARIANTS: Array<{ label: string; root: string }> = [
  { label: 'the bare root', root: REPO },
  { label: 'a single trailing separator', root: `${REPO}/` },
  { label: 'a doubled trailing separator', root: `${REPO}//` },
  { label: 'a trailing dot segment', root: `${REPO}/.` },
  { label: 'a detour through a child and back', root: `${REPO}/data/..` },
]

let worktreesExistedBefore = false
let worktreesListingBefore: string[] = []

beforeAll(() => {
  worktreesExistedBefore = isDirectory(WORKTREES_DIRECTORY)
  worktreesListingBefore = listingOf(WORKTREES_DIRECTORY)
  fs.mkdirSync(PROBE_DIR, { recursive: true })
})

afterAll(() => {
  fs.rmSync(PROBE_DIR, { recursive: true, force: true })
  if (!worktreesExistedBefore) {
    fs.rmSync(WORKTREES_DIRECTORY, { recursive: true, force: true })
  }
  expect(fs.existsSync(PROBE_DIR)).toBe(false)
  expect(listingOf(WORKTREES_DIRECTORY)).toEqual(worktreesListingBefore)
})

describe('resolveSetupFiles', () => {
  describe('the checkout it runs in', () => {
    it('runs inside a repository that owns its dependencies', () => {
      expect(isGitRepositoryRoot(REPO)).toBe(true)
      expect(REPO_NODE_MODULES_ROOT).toBe(REPO)
    })

    it('returns at least one entry', () => {
      expect(resolveSetupFiles(REPO).length).toBeGreaterThanOrEqual(1)
    })

    it('returns every entry as an absolute path', () => {
      for (const entry of resolveSetupFiles(REPO)) {
        expect(path.isAbsolute(entry)).toBe(true)
      }
    })

    it('returns every entry as a file that exists on disk', () => {
      for (const entry of resolveSetupFiles(REPO)) {
        expect(fs.existsSync(entry)).toBe(true)
        expect(fs.statSync(entry).isFile()).toBe(true)
      }
    })

    it('never returns the bare specifier', () => {
      const entries = resolveSetupFiles(REPO)

      expect(entries).not.toContain(BARE_SPECIFIER)
      for (const entry of entries) {
        expect(entry).not.toContain(BARE_SPECIFIER)
      }
    })

    it('returns every entry inside an on-disk @testing-library/jest-dom package directory', () => {
      for (const entry of resolveSetupFiles(REPO)) {
        const packageDirectory = packageDirectoryOf(entry)

        expect(packageDirectory).toBeDefined()
        expect(isDirectory(packageDirectory as string)).toBe(true)
      }
    })

    it('resolves inside the inherited node_modules root', () => {
      for (const entry of resolveSetupFiles(REPO)) {
        expect(entry.startsWith(path.join(REPO, NODE_MODULES_DIRECTORY) + path.sep)).toBe(true)
      }
    })

    it.each(ROOT_VARIANTS)('answers $label identically to the bare root', ({ root }) => {
      expect(resolveSetupFiles(root)).toEqual(resolveSetupFiles(REPO))
    })

    it('answers the same root twice identically', () => {
      expect(resolveSetupFiles(REPO)).toEqual(resolveSetupFiles(REPO))
    })

    it('hands back a fresh array on every call', () => {
      expect(resolveSetupFiles(REPO)).not.toBe(resolveSetupFiles(REPO))
    })
  })

  describe('a root from which the specifier cannot be resolved', () => {
    let orphanRoot = ''

    beforeAll(() => {
      orphanRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kachalka-orphan-')), 'checkout')
    })

    afterAll(() => {
      fs.rmSync(path.dirname(orphanRoot), { recursive: true, force: true })
    })

    it('has no inherited dependencies to find', () => {
      expect(nearestDirectoryWithNodeModules(orphanRoot)).toBeUndefined()
    })

    it('throws naming the specifier that failed', () => {
      expect(() => resolveSetupFiles(orphanRoot)).toThrow(BARE_SPECIFIER)
    })

    it('throws naming the root it tried to resolve from', () => {
      expect(() => resolveSetupFiles(orphanRoot)).toThrow(orphanRoot)
    })
  })
})

describe('resolveServerFsAllow', () => {
  describe('a checkout holding its own node_modules', () => {
    it('includes the resolved root', () => {
      expect(resolveServerFsAllow(REPO)).toContain(path.resolve(REPO))
    })

    it('includes the nearest ancestor holding a node_modules directory', () => {
      expect(resolveServerFsAllow(REPO)).toContain(REPO_NODE_MODULES_ROOT)
    })

    it('answers with that root alone, with no parent and no duplicate', () => {
      expect(resolveServerFsAllow(REPO)).toEqual([REPO])
    })

    it('includes no entry equal to the filesystem root', () => {
      const entries = resolveServerFsAllow(REPO)

      expect(entries).not.toContain(path.parse(REPO).root)
      expect(entries).not.toContain('/')
    })

    it('includes no entry broader than the nearest node_modules root', () => {
      for (const entry of resolveServerFsAllow(REPO)) {
        expect(isStrictAncestor(entry, REPO)).toBe(false)
      }
    })

    it('includes no duplicate entries', () => {
      const entries = resolveServerFsAllow(REPO)

      expect(entries).toEqual([...new Set(entries)])
    })

    it('returns only absolute paths to existing directories', () => {
      for (const entry of resolveServerFsAllow(REPO)) {
        expect(path.isAbsolute(entry)).toBe(true)
        expect(isDirectory(entry)).toBe(true)
      }
    })

    it.each(ROOT_VARIANTS)('answers $label identically to the bare root', ({ root }) => {
      expect(resolveServerFsAllow(root)).toEqual(resolveServerFsAllow(REPO))
    })

    it('answers the same root twice identically', () => {
      expect(resolveServerFsAllow(REPO)).toEqual(resolveServerFsAllow(REPO))
    })
  })

  describe('a root with no node_modules anywhere above it', () => {
    let detachedRoot = ''

    beforeAll(() => {
      detachedRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kachalka-detached-')), 'worktree')
      fs.mkdirSync(detachedRoot, { recursive: true })
    })

    afterAll(() => {
      fs.rmSync(path.dirname(detachedRoot), { recursive: true, force: true })
    })

    it('has nothing to inherit', () => {
      expect(nearestDirectoryWithNodeModules(detachedRoot)).toBeUndefined()
    })

    it('answers with the root alone', () => {
      expect(resolveServerFsAllow(detachedRoot)).toEqual([detachedRoot])
    })

    it('never falls back to the filesystem root when nothing is inherited', () => {
      const entries = resolveServerFsAllow(detachedRoot)

      expect(entries).not.toContain('/')
      expect(entries).not.toContain(path.parse(detachedRoot).root)
    })
  })
})

describe('the nested worker checkout — the shape that broke collection', () => {
  it('is nested inside the repository', () => {
    expect(isStrictAncestor(REPO, PROBE_DIR)).toBe(true)
  })

  it('has no node_modules of its own, the way a fresh worktree has none', () => {
    expect(isDirectory(path.join(PROBE_DIR, NODE_MODULES_DIRECTORY))).toBe(false)
  })

  it('resolves a setup entry that is absolute', () => {
    for (const entry of resolveSetupFiles(PROBE_DIR)) {
      expect(path.isAbsolute(entry)).toBe(true)
    }
  })

  it('resolves a setup entry that exists on disk', () => {
    const entries = resolveSetupFiles(PROBE_DIR)

    expect(entries.length).toBeGreaterThanOrEqual(1)
    for (const entry of entries) {
      expect(fs.existsSync(entry)).toBe(true)
    }
  })

  it('resolves the nested setup entry to the inherited copy, never a bare specifier', () => {
    const entries = resolveSetupFiles(PROBE_DIR)

    expect(entries).not.toContain(BARE_SPECIFIER)
    for (const entry of entries) {
      expect(entry.startsWith(path.join(REPO, NODE_MODULES_DIRECTORY) + path.sep)).toBe(true)
    }
  })

  it('answers a trailing separator on the nested root identically', () => {
    expect(resolveSetupFiles(`${PROBE_DIR}/`)).toEqual(resolveSetupFiles(PROBE_DIR))
  })

  it('allows Vite to serve the nested checkout itself', () => {
    expect(resolveServerFsAllow(PROBE_DIR)).toContain(PROBE_DIR)
  })

  it('allows Vite to serve the parent checkout it inherits dependencies from', () => {
    const entries = resolveServerFsAllow(PROBE_DIR)

    const coversTheParent = entries.some(
      (entry) => entry === REPO || entry === path.join(REPO, NODE_MODULES_DIRECTORY),
    )

    expect(coversTheParent).toBe(true)
  })

  it('answers a trailing separator on the nested root identically for fs.allow', () => {
    expect(resolveServerFsAllow(`${PROBE_DIR}/`)).toEqual(resolveServerFsAllow(PROBE_DIR))
  })

  it('includes no filesystem root and no duplicate for the nested checkout', () => {
    const entries = resolveServerFsAllow(PROBE_DIR)

    expect(entries).not.toContain('/')
    expect(entries).toEqual([...new Set(entries)])
    for (const entry of entries) {
      expect(isStrictAncestor(entry, REPO)).toBe(false)
    }
  })
})

describe('purity — neither helper touches the filesystem', () => {
  const roots = [REPO, PROBE_DIR]

  it('leaves the worktrees directory listing unchanged', () => {
    const before = listingOf(WORKTREES_DIRECTORY)

    for (const root of roots) {
      resolveSetupFiles(root)
      resolveServerFsAllow(root)
    }

    expect(listingOf(WORKTREES_DIRECTORY)).toEqual(before)
  })

  it('leaves the repository root listing unchanged', () => {
    const before = listingOf(REPO)

    for (const root of roots) {
      resolveSetupFiles(root)
      resolveServerFsAllow(root)
    }

    expect(listingOf(REPO)).toEqual(before)
  })

  it('never creates the resolution anchor beside a root', () => {
    for (const root of roots) {
      resolveSetupFiles(root)
      resolveServerFsAllow(root)

      expect(fs.existsSync(path.join(root, RESOLUTION_ANCHOR))).toBe(false)
    }
  })

  it('creates nothing inside a root it can only fail on', () => {
    const detachedRoot = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kachalka-purity-')), 'worktree')
    fs.mkdirSync(detachedRoot, { recursive: true })

    try {
      expect(() => resolveSetupFiles(detachedRoot)).toThrow(BARE_SPECIFIER)
      resolveServerFsAllow(detachedRoot)

      expect(listingOf(detachedRoot)).toEqual([])
    } finally {
      fs.rmSync(path.dirname(detachedRoot), { recursive: true, force: true })
    }
  })
})

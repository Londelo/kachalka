// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CHECKOUT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
)

const CONFIG_SOURCE_PATH = path.join(CHECKOUT_ROOT, 'playwright.config.ts')

const SAFE_BASE_URL = 'http://localhost:4317'
const TIMEOUT_FLOOR_MS = 15_000
const SAVE_DEBOUNCE_MS = 5_000
const PORT_ENVIRONMENT_BASE_URL = 'http://localhost:4501'
const TRACKED_URLS = ['http://127.0.0.1:4317', 'http://localhost:4501'] as const

const WORKTREE_CWD = '/home/dev/webs/kachalka/.claude/worktrees/feature+test-harness-trust'

const EXPECTED_USE_KEYS = ['baseURL', 'screenshot', 'trace']
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

interface E2eProjectConfig {
  name?: string
  use?: Record<string, unknown>
}

interface E2eConfigShape {
  testDir?: string
  fullyParallel?: boolean
  workers?: number
  timeout?: number
  expect?: { timeout?: number }
  use?: Record<string, unknown>
  projects?: E2eProjectConfig[]
  webServer?: unknown
}

const { defineConfig } = vi.hoisted(() => ({
  defineConfig: vi.fn((config: unknown) => config),
}))

vi.mock('@playwright/test', () => ({ defineConfig }))

const ORIGINAL_E2E_BASE_URL = process.env.E2E_BASE_URL
const ORIGINAL_PORT = process.env.PORT

let cwdSpy: MockInstance | undefined

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

function stubCwd(directory: string): void {
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(directory)
}

async function loadConfig(): Promise<E2eConfigShape> {
  vi.resetModules()
  defineConfig.mockClear()

  const loaded = await import('../../../playwright.config')

  return loaded.default as E2eConfigShape
}

async function loadConfigWithBaseUrl(baseUrl: string): Promise<E2eConfigShape> {
  setEnv('E2E_BASE_URL', baseUrl)
  setEnv('PORT', undefined)

  return loadConfig()
}

function readConfigSource(): string {
  return fs.readFileSync(CONFIG_SOURCE_PATH, 'utf8')
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

function commentsOf(source: string): string {
  const blocks = source.match(/\/\*[\s\S]*?\*\//g) ?? []
  const lines = source.match(/(^|[^:])\/\/[^\n]*/g) ?? []

  return [...blocks, ...lines].join('\n')
}

function timeoutValueTokens(source: string): string[] {
  const body = stripComments(source)

  return [...body.matchAll(/\btimeout:\s*([^,\n}]+)/g)].map((match) => match[1].trim())
}

afterEach(() => {
  setEnv('E2E_BASE_URL', ORIGINAL_E2E_BASE_URL)
  setEnv('PORT', ORIGINAL_PORT)
  cwdSpy?.mockRestore()
  cwdSpy = undefined
  vi.resetModules()
})

describe('playwright.config.ts', () => {
  describe('use.baseURL', () => {
    it.each([
      {
        label: 'E2E_BASE_URL names the endpoint',
        env: { E2E_BASE_URL: SAFE_BASE_URL },
        expected: SAFE_BASE_URL,
      },
      {
        label: 'PORT names the endpoint and no base URL is set',
        env: { PORT: '4501' },
        expected: PORT_ENVIRONMENT_BASE_URL,
      },
    ])(
      'is exactly $expected when $label',
      async ({ env, expected }) => {
        setEnv('E2E_BASE_URL', env.E2E_BASE_URL)
        setEnv('PORT', env.PORT)

        const config = await loadConfig()

        expect(config.use?.baseURL).toBe(expected)
      },
    )

    it('tracks the environment — two configurations produce two different baseURLs', async () => {
      const first = (await loadConfigWithBaseUrl(TRACKED_URLS[0])).use?.baseURL
      const second = (await loadConfigWithBaseUrl(TRACKED_URLS[1])).use?.baseURL

      expect(first).toBe(TRACKED_URLS[0])
      expect(second).toBe(TRACKED_URLS[1])
      expect(first).not.toBe(second)
    })

    it('is produced by the shared accessor, which the file imports and calls', () => {
      const source = readConfigSource()

      expect(source).toMatch(/from\s+['"][^'"]*tests\/e2e\/e2e-config['"]/)
      expect(source).toMatch(/\bgetE2eBaseUrl\s*\(\s*\)/)
      expect(source).toMatch(/baseURL:\s*getE2eBaseUrl\s*\(\s*\)/)
    })

    it('leaves no 3111 literal anywhere in the file', () => {
      expect(readConfigSource()).not.toContain('3111')
    })

    it('leaves no hardcoded origin anywhere in the file', () => {
      expect(readConfigSource()).not.toMatch(/:\/\//)
    })

    it('throws at load time inside a worktree when neither variable is set', async () => {
      setEnv('E2E_BASE_URL', undefined)
      setEnv('PORT', undefined)
      stubCwd(WORKTREE_CWD)

      await expect(loadConfig()).rejects.toThrow(
        /Neither E2E_BASE_URL nor PORT is set.*is a worktree/s,
      )
    })
  })

  describe('timeouts', () => {
    it('sets an explicit per-assertion expect.timeout at or above the floor', async () => {
      const config = await loadConfigWithBaseUrl(SAFE_BASE_URL)

      expect(config.expect?.timeout).toBeDefined()
      expect(config.expect?.timeout).toBeGreaterThanOrEqual(TIMEOUT_FLOOR_MS)
    })

    it('sets an explicit per-test timeout at or above the floor', async () => {
      const config = await loadConfigWithBaseUrl(SAFE_BASE_URL)

      expect(config.timeout).toBeDefined()
      expect(config.timeout).toBeGreaterThanOrEqual(TIMEOUT_FLOOR_MS)
    })

    it('never gives one assertion more budget than the whole test', async () => {
      const config = await loadConfigWithBaseUrl(SAFE_BASE_URL)

      expect(config.timeout).toBeGreaterThanOrEqual(config.expect?.timeout ?? 0)
    })

    it('derives both timeouts from one named constant that cannot drift', async () => {
      const config = await loadConfigWithBaseUrl(SAFE_BASE_URL)
      const source = readConfigSource()
      const tokens = timeoutValueTokens(source)

      expect(config.timeout).toBe(config.expect?.timeout)
      expect(tokens).toHaveLength(2)
      expect(new Set(tokens).size).toBe(1)

      const constant = tokens[0]
      expect(IDENTIFIER.test(constant)).toBe(true)

      const declaration = source.match(
        new RegExp(`const\\s+${constant}\\s*=\\s*([\\d_]+)`),
      )
      expect(declaration, `${constant} is not declared as a numeric constant`).not.toBeNull()
      expect(Number(declaration?.[1].replace(/_/g, ''))).toBeGreaterThanOrEqual(TIMEOUT_FLOOR_MS)

      const literal = declaration?.[1] as string
      expect(stripComments(source).split(literal).length - 1).toBe(1)
    })

    it('states the save-debounce reason for the number in a comment', () => {
      const comments = commentsOf(readConfigSource())

      expect(comments).toMatch(/debounce/i)
      expect(comments).toContain(String(SAVE_DEBOUNCE_MS))
    })
  })

  describe('unchanged surface', () => {
    it('passes the config through defineConfig exactly once', async () => {
      const config = await loadConfigWithBaseUrl(SAFE_BASE_URL)

      expect(defineConfig).toHaveBeenCalledTimes(1)
      expect(defineConfig).toHaveBeenCalledWith(config)
    })

    it('still points testDir at the end-to-end directory', async () => {
      const config = await loadConfigWithBaseUrl(SAFE_BASE_URL)

      expect(config.testDir).toBe('./tests/e2e')
    })

    it('still refuses to parallelise', async () => {
      const config = await loadConfigWithBaseUrl(SAFE_BASE_URL)

      expect(config.fullyParallel).toBe(false)
      expect(config.workers).toBe(1)
    })

    it('still declares exactly one chromium project', async () => {
      const config = await loadConfigWithBaseUrl(SAFE_BASE_URL)

      expect(config.projects).toHaveLength(1)
      expect(config.projects?.[0].name).toBe('chromium')
      expect(config.projects?.[0].use?.browserName).toBe('chromium')
    })

    it('keeps every other use key at its previous value', async () => {
      const config = await loadConfigWithBaseUrl(SAFE_BASE_URL)

      expect(config.use?.screenshot).toBe('only-on-failure')
      expect(config.use?.trace).toBe('on-first-retry')
    })

    it('changes no use key besides baseURL', async () => {
      const config = await loadConfigWithBaseUrl(SAFE_BASE_URL)

      expect(Object.keys(config.use ?? {}).sort()).toEqual(EXPECTED_USE_KEYS)
    })

    it('declares no webServer block', async () => {
      const config = await loadConfigWithBaseUrl(SAFE_BASE_URL)

      expect(config.webServer).toBeUndefined()
      expect(stripComments(readConfigSource())).not.toMatch(/\bwebServer\b/)
    })
  })
})

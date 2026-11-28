import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const MAIN_CHECKOUT = '/home/dev/webs/kachalka'
const WORKTREE_CHECKOUT = '/home/dev/webs/kachalka/.claude/worktrees/feature+test-harness-trust'
const WORKTREES_AS_SUBSTRING_ONLY = '/home/dev/worktrees/kachalka'

const MAIN_CHECKOUT_DEFAULT_URL = 'http://localhost:3111'
const MAIN_CHECKOUT_DEFAULT_PORT = 3111

const PRISTINE_BASE_URL = process.env.E2E_BASE_URL
const PRISTINE_PORT = process.env.PORT
const PRISTINE_CWD = process.cwd()

interface ResolvedCase {
  name: string
  baseUrl: string | undefined
  port: string | undefined
  expectedUrl: string
  expectedPort: number
}

const RESOLVED_CASES: ResolvedCase[] = [
  {
    name: 'E2E_BASE_URL is honoured verbatim',
    baseUrl: 'http://localhost:4317',
    port: undefined,
    expectedUrl: 'http://localhost:4317',
    expectedPort: 4317,
  },
  {
    name: 'E2E_BASE_URL loses one trailing slash',
    baseUrl: 'http://localhost:4317/',
    port: undefined,
    expectedUrl: 'http://localhost:4317',
    expectedPort: 4317,
  },
  {
    name: 'E2E_BASE_URL names an IPv4 host',
    baseUrl: 'http://127.0.0.1:4500',
    port: undefined,
    expectedUrl: 'http://127.0.0.1:4500',
    expectedPort: 4500,
  },
  {
    name: 'E2E_BASE_URL loses surrounding whitespace',
    baseUrl: '  http://localhost:4317  ',
    port: undefined,
    expectedUrl: 'http://localhost:4317',
    expectedPort: 4317,
  },
  {
    name: 'E2E_BASE_URL may use the https scheme',
    baseUrl: 'https://localhost:4400',
    port: undefined,
    expectedUrl: 'https://localhost:4400',
    expectedPort: 4400,
  },
  {
    name: 'E2E_BASE_URL wins over PORT=4999 and carries its own port',
    baseUrl: 'http://localhost:4317',
    port: '4999',
    expectedUrl: 'http://localhost:4317',
    expectedPort: 4317,
  },
  {
    name: 'PORT alone builds a localhost origin',
    baseUrl: undefined,
    port: '4501',
    expectedUrl: 'http://localhost:4501',
    expectedPort: 4501,
  },
  {
    name: 'PORT at the lowest accepted boundary',
    baseUrl: undefined,
    port: '1',
    expectedUrl: 'http://localhost:1',
    expectedPort: 1,
  },
  {
    name: 'PORT at the highest accepted boundary',
    baseUrl: undefined,
    port: '65535',
    expectedUrl: 'http://localhost:65535',
    expectedPort: 65535,
  },
  {
    name: 'neither variable set in a plain checkout takes the built-in default',
    baseUrl: undefined,
    port: undefined,
    expectedUrl: MAIN_CHECKOUT_DEFAULT_URL,
    expectedPort: MAIN_CHECKOUT_DEFAULT_PORT,
  },
]

interface RejectedCase {
  name: string
  variable: 'E2E_BASE_URL' | 'PORT'
  value: string
}

const REJECTED_CASES: RejectedCase[] = [
  { name: 'E2E_BASE_URL is not a URL at all', variable: 'E2E_BASE_URL', value: 'not-a-url' },
  { name: 'E2E_BASE_URL has no scheme', variable: 'E2E_BASE_URL', value: 'localhost:4317' },
  { name: 'E2E_BASE_URL uses a non-http scheme', variable: 'E2E_BASE_URL', value: 'ftp://localhost:4317' },
  { name: 'E2E_BASE_URL names no port', variable: 'E2E_BASE_URL', value: 'http://localhost' },
  { name: 'PORT is below the lowest accepted port', variable: 'PORT', value: '0' },
  { name: 'PORT is one above the highest accepted port', variable: 'PORT', value: '65536' },
  { name: 'PORT is far above the accepted range', variable: 'PORT', value: '70000' },
  { name: 'PORT is not numeric', variable: 'PORT', value: 'abc' },
]

interface BlankCase {
  name: string
  blanked: 'E2E_BASE_URL' | 'PORT'
  blankValue: string
  otherValue: string | undefined
  expectedUrl: string
  expectedPort: number
}

const BLANK_CASES: BlankCase[] = [
  {
    name: 'an empty PORT falls through to the built-in default',
    blanked: 'PORT',
    blankValue: '',
    otherValue: undefined,
    expectedUrl: MAIN_CHECKOUT_DEFAULT_URL,
    expectedPort: MAIN_CHECKOUT_DEFAULT_PORT,
  },
  {
    name: 'a whitespace-only PORT falls through to the built-in default',
    blanked: 'PORT',
    blankValue: '   ',
    otherValue: undefined,
    expectedUrl: MAIN_CHECKOUT_DEFAULT_URL,
    expectedPort: MAIN_CHECKOUT_DEFAULT_PORT,
  },
  {
    name: 'an empty E2E_BASE_URL yields to PORT',
    blanked: 'E2E_BASE_URL',
    blankValue: '',
    otherValue: '4501',
    expectedUrl: 'http://localhost:4501',
    expectedPort: 4501,
  },
  {
    name: 'a whitespace-only E2E_BASE_URL yields to PORT',
    blanked: 'E2E_BASE_URL',
    blankValue: '   ',
    otherValue: '4501',
    expectedUrl: 'http://localhost:4501',
    expectedPort: 4501,
  },
]

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  Object.defineProperty(process.env, name, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  })
}

function configureEndpoint(
  baseUrl: string | undefined,
  port: string | undefined,
  checkout: string = MAIN_CHECKOUT,
): void {
  setEnv('E2E_BASE_URL', baseUrl)
  setEnv('PORT', port)
  vi.spyOn(process, 'cwd').mockReturnValue(checkout)
}

async function loadE2eConfig(): Promise<{ getE2eBaseUrl: () => string; getE2ePort: () => number }> {
  vi.resetModules()
  return import('../../e2e/e2e-config')
}

function warningLines(): string[] {
  return vi.mocked(console.warn).mock.calls.map((call) => String(call[0]))
}

describe('e2e-config endpoint accessor', () => {
  beforeEach(() => {
    delete process.env.E2E_BASE_URL
    delete process.env.PORT
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setEnv('E2E_BASE_URL', PRISTINE_BASE_URL)
    setEnv('PORT', PRISTINE_PORT)
  })

  describe('resolution', () => {
    it.each(RESOLVED_CASES)('$name', async ({ baseUrl, port, expectedUrl, expectedPort }) => {
      configureEndpoint(baseUrl, port)
      const config = await loadE2eConfig()

      expect(config.getE2eBaseUrl()).toBe(expectedUrl)
      expect(config.getE2ePort()).toBe(expectedPort)
    })
  })

  describe('rejected configuration', () => {
    it.each(REJECTED_CASES)('$name', async ({ variable, value }) => {
      const baseUrl = variable === 'E2E_BASE_URL' ? value : undefined
      const port = variable === 'PORT' ? value : undefined
      configureEndpoint(baseUrl, port)
      const config = await loadE2eConfig()

      expect(() => config.getE2eBaseUrl()).toThrow(new RegExp(variable))
      expect(() => config.getE2eBaseUrl()).toThrow(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      expect(() => config.getE2ePort()).toThrow(new RegExp(variable))
    })
  })

  describe('blank configuration is absent, not invalid', () => {
    it.each(BLANK_CASES)('$name', async ({ blanked, blankValue, otherValue, expectedUrl, expectedPort }) => {
      const baseUrl = blanked === 'E2E_BASE_URL' ? blankValue : otherValue
      const port = blanked === 'PORT' ? blankValue : otherValue
      configureEndpoint(baseUrl, port)
      const config = await loadE2eConfig()

      expect(config.getE2eBaseUrl()).toBe(expectedUrl)
      expect(config.getE2ePort()).toBe(expectedPort)
    })
  })

  describe('main-checkout default warning', () => {
    it('warns exactly once, naming the default port', async () => {
      configureEndpoint(undefined, undefined)
      const config = await loadE2eConfig()

      expect(config.getE2eBaseUrl()).toBe(MAIN_CHECKOUT_DEFAULT_URL)
      expect(warningLines()).toHaveLength(1)
      expect(warningLines()[0]).toContain(String(MAIN_CHECKOUT_DEFAULT_PORT))
    })

    it('warns once per process rather than once per call', async () => {
      configureEndpoint(undefined, undefined)
      const config = await loadE2eConfig()

      config.getE2eBaseUrl()
      config.getE2eBaseUrl()
      config.getE2ePort()
      config.getE2ePort()

      expect(warningLines()).toHaveLength(1)
    })

    it('stays silent when the endpoint came from the environment', async () => {
      configureEndpoint('http://localhost:4317', '4999')
      const config = await loadE2eConfig()

      config.getE2eBaseUrl()
      config.getE2ePort()

      expect(warningLines()).toHaveLength(0)
    })
  })

  describe('worktree checkout with no endpoint configured', () => {
    it('refuses to resolve a base URL', async () => {
      configureEndpoint(undefined, undefined, WORKTREE_CHECKOUT)
      const config = await loadE2eConfig()

      expect(() => config.getE2eBaseUrl()).toThrow()
    })

    it('refuses to resolve a port', async () => {
      configureEndpoint(undefined, undefined, WORKTREE_CHECKOUT)
      const config = await loadE2eConfig()

      expect(() => config.getE2ePort()).toThrow()
    })

    it('names the working directory it refused', async () => {
      configureEndpoint(undefined, undefined, WORKTREE_CHECKOUT)
      const config = await loadE2eConfig()

      expect(() => config.getE2eBaseUrl()).toThrow(WORKTREE_CHECKOUT)
    })

    it('names the remedy the operator must run instead', async () => {
      configureEndpoint(undefined, undefined, WORKTREE_CHECKOUT)
      const config = await loadE2eConfig()

      expect(() => config.getE2eBaseUrl()).toThrow(/npm run test:e2e/)
    })

    it('never falls back to the default port and never warns', async () => {
      configureEndpoint(undefined, undefined, WORKTREE_CHECKOUT)
      const config = await loadE2eConfig()

      expect(() => config.getE2eBaseUrl()).toThrow()
      expect(() => config.getE2ePort()).toThrow()
      expect(warningLines()).toHaveLength(0)
    })

    it('treats a checkout whose path merely contains "worktrees" as plain', async () => {
      configureEndpoint(undefined, undefined, WORKTREES_AS_SUBSTRING_ONLY)
      const config = await loadE2eConfig()

      expect(config.getE2eBaseUrl()).toBe(MAIN_CHECKOUT_DEFAULT_URL)
      expect(config.getE2ePort()).toBe(MAIN_CHECKOUT_DEFAULT_PORT)
    })
  })

  describe('consistency and stability', () => {
    it.each(RESOLVED_CASES)('$name', async ({ baseUrl, port, expectedUrl, expectedPort }) => {
      configureEndpoint(baseUrl, port)
      const config = await loadE2eConfig()

      const firstUrl = config.getE2eBaseUrl()
      const secondUrl = config.getE2eBaseUrl()
      const firstPort = config.getE2ePort()
      const secondPort = config.getE2ePort()

      expect(firstUrl).toBe(expectedUrl)
      expect(secondUrl).toBe(firstUrl)
      expect(firstPort).toBe(expectedPort)
      expect(secondPort).toBe(firstPort)
      expect(firstUrl).not.toMatch(/\/$/)
      expect(new URL(firstUrl).port).toBe(String(firstPort))
    })
  })

  describe('leak-proof teardown', () => {
    it('leaves the environment and the working directory exactly as it found them', () => {
      expect(process.env.E2E_BASE_URL).toBe(PRISTINE_BASE_URL)
      expect(process.env.PORT).toBe(PRISTINE_PORT)
      expect(process.cwd()).toBe(PRISTINE_CWD)
    })
  })
})

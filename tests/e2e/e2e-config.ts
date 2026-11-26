import path from 'node:path'

const MAIN_CHECKOUT_DEFAULT_PORT = 3111
const MIN_PORT = 1
const MAX_PORT = 65535
const CLAUDE_DIRECTORY = '.claude'
const WORKTREES_DIRECTORY = 'worktrees'
const DIGITS_ONLY = /^\d+$/

interface E2eEndpoint {
  baseUrl: string
  port: number
}

let defaultWarningEmitted = false

function readEnvironment(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value === undefined || value === '' ? undefined : value
}

function isTcpPort(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_PORT && value <= MAX_PORT
}

function authorityOf(url: string): string {
  const separator = url.indexOf('//')
  const withoutScheme = separator === -1 ? url : url.slice(separator + 2)
  const pathStart = withoutScheme.search(/[/?#]/)

  return pathStart === -1 ? withoutScheme : withoutScheme.slice(0, pathStart)
}

function explicitPortOf(url: URL, authority: string): number | undefined {
  if (url.port !== '') {
    return Number(url.port)
  }

  const host = authority.slice(authority.lastIndexOf('@') + 1)
  const separator = host.lastIndexOf(':')

  if (separator === -1) {
    return undefined
  }

  const digits = host.slice(separator + 1)

  return DIGITS_ONLY.test(digits) ? Number(digits) : undefined
}

function parseBaseUrl(configured: string): E2eEndpoint {
  const baseUrl = configured.endsWith('/') ? configured.slice(0, -1) : configured

  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new Error(`E2E_BASE_URL is not an absolute URL: "${baseUrl}"`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`E2E_BASE_URL must use the http or https scheme: "${baseUrl}"`)
  }

  if (url.hostname === '') {
    throw new Error(`E2E_BASE_URL names no host: "${baseUrl}"`)
  }

  const port = explicitPortOf(url, authorityOf(baseUrl))

  if (port === undefined || !isTcpPort(port)) {
    throw new Error(
      `E2E_BASE_URL must name an explicit TCP port between ${MIN_PORT} and ${MAX_PORT}: "${baseUrl}"`,
    )
  }

  return { baseUrl, port }
}

function parsePort(configured: string): E2eEndpoint {
  const port = DIGITS_ONLY.test(configured) ? Number(configured) : Number.NaN

  if (!isTcpPort(port)) {
    throw new Error(`PORT must be an integer TCP port between ${MIN_PORT} and ${MAX_PORT}: "${configured}"`)
  }

  return { baseUrl: `http://localhost:${port}`, port }
}

function isWorktreeCheckout(checkoutRoot: string): boolean {
  const segments = checkoutRoot.split(path.sep)

  for (let index = 0; index + 2 < segments.length; index += 1) {
    if (segments[index] === CLAUDE_DIRECTORY && segments[index + 1] === WORKTREES_DIRECTORY) {
      return true
    }
  }

  return false
}

function mainCheckoutDefault(checkoutRoot: string): E2eEndpoint {
  if (isWorktreeCheckout(checkoutRoot)) {
    throw new Error(
      `Neither E2E_BASE_URL nor PORT is set and "${checkoutRoot}" is a worktree, so this checkout has ` +
        `no server of its own to drive and would run against whichever server already answers on the ` +
        `default port. Run "npm run test:e2e", which starts this worktree's own server and exports its ` +
        `endpoint, instead of running "npx playwright test" directly.`,
    )
  }

  if (!defaultWarningEmitted) {
    defaultWarningEmitted = true
    console.warn(
      `[e2e-config] Neither E2E_BASE_URL nor PORT is set; using the built-in main-checkout default ` +
        `port ${MAIN_CHECKOUT_DEFAULT_PORT} (http://localhost:${MAIN_CHECKOUT_DEFAULT_PORT}).`,
    )
  }

  return { baseUrl: `http://localhost:${MAIN_CHECKOUT_DEFAULT_PORT}`, port: MAIN_CHECKOUT_DEFAULT_PORT }
}

function resolveEndpoint(): E2eEndpoint {
  const configuredUrl = readEnvironment('E2E_BASE_URL')
  if (configuredUrl !== undefined) {
    return parseBaseUrl(configuredUrl)
  }

  const configuredPort = readEnvironment('PORT')
  if (configuredPort !== undefined) {
    return parsePort(configuredPort)
  }

  return mainCheckoutDefault(path.resolve(process.cwd()))
}

export function getE2eBaseUrl(): string {
  return resolveEndpoint().baseUrl
}

export function getE2ePort(): number {
  return resolveEndpoint().port
}

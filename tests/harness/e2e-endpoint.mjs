import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const MAIN_CHECKOUT_PORT = 3111
const WORKTREE_PORT_FLOOR = 4200
const WORKTREE_PORT_CEILING = 4999
const CLAUDE_DIRECTORY = '.claude'
const WORKTREES_DIRECTORY = 'worktrees'
const LISTEN_SOCKET_STATE = '0A'
const PROC_NET_PROTOCOLS = ['/proc/net/tcp', '/proc/net/tcp6']
const SOCKET_LINK_PATTERN = /^socket:\[(\d+)\]$/
const PID_DIRECTORY_PATTERN = /^\d+$/
const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193
const AVALANCHE_MIX_A = 0x85ebca6b
const AVALANCHE_MIX_B = 0xc2b2ae35
export const MIN_PORT = 1
export const MAX_PORT = 65535
const MIN_PID = 1
const USAGE =
  'Usage: node tests/harness/e2e-endpoint.mjs port <checkoutRoot> | guard <port> <spawnedPid>'

/**
 * @typedef {object} PortOccupancy
 * @property {boolean} free True when nothing is listening on the port.
 * @property {number} [pid] Pid of the process holding the port.
 * @property {string} [cwd] Working directory of that process.
 * @property {string} [command] Command line of that process.
 */

/**
 * @param {number} value
 * @returns {number}
 */
function requirePort(value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < MIN_PORT || value > MAX_PORT) {
    throw new Error(`"${String(value)}" is not a TCP port: expected an integer between ${MIN_PORT} and ${MAX_PORT}.`)
  }

  return value
}

/**
 * @param {number} value
 * @returns {number}
 */
function requirePid(value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < MIN_PID) {
    throw new Error(`"${String(value)}" is not a process id: expected a positive integer.`)
  }

  return value
}

/**
 * @param {number} hash
 * @returns {number}
 */
function avalanche(hash) {
  const first = Math.imul(hash ^ (hash >>> 16), AVALANCHE_MIX_A) >>> 0
  const second = Math.imul(first ^ (first >>> 13), AVALANCHE_MIX_B) >>> 0

  return (second ^ (second >>> 16)) >>> 0
}

/**
 * @param {string} value
 * @returns {number}
 */
function foldThroughHash(value) {
  let hash = FNV_OFFSET_BASIS

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), FNV_PRIME) >>> 0
  }

  return avalanche(hash)
}

/**
 * True when the checkout lives under a ".claude/worktrees" directory, which is
 * what makes it a worktree of some other checkout rather than a checkout with a
 * server of its own.
 *
 * @param {string} checkoutRoot Absolute path of the checkout.
 * @returns {boolean}
 */
export function isWorktreeCheckout(checkoutRoot) {
  const segments = checkoutRoot.split(path.sep)

  for (let index = 0; index + 2 < segments.length; index += 1) {
    if (segments[index] === CLAUDE_DIRECTORY && segments[index + 1] === WORKTREES_DIRECTORY) {
      return true
    }
  }

  return false
}

/**
 * Picks the port the end-to-end suite runs on. The main checkout keeps the
 * historical fixed port; a worktree checkout gets a port folded deterministically
 * from its own absolute path inside the 4200-4999 band.
 *
 * @param {string} checkoutRoot Absolute (or cwd-relative) path of the checkout.
 * @returns {number}
 */
export function deriveE2ePort(checkoutRoot) {
  if (typeof checkoutRoot !== 'string' || checkoutRoot.trim() === '') {
    throw new Error('Cannot derive a port from an empty checkout root.')
  }

  const normalized = path.resolve(checkoutRoot)

  if (!isWorktreeCheckout(normalized)) {
    return MAIN_CHECKOUT_PORT
  }

  const bandWidth = WORKTREE_PORT_CEILING - WORKTREE_PORT_FLOOR + 1

  return WORKTREE_PORT_FLOOR + (foldThroughHash(normalized) % bandWidth)
}

/**
 * @param {string} filePath
 * @param {number} port
 * @returns {string[]}
 */
function listeningInodesFromProcNet(filePath, port) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').slice(1)
  /** @type {string[]} */
  const inodes = []

  for (const line of lines) {
    const fields = line.trim().split(/\s+/)

    if (fields.length < 10 || fields[3] !== LISTEN_SOCKET_STATE) {
      continue
    }

    const localAddress = fields[1]
    const separator = localAddress.lastIndexOf(':')

    if (separator === -1 || Number.parseInt(localAddress.slice(separator + 1), 16) !== port) {
      continue
    }

    inodes.push(fields[9])
  }

  return inodes
}

/**
 * @param {number} port
 * @returns {Set<string> | null} Null when no /proc table could be read at all.
 */
function listeningSocketInodes(port) {
  const readable = PROC_NET_PROTOCOLS.filter((filePath) => fs.existsSync(filePath))

  if (readable.length === 0) {
    return null
  }

  const inodes = new Set()

  for (const filePath of readable) {
    try {
      for (const inode of listeningInodesFromProcNet(filePath, port)) {
        inodes.add(inode)
      }
    } catch {
      return null
    }
  }

  return inodes
}

/**
 * @param {Set<string>} inodes
 * @returns {Set<number>}
 */
function pidsOwningSocketInodes(inodes) {
  /** @type {Set<number>} */
  const pids = new Set()

  if (inodes.size === 0) {
    return pids
  }

  let entries
  try {
    entries = fs.readdirSync('/proc')
  } catch {
    return pids
  }

  for (const entry of entries) {
    if (!PID_DIRECTORY_PATTERN.test(entry)) {
      continue
    }

    const fdDirectory = `/proc/${entry}/fd`
    let descriptors
    try {
      descriptors = fs.readdirSync(fdDirectory)
    } catch {
      continue
    }

    for (const descriptor of descriptors) {
      let target
      try {
        target = fs.readlinkSync(path.join(fdDirectory, descriptor))
      } catch {
        continue
      }

      const match = SOCKET_LINK_PATTERN.exec(target)

      if (match !== null && inodes.has(match[1])) {
        pids.add(Number.parseInt(entry, 10))
        break
      }
    }
  }

  return pids
}

/**
 * @param {number} port
 * @returns {number[] | null} Null when lsof could not be run at all.
 */
function listeningPidsViaLsof(port) {
  const result = spawnSync('lsof', ['-n', '-P', '-t', '-i', `TCP:${port}`, '-sTCP:LISTEN'], {
    encoding: 'utf8',
  })

  if (result.error !== undefined || result.status === null) {
    return null
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => PID_DIRECTORY_PATTERN.test(line))
    .map(Number)
}

/**
 * @param {number} port
 * @returns {{ holders: number[], sockets: number }}
 */
function whoHoldsPort(port) {
  const inodes = listeningSocketInodes(port)
  const fromLsof = listeningPidsViaLsof(port)

  if (inodes === null && fromLsof === null) {
    throw new Error(
      `Cannot inspect port ${port}: neither the /proc/net/tcp tables nor "lsof" could be read, ` +
        `so no answer about who holds that port can be trusted.`,
    )
  }

  const holders = new Set([...(inodes === null ? [] : pidsOwningSocketInodes(inodes)), ...(fromLsof ?? [])])

  return { holders: [...holders].sort((left, right) => left - right), sockets: inodes === null ? 0 : inodes.size }
}

/**
 * @param {number} pid
 * @returns {string | undefined}
 */
function readProcessCwd(pid) {
  try {
    return fs.readlinkSync(`/proc/${pid}/cwd`)
  } catch {
    const result = spawnSync('lsof', ['-n', '-p', String(pid), '-a', '-d', 'cwd', '-Fn'], { encoding: 'utf8' })

    if (result.error !== undefined || result.status === null) {
      return undefined
    }

    const directory = result.stdout
      .split('\n')
      .filter((line) => line.startsWith('n'))
      .map((line) => line.slice(1))
      .find((value) => value !== '')

    return directory
  }
}

/**
 * @param {number} pid
 * @returns {string | undefined}
 */
function readProcessCommand(pid) {
  try {
    const raw = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8')
    const command = raw
      .split('\0')
      .filter((argument) => argument !== '')
      .join(' ')

    if (command !== '') {
      return command
    }
  } catch {}

  const result = spawnSync('ps', ['-o', 'args=', '-p', String(pid)], { encoding: 'utf8' })

  if (result.error !== undefined || result.status === null) {
    return undefined
  }

  const command = result.stdout.trim()

  return command === '' ? undefined : command
}

/**
 * @param {number} pid
 * @returns {number} Zero when the parent cannot be read.
 */
function parentProcessIdOf(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
    const closingParenthesis = stat.lastIndexOf(')')

    if (closingParenthesis === -1) {
      return 0
    }

    return Number.parseInt(stat.slice(closingParenthesis + 2).split(/\s+/)[1], 10) || 0
  } catch {
    const result = spawnSync('ps', ['-o', 'ppid=', '-p', String(pid)], { encoding: 'utf8' })

    if (result.error !== undefined || result.status === null) {
      return 0
    }

    return Number.parseInt(result.stdout.trim(), 10) || 0
  }
}

/**
 * @param {number} pid
 * @param {number} ancestorPid
 * @returns {boolean}
 */
function isSelfOrDescendantOf(pid, ancestorPid) {
  if (ancestorPid <= 1) {
    return false
  }

  let current = pid
  const visited = new Set()

  while (current > 1 && !visited.has(current)) {
    if (current === ancestorPid) {
      return true
    }

    visited.add(current)
    current = parentProcessIdOf(current)
  }

  return false
}

/**
 * Reports who, if anyone, is listening on a port. The answer comes from the
 * kernel's own listener tables, never from a refused connection.
 *
 * @param {number} port
 * @returns {PortOccupancy}
 */
export function checkPortIsFree(port) {
  const validated = requirePort(port)
  const { holders, sockets } = whoHoldsPort(validated)

  if (holders.length === 0 && sockets === 0) {
    return { free: true }
  }

  if (holders.length === 0) {
    return { free: false }
  }

  const [pid] = holders
  const cwd = readProcessCwd(pid)
  const command = readProcessCommand(pid)

  return {
    free: false,
    pid,
    ...(cwd === undefined ? {} : { cwd }),
    ...(command === undefined ? {} : { command }),
  }
}

/**
 * Throws unless the listener on `port` is the server this run started, or one
 * of its descendants. A server with no listener at all is also refused: an
 * unproven server is exactly the failure this module exists to kill.
 *
 * @param {number} port
 * @param {number} spawnedPid Pid the runner started the server with.
 * @returns {void}
 */
export function assertServerIsOurs(port, spawnedPid) {
  const validatedPort = requirePort(port)
  const ownerPid = requirePid(spawnedPid)
  const { holders } = whoHoldsPort(validatedPort)

  if (holders.length === 0) {
    throw new Error(
      `Nothing is listening on port ${validatedPort}, so the server on it cannot be proved to belong ` +
        `to this run (pid ${ownerPid}).`,
    )
  }

  const foreignPid = holders.find((pid) => !isSelfOrDescendantOf(pid, ownerPid))

  if (foreignPid === undefined) {
    return
  }

  const cwd = readProcessCwd(foreignPid)
  const command = readProcessCommand(foreignPid)

  throw new Error(
    `Port ${validatedPort} is held by pid ${foreignPid}, working directory ${cwd ?? 'unknown'}` +
      `${command === undefined ? '' : `, command "${command}"`}. That process is neither the server this ` +
      `run started (pid ${ownerPid}) nor one of its descendants, so this checkout refuses to run its ` +
      `end-to-end suite against somebody else's build.`,
  )
}

/**
 * @param {string[]} argv
 * @returns {number} Exit code.
 */
function runCli(argv) {
  const [command, ...rest] = argv

  if (command === 'port') {
    if (rest.length !== 1) {
      process.stderr.write(`port needs exactly one checkout root.\n${USAGE}\n`)
      return 1
    }

    process.stdout.write(`${deriveE2ePort(rest[0])}\n`)
    return 0
  }

  if (command === 'guard') {
    if (rest.length !== 2) {
      process.stderr.write(`guard needs exactly a port and a spawned pid.\n${USAGE}\n`)
      return 1
    }

    const port = Number(rest[0])
    const spawnedPid = Number(rest[1])

    if (!Number.isInteger(port) || !Number.isInteger(spawnedPid)) {
      process.stderr.write(`guard needs an integer port and an integer pid, got "${rest[0]}" and "${rest[1]}".\n${USAGE}\n`)
      return 1
    }

    const occupancy = checkPortIsFree(port)

    if (occupancy.free) {
      return 0
    }

    try {
      assertServerIsOurs(port, spawnedPid)
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
      return 1
    }

    return 0
  }

  process.stderr.write(`Unknown subcommand "${String(command)}".\n${USAGE}\n`)
  return 1
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  process.exitCode = runCli(process.argv.slice(2))
}

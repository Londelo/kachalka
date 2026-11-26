import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import net from 'node:net'
import type { AddressInfo } from 'node:net'
import { spawn, spawnSync } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import {
  assertServerIsOurs,
  checkPortIsFree,
  deriveE2ePort,
} from '../../harness/e2e-endpoint.mjs'

const MODULE_PATH = path.resolve(process.cwd(), 'tests', 'harness', 'e2e-endpoint.mjs')

const MAIN_CHECKOUT_PORT = 3111
const BAND_FLOOR = 4200
const BAND_CEILING = 4999

const MAIN_CHECKOUT = '/home/dev/webs/kachalka'
const WORKTREE_PARENT = '/home/dev/webs/kachalka/.claude/worktrees'
const WORKTREE_HARNESS_TRUST = `${WORKTREE_PARENT}/feature+test-harness-trust`
const WORKTREE_COUNTED_SET_DOMAIN = `${WORKTREE_PARENT}/feature+counted-set-domain`
const SUBSTRING_ONLY_WORKTREES = '/home/dev/worktrees/kachalka'

const SYNTHETIC_WORKTREE_PATHS = Array.from(
  { length: 20 },
  (_unused, index) => `${WORKTREE_PARENT}/harness-suite-${index}`,
)

const openServers = new Set<net.Server>()
const spawnedChildren = new Set<ChildProcess>()
const processGroupLeaders = new Set<number>()

function listenOnEphemeralPort(): Promise<{ server: net.Server; port: number }> {
  const server = net.createServer()
  openServers.add(server)

  return new Promise((resolve) => {
    server.listen(0, '0.0.0.0', () => {
      resolve({ server, port: (server.address() as AddressInfo).port })
    })
  })
}

function closeServer(server: net.Server): Promise<void> {
  if (!server.listening) {
    openServers.delete(server)
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    server.close(() => {
      openServers.delete(server)
      resolve()
    })
  })
}

async function reserveAnUnusedPort(): Promise<number> {
  const { server, port } = await listenOnEphemeralPort()
  await closeServer(server)

  return port
}

function spawnNode(args: string[], options: { detached?: boolean } = {}): ChildProcess {
  const child = spawn(process.execPath, args, {
    stdio: 'ignore',
    detached: options.detached ?? false,
  })
  spawnedChildren.add(child)

  if (options.detached && child.pid !== undefined) {
    processGroupLeaders.add(child.pid)
  }

  return child
}

function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    child.once('exit', () => resolve())
  })
}

function connectOnce(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1')
    socket.once('connect', () => {
      socket.destroy()
      resolve()
    })
    socket.once('error', reject)
  })
}

async function waitForListener(port: number, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs

  for (;;) {
    try {
      await connectOnce(port)
      return
    } catch {
      if (Date.now() > deadline) {
        throw new Error(`No listener ever accepted a connection on port ${port}.`)
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
}

async function waitForFreePort(port: number, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs

  for (;;) {
    if (checkPortIsFree(port).free) {
      return
    }
    if (Date.now() > deadline) {
      throw new Error(`Port ${port} never became free again.`)
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

function listenerSource(port: number): string {
  return `require('node:net').createServer().listen(${port},'0.0.0.0')`
}

function parentOfListenerSource(port: number): string {
  return (
    `require('node:child_process').spawn(process.execPath,` +
    `['-e',${JSON.stringify(listenerSource(port))}],{stdio:'ignore'});` +
    `setInterval(()=>{},1000)`
  )
}

function runCli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [MODULE_PATH, ...args], { encoding: 'utf8' })

  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

function isBandPort(port: number): boolean {
  return (
    typeof port === 'number' &&
    Number.isInteger(port) &&
    port >= BAND_FLOOR &&
    port <= BAND_CEILING &&
    port !== MAIN_CHECKOUT_PORT
  )
}

describe('e2e-endpoint', () => {
  afterAll(async () => {
    for (const child of spawnedChildren) {
      try {
        child.kill('SIGKILL')
      } catch {}
    }
    for (const leader of processGroupLeaders) {
      try {
        process.kill(-leader, 'SIGKILL')
      } catch {}
    }

    await Promise.all([...spawnedChildren].map(waitForExit))
    await Promise.all([...openServers].map(closeServer))

    openServers.clear()
    spawnedChildren.clear()
    processGroupLeaders.clear()
  })

  describe('deriveE2ePort', () => {
    describe('the main checkout keeps the historical port', () => {
      const mainCheckoutCases = [
        { label: 'bare main checkout', checkoutRoot: MAIN_CHECKOUT },
        { label: 'main checkout with a trailing separator', checkoutRoot: `${MAIN_CHECKOUT}/` },
        { label: 'main checkout with a doubled trailing separator', checkoutRoot: `${MAIN_CHECKOUT}//` },
      ]

      it.each(mainCheckoutCases)('returns 3111 for $label', ({ checkoutRoot }) => {
        expect(deriveE2ePort(checkoutRoot)).toBe(MAIN_CHECKOUT_PORT)
      })

      it('treats a path that merely contains "worktrees" as the main checkout', () => {
        expect(deriveE2ePort(SUBSTRING_ONLY_WORKTREES)).toBe(MAIN_CHECKOUT_PORT)
      })

      it('treats a .claude directory that is not the worktrees directory as the main checkout', () => {
        expect(deriveE2ePort(`${MAIN_CHECKOUT}/.claude/settings/worktrees`)).toBe(MAIN_CHECKOUT_PORT)
      })
    })

    describe('a worktree checkout gets its own in-band port', () => {
      it('returns an integer inside 4200-4999 that is never 3111', () => {
        const port = deriveE2ePort(WORKTREE_HARNESS_TRUST)

        expect(typeof port).toBe('number')
        expect(isBandPort(port)).toBe(true)
      })

      it('answers identically for the same path on repeated calls', () => {
        const first = deriveE2ePort(WORKTREE_HARNESS_TRUST)
        const second = deriveE2ePort(WORKTREE_HARNESS_TRUST)
        const third = deriveE2ePort(WORKTREE_HARNESS_TRUST)

        expect([first, second, third]).toEqual([first, first, first])
      })

      it('answers identically when the worktree path carries a trailing separator', () => {
        expect(deriveE2ePort(`${WORKTREE_HARNESS_TRUST}/`)).toBe(deriveE2ePort(WORKTREE_HARNESS_TRUST))
      })

      it('separates two sibling worktrees onto different ports', () => {
        expect(deriveE2ePort(WORKTREE_COUNTED_SET_DOMAIN)).not.toBe(
          deriveE2ePort(WORKTREE_HARNESS_TRUST),
        )
      })

      it('spreads 20 distinct worktree paths over 20 distinct in-band ports', () => {
        const ports = SYNTHETIC_WORKTREE_PATHS.map(deriveE2ePort)

        expect(new Set(SYNTHETIC_WORKTREE_PATHS).size).toBe(20)
        expect(ports).toHaveLength(20)
        expect(new Set(ports).size).toBe(20)
        expect(ports.every(isBandPort)).toBe(true)
      })

      it('keeps the answer stable when the same worktree path is resolved from a relative form', () => {
        const absolute = '/home/dev/webs/kachalka/.claude/worktrees/harness-suite-3'
        const relative = '/home/dev/webs/kachalka/./webs/../.claude/worktrees/harness-suite-3'

        expect(deriveE2ePort(relative)).toBe(deriveE2ePort(absolute))
      })
    })

    describe('a checkout root that cannot name a path is refused', () => {
      const refusedCases = [
        { label: 'an empty string', checkoutRoot: '' },
        { label: 'a whitespace-only string', checkoutRoot: '   ' },
        { label: 'null', checkoutRoot: null },
        { label: 'undefined', checkoutRoot: undefined },
        { label: 'a number', checkoutRoot: 3111 },
        { label: 'an object', checkoutRoot: { path: MAIN_CHECKOUT } },
      ]

      it.each(refusedCases)('throws naming the empty checkout root for $label', ({ checkoutRoot }) => {
        expect(() => deriveE2ePort(checkoutRoot as unknown as string)).toThrow(
          'Cannot derive a port from an empty checkout root.',
        )
      })
    })
  })

  describe('checkPortIsFree', () => {
    describe('a port with no listener', () => {
      it('reports exactly { free: true } with no holder fields', async () => {
        const port = await reserveAnUnusedPort()

        expect(checkPortIsFree(port)).toEqual({ free: true })
      })
    })

    describe('a port held by a listener in this process', () => {
      let port: number

      beforeAll(async () => {
        const listening = await listenOnEphemeralPort()
        port = listening.port
        await waitForListener(port)
      })

      it('reports the holder with a positive integer pid, a cwd and a command', () => {
        const occupancy = checkPortIsFree(port)

        expect(occupancy.free).toBe(false)
        expect(occupancy.pid).toBe(process.pid)
        expect(Number.isInteger(occupancy.pid)).toBe(true)
        expect((occupancy.pid as number)).toBeGreaterThan(0)
        expect(typeof occupancy.cwd).toBe('string')
        expect((occupancy.cwd as string).length).toBeGreaterThan(0)
        expect(typeof occupancy.command).toBe('string')
        expect((occupancy.command as string).length).toBeGreaterThan(0)
      })
    })

    describe('a port held by a listener this run spawned', () => {
      let holder: ChildProcess
      let port: number

      beforeAll(async () => {
        port = await reserveAnUnusedPort()
        holder = spawnNode(['-e', listenerSource(port)])
        await waitForListener(port)
      })

      afterAll(async () => {
        holder.kill('SIGKILL')
        await waitForExit(holder)
        await waitForFreePort(port)
      })

      it('names the spawned holder rather than the caller', () => {
        const occupancy = checkPortIsFree(port)

        expect(occupancy.free).toBe(false)
        expect(occupancy.pid).toBe(holder.pid)
        expect(occupancy.cwd).toBeTruthy()
      })

      it('never reports free for a port that has a listener, however often it is asked', () => {
        const probes = [checkPortIsFree(port), checkPortIsFree(port), checkPortIsFree(port)]

        expect(probes.map((probe) => probe.free)).toEqual([false, false, false])
      })
    })

    describe('a port whose listener goes away', () => {
      it('stops reporting the port held once the holder is gone', async () => {
        const port = await reserveAnUnusedPort()
        const holder = spawnNode(['-e', listenerSource(port)])
        await waitForListener(port)

        expect(checkPortIsFree(port).free).toBe(false)

        holder.kill('SIGKILL')
        await waitForExit(holder)
        await waitForFreePort(port)

        expect(checkPortIsFree(port)).toEqual({ free: true })
      }, 30000)
    })

    describe('a port number that is not a TCP port', () => {
      const refusedPorts = [
        { label: 'zero', port: 0 },
        { label: 'a negative number', port: -1 },
        { label: 'above the maximum', port: 65536 },
        { label: 'a fractional port', port: 3111.5 },
        { label: 'a string', port: '3111' },
        { label: 'undefined', port: undefined },
      ]

      it.each(refusedPorts)('throws for $label', ({ port }) => {
        expect(() => checkPortIsFree(port as unknown as number)).toThrow(/is not a TCP port/)
      })
    })
  })

  describe('assertServerIsOurs', () => {
    describe('a server this run started', () => {
      let holder: ChildProcess
      let port: number

      beforeAll(async () => {
        port = await reserveAnUnusedPort()
        holder = spawnNode(['-e', listenerSource(port)])
        await waitForListener(port)
      })

      afterAll(async () => {
        holder.kill('SIGKILL')
        await waitForExit(holder)
        await waitForFreePort(port)
      })

      it('accepts the exact pid that holds the port', () => {
        expect(() => assertServerIsOurs(port, holder.pid as number)).not.toThrow()
      })
    })

    describe('a server that forked, so the listener is a child of the started pid', () => {
      let parent: ChildProcess
      let port: number

      beforeAll(async () => {
        port = await reserveAnUnusedPort()
        parent = spawnNode(['-e', parentOfListenerSource(port)], { detached: true })
        await waitForListener(port)
      })

      afterAll(async () => {
        if (parent.pid !== undefined) {
          try {
            process.kill(-parent.pid, 'SIGKILL')
          } catch {}
        }
        await waitForExit(parent)
        await waitForFreePort(port)
      })

      it('accepts the ancestor pid rather than demanding the exact listener pid', () => {
        expect(checkPortIsFree(port).pid).not.toBe(parent.pid)
        expect(() => assertServerIsOurs(port, parent.pid as number)).not.toThrow()
      })
    })

    describe('a server belonging to somebody else', () => {
      let foreignParent: ChildProcess
      let unrelatedPid: number
      let port: number
      let foreignHolderPid: number

      beforeAll(async () => {
        port = await reserveAnUnusedPort()
        foreignParent = spawnNode(['-e', parentOfListenerSource(port)], { detached: true })
        const unrelated = spawnNode(['-e', 'setInterval(()=>{},1000)'])
        await waitForListener(port)
        await new Promise((resolve) => setTimeout(resolve, 100))
        unrelatedPid = unrelated.pid as number
        foreignHolderPid = checkPortIsFree(port).pid as number
      }, 30000)

      afterAll(async () => {
        if (foreignParent.pid !== undefined) {
          try {
            process.kill(-foreignParent.pid, 'SIGKILL')
          } catch {}
        }
        await waitForExit(foreignParent)
        await waitForFreePort(port)
      })

      it('throws, naming the foreign pid', () => {
        expect(foreignHolderPid).not.toBe(unrelatedPid)

        expect(() => assertServerIsOurs(port, unrelatedPid)).toThrow(String(foreignHolderPid))
      })

      it('names the foreign working directory and refuses pid 1 as an owner', () => {
        expect(() => assertServerIsOurs(port, 1)).toThrow(/working directory/)
      })
    })

    describe('a port with nothing serving on it', () => {
      it('throws, because an unproven server is not ours', async () => {
        const port = await reserveAnUnusedPort()

        expect(() => assertServerIsOurs(port, process.pid)).toThrow(
          `Nothing is listening on port ${port}`,
        )
      })
    })

    describe('arguments that are not a port and a pid', () => {
      const refusedArguments = [
        { label: 'a port of zero', port: 0, pid: 1 },
        { label: 'a port above the maximum', port: 70000, pid: 1 },
        { label: 'a pid of zero', port: 3111, pid: 0 },
        { label: 'a negative pid', port: 3111, pid: -7 },
        { label: 'a fractional pid', port: 3111, pid: 12.5 },
        { label: 'a string pid', port: 3111, pid: '12' },
      ]

      it.each(refusedArguments)('throws for $label', ({ port, pid }) => {
        expect(() => assertServerIsOurs(port as unknown as number, pid as unknown as number)).toThrow(
          /is not a TCP port|is not a process id/,
        )
      })
    })
  })

  describe('the CLI', () => {
    it('is invoked from the module under test', () => {
      expect(fs.existsSync(MODULE_PATH)).toBe(true)
    })

    describe('port', () => {
      it('prints only 3111 for a main checkout', () => {
        const result = runCli(['port', MAIN_CHECKOUT])

        expect(result.status).toBe(0)
        expect(result.stdout).toBe(`${MAIN_CHECKOUT_PORT}\n`)
        expect(result.stderr).toBe('')
      })

      it('prints only an in-band integer for a worktree checkout', () => {
        const result = runCli(['port', WORKTREE_HARNESS_TRUST])

        expect(result.status).toBe(0)
        expect(result.stderr).toBe('')
        expect(result.stdout).toMatch(/^\d+\n$/)
        expect(isBandPort(Number(result.stdout))).toBe(true)
      })

      it('agrees with the exported function for the same checkout root', () => {
        const result = runCli(['port', WORKTREE_COUNTED_SET_DOMAIN])

        expect(result.stdout).toBe(`${deriveE2ePort(WORKTREE_COUNTED_SET_DOMAIN)}\n`)
      })

      const refusedInvocations = [
        { label: 'no checkout root', args: ['port'] },
        { label: 'two checkout roots', args: ['port', MAIN_CHECKOUT, WORKTREE_HARNESS_TRUST] },
        { label: 'no subcommand at all', args: [] },
      ]

      it.each(refusedInvocations)('exits non-zero with usage on stderr for $label', ({ args }) => {
        const result = runCli(args)

        expect(result.status).not.toBe(0)
        expect(result.stdout).toBe('')
        expect(result.stderr).toContain('Usage:')
      })
    })

    describe('guard', () => {
      describe('against a free port', () => {
        it('exits zero and prints nothing', async () => {
          const port = await reserveAnUnusedPort()

          const result = runCli(['guard', String(port), String(process.pid)])

          expect(result.status).toBe(0)
          expect(result.stdout).toBe('')
          expect(result.stderr).toBe('')
        })
      })

      describe('against a port held by a descendant of the given pid', () => {
        let parent: ChildProcess
        let port: number

        beforeAll(async () => {
          port = await reserveAnUnusedPort()
          parent = spawnNode(['-e', parentOfListenerSource(port)], { detached: true })
          await waitForListener(port)
        }, 30000)

        afterAll(async () => {
          if (parent.pid !== undefined) {
            try {
              process.kill(-parent.pid, 'SIGKILL')
            } catch {}
          }
          await waitForExit(parent)
          await waitForFreePort(port)
        })

        it('exits zero', () => {
          const result = runCli(['guard', String(port), String(parent.pid)])

          expect(result.status).toBe(0)
          expect(result.stdout).toBe('')
          expect(result.stderr).toBe('')
        })
      })

      describe('against a port held by a foreign server', () => {
        let foreignParent: ChildProcess
        let unrelatedPid: number
        let port: number
        let foreignHolderPid: number

        beforeAll(async () => {
          port = await reserveAnUnusedPort()
          foreignParent = spawnNode(['-e', parentOfListenerSource(port)], { detached: true })
          const unrelated = spawnNode(['-e', 'setInterval(()=>{},1000)'])
          await waitForListener(port)
          await new Promise((resolve) => setTimeout(resolve, 100))
          unrelatedPid = unrelated.pid as number
          foreignHolderPid = checkPortIsFree(port).pid as number
        }, 30000)

        afterAll(async () => {
          if (foreignParent.pid !== undefined) {
            try {
              process.kill(-foreignParent.pid, 'SIGKILL')
            } catch {}
          }
          await waitForExit(foreignParent)
          await waitForFreePort(port)
        })

        it('exits non-zero with stderr naming the foreign pid and nothing on stdout', () => {
          const result = runCli(['guard', String(port), String(unrelatedPid)])

          expect(result.status).not.toBe(0)
          expect(result.stdout).toBe('')
          expect(result.stderr).toContain(String(foreignHolderPid))
          expect(result.stderr).toContain('working directory')
        })
      })

      const refusedGuards = [
        { label: 'no arguments', args: ['guard'] },
        { label: 'only a port', args: ['guard', '3111'] },
        { label: 'a non-integer port', args: ['guard', 'not-a-port', '123'] },
        { label: 'a non-integer pid', args: ['guard', '3111', 'not-a-pid'] },
      ]

      it.each(refusedGuards)('exits non-zero with usage on stderr for $label', ({ args }) => {
        const result = runCli(args)

        expect(result.status).not.toBe(0)
        expect(result.stdout).toBe('')
        expect(result.stderr).toContain('Usage:')
      })
    })

    describe('an unknown subcommand', () => {
      it('exits non-zero with the offending name and the usage on stderr', () => {
        const result = runCli(['nonsense-subcommand'])

        expect(result.status).not.toBe(0)
        expect(result.stdout).toBe('')
        expect(result.stderr).toContain('Unknown subcommand "nonsense-subcommand".')
        expect(result.stderr).toContain('Usage:')
      })
    })

    describe('importing the module', () => {
      it('runs no CLI: stdout carries only what the importer wrote', () => {
        const probe = `import(${JSON.stringify(MODULE_PATH)}).then(() => process.stdout.write('IMPORTED'))`
        const result = spawnSync(process.execPath, ['-e', probe], { encoding: 'utf8' })

        expect(result.status).toBe(0)
        expect(result.stdout).toBe('IMPORTED')
        expect(result.stderr).toBe('')
      })
    })
  })
})

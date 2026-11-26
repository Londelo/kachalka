import { describe, it, expect } from 'vitest'
import os from 'os'
import path from 'path'
import { AppError } from '@/shared/errors/app-error'
import {
  resolveTestDatabasePath,
  TEST_DATABASE_FILENAME,
  DEVELOPER_DATABASE_FILENAME,
} from '../../harness/test-database-path'

const CHECKOUT = '/home/dev/webs/kachalka'
const TEST_DATABASE = '/home/dev/webs/kachalka/data/kachalka.test.db'
const TEMP_DIRECTORY = path.resolve(os.tmpdir())

type Options = { checkoutRoot: string; envDatabasePath?: string }

describe('resolveTestDatabasePath', () => {
  describe('module contract', () => {
    it('names the unit-run database filename', () => {
      expect(TEST_DATABASE_FILENAME).toBe('kachalka.test.db')
    })

    it('names the developer database filename', () => {
      expect(DEVELOPER_DATABASE_FILENAME).toBe('kachalka.db')
    })
  })

  describe('unset, empty and whitespace-only envDatabasePath select the test database', () => {
    const cases: Array<{ label: string; options: Options }> = [
      { label: 'the key is absent', options: { checkoutRoot: CHECKOUT } },
      { label: 'the key is undefined', options: { checkoutRoot: CHECKOUT, envDatabasePath: undefined } },
      { label: 'the value is an empty string', options: { checkoutRoot: CHECKOUT, envDatabasePath: '' } },
      { label: 'the value is spaces', options: { checkoutRoot: CHECKOUT, envDatabasePath: '   ' } },
      { label: 'the value is tabs and newlines', options: { checkoutRoot: CHECKOUT, envDatabasePath: ' \t\n ' } },
      { label: 'checkoutRoot carries a trailing separator', options: { checkoutRoot: `${CHECKOUT}/` } },
      {
        label: 'checkoutRoot carries a trailing separator and the value is blank',
        options: { checkoutRoot: `${CHECKOUT}/`, envDatabasePath: '  ' },
      },
    ]

    it.each(cases)('returns the test database when $label', ({ options }) => {
      expect(resolveTestDatabasePath(options)).toBe(TEST_DATABASE)
    })

    it('never doubles the separator when checkoutRoot ends in one', () => {
      const result = resolveTestDatabasePath({ checkoutRoot: `${CHECKOUT}//` })

      expect(result).toBe(TEST_DATABASE)
      expect(result).not.toContain('//')
    })
  })

  describe('an explicit value inside the checkout is honoured', () => {
    const cases: Array<{ label: string; envDatabasePath: string; expected: string }> = [
      {
        label: 'absolute path in the checkout data directory',
        envDatabasePath: `${CHECKOUT}/data/other.db`,
        expected: '/home/dev/webs/kachalka/data/other.db',
      },
      {
        label: 'relative path resolved against the checkout root',
        envDatabasePath: 'data/other.db',
        expected: '/home/dev/webs/kachalka/data/other.db',
      },
      {
        label: 'dot-slash relative path',
        envDatabasePath: './data/other.db',
        expected: '/home/dev/webs/kachalka/data/other.db',
      },
      {
        label: 'the test database named explicitly',
        envDatabasePath: `${CHECKOUT}/data/kachalka.test.db`,
        expected: '/home/dev/webs/kachalka/data/kachalka.test.db',
      },
      {
        label: 'a path that walks out and back in',
        envDatabasePath: `${CHECKOUT}/data/../data/other.db`,
        expected: '/home/dev/webs/kachalka/data/other.db',
      },
    ]

    it.each(cases)('returns the resolved path for $label', ({ envDatabasePath, expected }) => {
      expect(resolveTestDatabasePath({ checkoutRoot: CHECKOUT, envDatabasePath })).toBe(expected)
    })
  })

  describe('an explicit value under the OS temporary directory is honoured', () => {
    it('returns a temp path unchanged', () => {
      const envDatabasePath = path.join(TEMP_DIRECTORY, 'kachalka-unit.db')

      expect(resolveTestDatabasePath({ checkoutRoot: CHECKOUT, envDatabasePath })).toBe(envDatabasePath)
    })

    it('returns a nested temp path unchanged', () => {
      const envDatabasePath = path.join(TEMP_DIRECTORY, 'kachalka', 'nested', 'unit.db')

      expect(resolveTestDatabasePath({ checkoutRoot: CHECKOUT, envDatabasePath })).toBe(envDatabasePath)
    })
  })

  describe('a value outside both allowed roots throws', () => {
    const cases: Array<{ label: string; envDatabasePath: string; rejected: string }> = [
      {
        label: 'another person checkout',
        envDatabasePath: '/home/otherperson/webs/kachalka/data/kachalka.db',
        rejected: '/home/otherperson/webs/kachalka/data/kachalka.db',
      },
      {
        label: 'a system directory',
        envDatabasePath: '/etc/kachalka.db',
        rejected: '/etc/kachalka.db',
      },
      {
        label: 'a relative path that escapes the checkout',
        envDatabasePath: '../outside.db',
        rejected: '/home/dev/webs/outside.db',
      },
      {
        label: 'a sibling checkout of the same name',
        envDatabasePath: '/home/dev/webs/other-project/data/kachalka.test.db',
        rejected: '/home/dev/webs/other-project/data/kachalka.test.db',
      },
    ]

    it.each(cases)('throws AppError naming the rejected path for $label', ({ envDatabasePath, rejected }) => {
      const call = () => resolveTestDatabasePath({ checkoutRoot: CHECKOUT, envDatabasePath })

      expect(call).toThrow(AppError)
      expect(call).toThrow(rejected)
      expect(call).toThrow(/not owned by this checkout/)
    })

    it('names both allowed roots in the rejection', () => {
      expect(() => resolveTestDatabasePath({ checkoutRoot: CHECKOUT, envDatabasePath: '/etc/kachalka.db' })).toThrow(
        /"\S+" or the temporary directory/,
      )
    })
  })

  describe('the developer database is refused even inside the checkout', () => {
    const cases: Array<{ label: string; envDatabasePath: string }> = [
      { label: 'absolute', envDatabasePath: `${CHECKOUT}/data/kachalka.db` },
      { label: 'relative', envDatabasePath: 'data/kachalka.db' },
      { label: 'dot-slash relative', envDatabasePath: './data/kachalka.db' },
      { label: 'surrounded by whitespace', envDatabasePath: `  ${CHECKOUT}/data/kachalka.db  ` },
      { label: 'normalised through a detour', envDatabasePath: `${CHECKOUT}/data/../data/kachalka.db` },
      { label: 'checkoutRoot carries a trailing separator', envDatabasePath: `${CHECKOUT}/data/kachalka.db` },
    ]

    it.each(cases)('throws AppError for the developer database given $label', ({ envDatabasePath }) => {
      const call = () => resolveTestDatabasePath({ checkoutRoot: CHECKOUT, envDatabasePath })

      expect(call).toThrow(AppError)
      expect(call).toThrow(/developer database/)
      expect(call).toThrow(/kachalka\.db/)
    })

    it('names the test database filename as the thing to use instead', () => {
      expect(() =>
        resolveTestDatabasePath({ checkoutRoot: CHECKOUT, envDatabasePath: `${CHECKOUT}/data/kachalka.db` }),
      ).toThrow(/kachalka\.test\.db/)
    })

    it('refuses the developer database before containment can accept it', () => {
      const insideTheCheckout = `${CHECKOUT}/data/kachalka.db`

      expect(() => resolveTestDatabasePath({ checkoutRoot: CHECKOUT, envDatabasePath: insideTheCheckout })).toThrow(
        AppError,
      )
    })

    it('still refuses it when checkoutRoot is given with a trailing separator', () => {
      expect(() =>
        resolveTestDatabasePath({ checkoutRoot: `${CHECKOUT}/`, envDatabasePath: 'data/kachalka.db' }),
      ).toThrow(/developer database/)
    })
  })

  describe('containment compares path segments, not string prefixes', () => {
    it('refuses a sibling directory whose name extends the data directory name', () => {
      const call = () =>
        resolveTestDatabasePath({ checkoutRoot: CHECKOUT, envDatabasePath: `${CHECKOUT}/data-evil/kachalka.db` })

      expect(call).toThrow(AppError)
    })

    it('refuses a sibling directory of the checkout itself', () => {
      const call = () =>
        resolveTestDatabasePath({ checkoutRoot: CHECKOUT, envDatabasePath: '/home/dev/webs/kachalka-evil/data/x.db' })

      expect(call).toThrow(AppError)
    })
  })

  describe('shape of every accepted answer', () => {
    const acceptedInputs: Array<{ label: string; options: Options }> = [
      { label: 'unset', options: { checkoutRoot: CHECKOUT } },
      { label: 'blank', options: { checkoutRoot: CHECKOUT, envDatabasePath: '   ' } },
      { label: 'absolute inside the checkout', options: { checkoutRoot: CHECKOUT, envDatabasePath: `${CHECKOUT}/data/other.db` } },
      { label: 'relative inside the checkout', options: { checkoutRoot: CHECKOUT, envDatabasePath: 'data/other.db' } },
      { label: 'under the temp directory', options: { checkoutRoot: CHECKOUT, envDatabasePath: path.join(TEMP_DIRECTORY, 'kachalka-unit.db') } },
      { label: 'a checkout root given with a trailing separator', options: { checkoutRoot: `${CHECKOUT}/` } },
    ]

    it.each(acceptedInputs)('$label is absolute', ({ options }) => {
      expect(path.isAbsolute(resolveTestDatabasePath(options))).toBe(true)
    })

    it.each(acceptedInputs)('$label has no trailing separator', ({ options }) => {
      expect(resolveTestDatabasePath(options).endsWith(path.sep)).toBe(false)
    })

    it('returns the identical string for the same input twice', () => {
      const options: Options = { checkoutRoot: CHECKOUT, envDatabasePath: 'data/other.db' }

      expect(resolveTestDatabasePath(options)).toBe(resolveTestDatabasePath(options))
    })

    it('returns the identical string for the same unset input twice', () => {
      const options: Options = { checkoutRoot: CHECKOUT }

      expect(resolveTestDatabasePath(options)).toBe(resolveTestDatabasePath(options))
    })

    it('does not mutate the options object it is handed', () => {
      const options: Options = { checkoutRoot: CHECKOUT, envDatabasePath: '  data/other.db  ' }

      resolveTestDatabasePath(options)

      expect(options).toEqual({ checkoutRoot: CHECKOUT, envDatabasePath: '  data/other.db  ' })
    })
  })
})

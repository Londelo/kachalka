import { describe, it, expect } from 'vitest'
import { parseUserIdCookieValue } from '@/features/user/parse-user-id-cookie'

const MAX_SAFE = String(Number.MAX_SAFE_INTEGER)
const ABOVE_MAX_SAFE = String(Number.MAX_SAFE_INTEGER + 2)

const validCases = [
  { name: 'a single digit', input: '1', expected: 1 },
  { name: 'a multi-digit id', input: '42', expected: 42 },
  { name: 'surrounding spaces', input: ' 3 ', expected: 3 },
  { name: 'tabs and newlines around the digits', input: '\t 12 \n', expected: 12 },
  { name: 'leading zeros', input: '007', expected: 7 },
  { name: 'the maximum safe integer', input: MAX_SAFE, expected: Number.MAX_SAFE_INTEGER },
]

const invalidCases = [
  { name: 'undefined', input: undefined },
  { name: 'null at runtime', input: null },
  { name: 'an empty string', input: '' },
  { name: 'a whitespace-only string', input: '   ' },
  { name: 'zero', input: '0' },
  { name: 'a negative id', input: '-1' },
  { name: 'an explicitly positive id', input: '+1' },
  { name: 'a decimal', input: '1.5' },
  { name: 'exponent notation', input: '1e3' },
  { name: 'hexadecimal notation', input: '0x1f' },
  { name: 'the literal NaN', input: 'NaN' },
  { name: 'the literal Infinity', input: 'Infinity' },
  { name: 'letters only', input: 'abc' },
  { name: 'digits followed by letters', input: '12abc' },
  { name: 'the literal null', input: 'null' },
  { name: 'the literal true', input: 'true' },
  { name: 'an interior space', input: '1 2' },
  { name: 'a value above the maximum safe integer', input: ABOVE_MAX_SAFE },
  { name: 'a far too large digit run', input: '99999999999999999999999' },
]

const naiveCoercionTrapCases = [
  { name: 'empty string, which Number() calls 0', input: '', naive: 0 },
  { name: 'whitespace only, which Number() calls 0', input: '   ', naive: 0 },
  { name: 'leading sign, which Number() accepts', input: '+1', naive: 1 },
  { name: 'negative sign, which Number() accepts', input: '-1', naive: -1 },
  { name: 'exponent, which Number() calls 1000', input: '1e3', naive: 1000 },
  { name: 'hex, which Number() calls 31', input: '0x1f', naive: 31 },
  { name: 'Infinity, which Number() accepts', input: 'Infinity', naive: Infinity },
  { name: 'trailing letters, which parseInt() calls 12', input: '12abc', naive: 12 },
  { name: 'non-ASCII digits, which Number() calls 123', input: '١٢٣', naive: 123 },
]

const everyInput: unknown[] = [
  ...validCases.map((c) => c.input),
  ...invalidCases.map((c) => c.input),
  ...naiveCoercionTrapCases.map((c) => c.input),
  '00',
  '000',
  ' 0 ',
  42,
  0,
  -5,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  true,
  false,
  {},
  [],
  [1],
  ['1'],
  () => '1',
  Symbol('1'),
  new Date(0),
  new Error('1'),
]

describe('parseUserIdCookieValue', () => {
  describe('a value that names a commander', () => {
    it.each(validCases)('returns $expected for $name', ({ input, expected }) => {
      expect(parseUserIdCookieValue(input as string)).toBe(expected)
    })

    it('returns the maximum safe integer itself, still a safe integer', () => {
      const result = parseUserIdCookieValue(MAX_SAFE)

      expect(result).toBe(9007199254740991)
      expect(Number.isSafeInteger(result)).toBe(true)
    })

    it('parses a digit run of leading zeros to the number it names', () => {
      expect(parseUserIdCookieValue('007')).toBe(7)
      expect(parseUserIdCookieValue('0001')).toBe(1)
    })

    it('trims surrounding whitespace before deciding, in both directions', () => {
      expect(parseUserIdCookieValue(' 3 ')).toBe(3)
      expect(parseUserIdCookieValue('   ')).toBeNull()
    })
  })

  describe('a value that cannot name a commander', () => {
    it.each(invalidCases)('returns null for $name', ({ input }) => {
      expect(parseUserIdCookieValue(input as string | undefined)).toBeNull()
    })

    it('returns null for every zero-valued digit run, comparing the number not the text', () => {
      expect(parseUserIdCookieValue('0')).toBeNull()
      expect(parseUserIdCookieValue('00')).toBeNull()
      expect(parseUserIdCookieValue('000')).toBeNull()
      expect(parseUserIdCookieValue(' 0 ')).toBeNull()
    })

    it('returns null for the first value above the maximum safe integer', () => {
      expect(parseUserIdCookieValue(ABOVE_MAX_SAFE)).toBeNull()
    })

    it('rejects a digit run with a trailing non-digit rather than truncating it', () => {
      const result = parseUserIdCookieValue('12abc')

      expect(result).toBeNull()
      expect(result).not.toBe(12)
    })

    it.each(naiveCoercionTrapCases)(
      'does not leak through a naive coercion for $name',
      ({ input, naive }) => {
        const result = parseUserIdCookieValue(input as string)

        expect(result).toBeNull()
        expect(result).not.toBe(naive)
      },
    )
  })

  describe('the never-throws guarantee', () => {
    it.each(everyInput.map((input) => ({ name: describeInput(input), input })))(
      'completes without throwing for $name',
      ({ input }) => {
        expect(() => parseUserIdCookieValue(input as string | undefined)).not.toThrow()
      },
    )

    it.each(everyInput.map((input) => ({ name: describeInput(input), input })))(
      'answers only null or a positive safe integer for $name',
      ({ input }) => {
        const result = parseUserIdCookieValue(input as string | undefined)

        expect(result === null || (Number.isSafeInteger(result) && (result as number) > 0)).toBe(
          true,
        )
      },
    )

    it('returns null, never undefined or NaN, for a runtime null and for a non-string', () => {
      const fromNull = parseUserIdCookieValue(null as unknown as string | undefined)
      const fromObject = parseUserIdCookieValue({ id: 1 } as unknown as string | undefined)
      const fromNumber = parseUserIdCookieValue(42 as unknown as string | undefined)

      for (const result of [fromNull, fromObject, fromNumber]) {
        expect(result).not.toBeUndefined()
        expect(result).not.toBeNaN()
        expect(result).toBeNull()
      }
    })
  })
})

function describeInput(input: unknown): string {
  if (input === undefined) return 'undefined'
  if (input === null) return 'null'
  if (typeof input === 'string') return `the string '${input.replace(/\s/g, ' ')}'`
  if (typeof input === 'symbol') return 'a symbol'
  if (typeof input === 'function') return 'a function'
  if (Array.isArray(input)) return 'an array'
  if (typeof input === 'object') return `an instance of ${input.constructor.name}`
  return `the ${typeof input} ${String(input)}`
}

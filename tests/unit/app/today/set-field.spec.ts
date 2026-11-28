import { describe, it, expect } from 'vitest'
import { parseSetField } from '@/app/today/set-field'

const BLANK_INPUTS = ['', '   ', '\t\n', ' \t \n ', '\u00a0']

const VALUE_CASES: Array<[string, number]> = [
  ['0', 0],
  ['00', 0],
  ['-0', 0],
  ['007', 7],
  ['5', 5],
  ['  12  ', 12],
  ['135.5', 135.5],
  ['3.7', 3.7],
  ['-5', -5],
  ['.5', 0.5],
  ['5.', 5],
]

const INVALID_INPUTS = [
  'heavy',
  'abc',
  '1 2',
  '1.2.3',
  '-',
  '+',
  '.',
  '1e',
  '1e3',
  '2E5',
  '0x10',
  'Infinity',
  '-Infinity',
  'NaN',
  '٣',
]

const EVERY_INPUT = [
  ...BLANK_INPUTS,
  ...VALUE_CASES.map(([raw]) => raw),
  ...INVALID_INPUTS,
  '  heavy  ',
]

describe('parseSetField', () => {
  describe('blank', () => {
    it.each(BLANK_INPUTS)('classifies %s as blank', (raw) => {
      expect(parseSetField(raw)).toEqual({ kind: 'blank' })
    })

    it('classifies a non-breaking space as blank, so trimming is not space-only', () => {
      expect(parseSetField('\u00a0')).toEqual({ kind: 'blank' })
    })
  })

  describe('value', () => {
    it.each(VALUE_CASES)('reads %s as the number %s', (raw, expected) => {
      expect(parseSetField(raw)).toEqual({ kind: 'value', value: expected })
    })

    it('reads a real zero as a value, never as blank', () => {
      expect(parseSetField('0')).not.toEqual({ kind: 'blank' })
      expect(parseSetField('0')).toEqual({ kind: 'value', value: 0 })
    })

    it('returns positive zero, never negative zero, for a signed zero literal', () => {
      const result = parseSetField('-0')
      expect(result.kind).toBe('value')
      if (result.kind === 'value') {
        expect(Object.is(result.value, 0)).toBe(true)
        expect(Object.is(result.value, -0)).toBe(false)
      }
    })
  })

  describe('invalid', () => {
    it.each(INVALID_INPUTS)('classifies %s as invalid and keeps its text', (raw) => {
      expect(parseSetField(raw)).toEqual({ kind: 'invalid', raw })
    })

    it('does not collapse junk to zero, the collapse the old field made', () => {
      expect(parseSetField('heavy')).not.toEqual({ kind: 'value', value: 0 })
      expect(parseSetField('heavy')).toEqual({ kind: 'invalid', raw: 'heavy' })
    })
  })

  describe('raw preservation', () => {
    it('hands back the original untrimmed text so the screen can show what was typed', () => {
      expect(parseSetField('  heavy  ')).toEqual({ kind: 'invalid', raw: '  heavy  ' })
    })

    it('does not trim tabs and newlines out of the raw it reports', () => {
      const result = parseSetField('\t-Infinity\n')
      expect(result.kind).toBe('invalid')
      if (result.kind === 'invalid') {
        expect(result.raw).toBe('\t-Infinity\n')
      }
    })
  })

  describe('return shape', () => {
    it.each(EVERY_INPUT)('returns a well-formed result for %s', (raw) => {
      expect(() => parseSetField(raw)).not.toThrow()

      const result = parseSetField(raw)
      expect(result).not.toBeNull()
      expect(typeof result).toBe('object')
      expect(['blank', 'value', 'invalid']).toContain(result.kind)

      if (result.kind === 'value') {
        expect(Number.isNaN(result.value)).toBe(false)
        expect(Number.isFinite(result.value)).toBe(true)
      }
    })
  })
})

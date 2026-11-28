export type ParsedSetField =
  | { kind: 'blank' }
  | { kind: 'value'; value: number }
  | { kind: 'invalid'; raw: string }

const PLAIN_DECIMAL = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/

export function parseSetField(raw: string): ParsedSetField {
  const trimmed = raw.trim()

  if (trimmed === '') {
    return { kind: 'blank' }
  }

  if (!PLAIN_DECIMAL.test(trimmed)) {
    return { kind: 'invalid', raw }
  }

  const parsed = Number(trimmed)
  return { kind: 'value', value: parsed === 0 ? 0 : parsed }
}

import * as R from 'ramda'

export const UserId = Object.freeze({
  make(n: number): { value: number } {
    if (
      typeof n !== 'number' ||
      !Number.isInteger(n) ||
      n < 0
    ) {
      throw new Error(`UserId must be a non-negative integer, got: ${n}`)
    }
    return { value: n }
  },
})

export function createUser(name: string): { id: { value: number }; name: string } {
  const trimmed = name.trim()

  if (trimmed.length === 0) {
    throw new Error('Name cannot be empty')
  }

  if (trimmed.length > 100) {
    throw new Error('Name too long')
  }

  return {
    id: { value: 0 },
    name: trimmed,
  }
}

export type User = { id: { value: number }; name: string }

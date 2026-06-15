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

export function validateEmail(email: string): string {
  if (typeof email !== 'string') {
    throw new Error('Email must be a string')
  }

  const trimmed = email.trim()

  if (trimmed.length === 0) {
    throw new Error('Email cannot be empty')
  }

  if (trimmed.length > 254) {
    throw new Error('Email too long')
  }

  return trimmed
}

export function createUser(name: string, email: string): { id: { value: number }; name: string; email: string } {
  const trimmedName = name.trim()

  if (trimmedName.length === 0) {
    throw new Error('Name cannot be empty')
  }

  if (trimmedName.length > 100) {
    throw new Error('Name too long')
  }

  const trimmedEmail = validateEmail(email)

  return {
    id: { value: 0 },
    name: trimmedName,
    email: trimmedEmail,
  }
}

export type User = { id: { value: number }; name: string; email: string }

export function parseUserIdCookieValue(raw: string | undefined): number | null {
  if (raw === undefined || raw === null) {
    return null
  }

  if (typeof raw !== 'string') {
    return null
  }

  if (raw === '') {
    return null
  }

  const trimmed = raw.trim()

  if (trimmed === '') {
    return null
  }

  if (!/^[0-9]+$/.test(trimmed)) {
    return null
  }

  const id = Number(trimmed)

  if (id === 0) {
    return null
  }

  if (id > Number.MAX_SAFE_INTEGER) {
    return null
  }

  return id
}

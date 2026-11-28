export type UnidentifiedReason = 'no-selection' | 'not-found'

export type CommanderIdentity =
  | { status: 'identified'; userId: number; name: string }
  | { status: 'unidentified'; reason: UnidentifiedReason }

export function identified(userId: number, name: string): CommanderIdentity {
  if (typeof userId !== 'number' || !Number.isInteger(userId) || userId < 1) {
    throw new Error(`CommanderIdentity userId must be a positive integer, got: ${userId}`)
  }

  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('CommanderIdentity name must be a non-empty string')
  }

  return Object.freeze({ status: 'identified', userId, name })
}

export function unidentified(reason: UnidentifiedReason): CommanderIdentity {
  return Object.freeze({ status: 'unidentified', reason })
}

export function isIdentified(
  identity: CommanderIdentity,
): identity is { status: 'identified'; userId: number; name: string } {
  return identity.status === 'identified'
}

export function isUnidentified(
  identity: CommanderIdentity,
): identity is { status: 'unidentified'; reason: UnidentifiedReason } {
  return identity.status === 'unidentified'
}

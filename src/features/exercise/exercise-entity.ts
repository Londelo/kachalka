export const ExerciseId = Object.freeze({
  make(n: number): { value: number } {
    if (
      typeof n !== 'number' ||
      !Number.isInteger(n) ||
      n < 0
    ) {
      throw new Error(`ExerciseId must be a non-negative integer, got: ${n}`)
    }
    return { value: n }
  },
})

export function createExercise(name: string, ownerId: number): { id: { value: number }; name: string; ownerId: { value: number } } {
  const trimmed = name.trim()

  if (trimmed.length === 0) {
    throw new Error('Exercise name cannot be empty')
  }

  if (trimmed.length > 100) {
    throw new Error('Exercise name too long')
  }

  return {
    id: { value: 0 },
    name: trimmed,
    ownerId: ExerciseId.make(ownerId),
  }
}

export type Exercise = { id: { value: number }; name: string; ownerId: { value: number } }

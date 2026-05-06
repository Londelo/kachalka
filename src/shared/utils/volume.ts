export function calculateVolume(sets: { reps: number; weight: number }[]): number {
  for (const set of sets) {
    if (set.reps < 0 || set.weight < 0) {
      throw new Error('Volume calculation rejected negative input')
    }
  }
  return sets.reduce((total, set) => total + set.reps * set.weight, 0)
}

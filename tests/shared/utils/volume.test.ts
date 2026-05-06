import { describe, it, expect } from 'vitest'
import { calculateVolume } from '@/shared/utils/volume'

describe('calculateVolume', () => {
  describe('basic calculations', () => {
    it('calculates volume for a single set', () => {
      const sets = [{ reps: 5, weight: 135 }]
      const result = calculateVolume(sets)

      expect(result).toBe(675) // 5 * 135
    })

    it('calculates volume for multiple sets', () => {
      const sets = [
        { reps: 5, weight: 135 },
        { reps: 5, weight: 145 },
        { reps: 5, weight: 155 },
      ]
      const result = calculateVolume(sets)

      // (5*135) + (5*145) + (5*155) = 675 + 725 + 775 = 2175
      expect(result).toBe(2175)
    })

    it('returns 0 for empty sets array', () => {
      const result = calculateVolume([])

      expect(result).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('handles zero reps', () => {
      const sets = [{ reps: 0, weight: 135 }]
      const result = calculateVolume(sets)

      expect(result).toBe(0)
    })

    it('handles zero weight', () => {
      const sets = [{ reps: 5, weight: 0 }]
      const result = calculateVolume(sets)

      expect(result).toBe(0)
    })

    it('handles single rep sets', () => {
      const sets = [{ reps: 1, weight: 315 }]
      const result = calculateVolume(sets)

      expect(result).toBe(315)
    })

    it('handles high rep sets', () => {
      const sets = [{ reps: 15, weight: 135 }]
      const result = calculateVolume(sets)

      expect(result).toBe(2025) // 15 * 135
    })
  })

  describe('complex scenarios', () => {
    it('calculates volume for a full warmup + working set progression', () => {
      const sets = [
        { reps: 5, weight: 95 },   // warmup
        { reps: 5, weight: 115 },   // warmup
        { reps: 5, weight: 135 },   // working
        { reps: 5, weight: 145 },   // working
        { reps: 5, weight: 155 },   // working
      ]
      const result = calculateVolume(sets)

      // (5*95) + (5*115) + (5*135) + (5*145) + (5*155)
      // = 475 + 575 + 675 + 725 + 775 = 3225
      expect(result).toBe(3225)
    })

    it('calculates volume for mixed rep schemes', () => {
      const sets = [
        { reps: 10, weight: 65 },   // high rep
        { reps: 8, weight: 85 },    // moderate
        { reps: 5, weight: 105 },   // low rep heavy
      ]
      const result = calculateVolume(sets)

      // (10*65) + (8*85) + (5*105) = 650 + 680 + 525 = 1855
      expect(result).toBe(1855)
    })
  })
})

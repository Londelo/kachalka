import { describe, it, expect, vi } from 'vitest'
import { getCurrentCommanderUseCase } from '@/features/user/get-current-commander'
import {
  identified,
  unidentified,
  isIdentified,
  isUnidentified,
} from '@/features/user/commander-identity'
import type { UserRepository } from '@/features/user/user-repository'
import type { User } from '@/features/user/user-entity'

type MockRepo = {
  findById: ReturnType<typeof vi.fn>
  findByName: ReturnType<typeof vi.fn>
  findAll: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

function makeRepo(findById: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue(undefined)): MockRepo {
  return {
    findById,
    findByName: vi.fn().mockReturnValue(undefined),
    findAll: vi.fn().mockReturnValue([]),
    create: vi.fn().mockReturnValue({ id: { value: 1 }, name: 'Test' }),
    delete: vi.fn(),
  } satisfies UserRepository
}

function user(id: number, name: string): User {
  return { id: { value: id }, name }
}

function tryMutate(target: object, key: string, value: unknown): void {
  try {
    Object.assign(target, { [key]: value })
  } catch {
    /* a frozen object refuses the write outright; the value is unchanged either way */
  }
}

const noLookupCases = [
  { name: 'null', input: null },
  { name: 'zero', input: 0 },
  { name: 'a negative id', input: -3 },
  { name: 'a non-integer id', input: 1.5 },
  { name: 'NaN', input: Number.NaN },
  { name: 'Infinity', input: Number.POSITIVE_INFINITY },
]

const verbatimNameCases = [
  { name: 'mixed casing', repoName: 'jean-luc PICARD' },
  { name: 'surrounding whitespace', repoName: '  Bruno  ' },
  { name: 'collapsed-looking interior spacing', repoName: 'Bruno   the   Unbroken' },
  { name: 'a very long name', repoName: 'Bruno the Unbroken, Champion of the Iron Hall of Kachalka' },
  { name: 'a single character', repoName: 'B' },
  { name: 'digits and punctuation', repoName: 'Commander #7 (Ret.)' },
  { name: 'tabs and newlines inside', repoName: 'Bruno\tthe\nUnbroken' },
  { name: 'non-latin characters and emoji', repoName: 'Бруно 🔥' },
]

describe('getCurrentCommanderUseCase', () => {
  describe('execute', () => {
    describe('returns unidentified("no-selection") without touching the repository', () => {
      it.each(noLookupCases)(
        'for $name',
        ({ input }) => {
          const repo = makeRepo()

          const result = getCurrentCommanderUseCase(repo).execute(input)

          expect(result).toEqual({ status: 'unidentified', reason: 'no-selection' })
          expect(repo.findById).not.toHaveBeenCalled()
        },
      )

      it('never calls any repository method for an unusable id', () => {
        const repo = makeRepo()

        for (const { input } of noLookupCases) {
          getCurrentCommanderUseCase(repo).execute(input)
        }

        expect(repo.findById).not.toHaveBeenCalled()
        expect(repo.findByName).not.toHaveBeenCalled()
        expect(repo.findAll).not.toHaveBeenCalled()
        expect(repo.create).not.toHaveBeenCalled()
        expect(repo.delete).not.toHaveBeenCalled()
      })

      it('reads the id verbatim as a guard, not as a coercion', () => {
        const repo = makeRepo(vi.fn().mockReturnValue(user(1, 'Bruno')))

        expect(getCurrentCommanderUseCase(repo).execute('1' as unknown as number)).toEqual({
          status: 'unidentified',
          reason: 'no-selection',
        })
        expect(repo.findById).not.toHaveBeenCalled()
      })
    })

    describe('returns identified when the commander exists', () => {
      it('carries the name and id of the found commander', () => {
        const repo = makeRepo(vi.fn().mockReturnValue(user(7, 'Bruno')))

        const result = getCurrentCommanderUseCase(repo).execute(7)

        expect(result).toEqual({ status: 'identified', userId: 7, name: 'Bruno' })
      })

      it('calls findById exactly once with the id it was given', () => {
        const repo = makeRepo(vi.fn().mockReturnValue(user(7, 'Bruno')))

        getCurrentCommanderUseCase(repo).execute(7)

        expect(repo.findById).toHaveBeenCalledTimes(1)
        expect(repo.findById).toHaveBeenCalledWith(7)
      })

      it('takes the id from the found user, not from the argument', () => {
        const repo = makeRepo(vi.fn().mockReturnValue(user(9, 'Bruno')))

        const result = getCurrentCommanderUseCase(repo).execute(7)

        expect(result).toEqual({ status: 'identified', userId: 9, name: 'Bruno' })
        expect(repo.findById).toHaveBeenCalledWith(7)
      })

      it('reads the repository for the smallest and largest legal ids', () => {
        const lowest = makeRepo(vi.fn().mockReturnValue(user(1, 'Bruno')))
        const highest = makeRepo(vi.fn().mockReturnValue(user(Number.MAX_SAFE_INTEGER, 'Bruno')))

        expect(getCurrentCommanderUseCase(lowest).execute(1)).toEqual({
          status: 'identified',
          userId: 1,
          name: 'Bruno',
        })
        expect(getCurrentCommanderUseCase(highest).execute(Number.MAX_SAFE_INTEGER)).toEqual({
          status: 'identified',
          userId: Number.MAX_SAFE_INTEGER,
          name: 'Bruno',
        })
      })

      it('never writes to the repository', () => {
        const repo = makeRepo(vi.fn().mockReturnValue(user(7, 'Bruno')))

        getCurrentCommanderUseCase(repo).execute(7)
        getCurrentCommanderUseCase(repo).execute(null)

        expect(repo.create).not.toHaveBeenCalled()
        expect(repo.delete).not.toHaveBeenCalled()
        expect(repo.findByName).not.toHaveBeenCalled()
        expect(repo.findAll).not.toHaveBeenCalled()
      })
    })

    describe('returns unidentified("not-found") when the id names nobody', () => {
      it('for an id with no matching user', () => {
        const findById = vi.fn().mockReturnValue(undefined)
        const repo = makeRepo(findById)

        const result = getCurrentCommanderUseCase(repo).execute(999)

        expect(result).toEqual({ status: 'unidentified', reason: 'not-found' })
        expect(findById).toHaveBeenCalledTimes(1)
        expect(findById).toHaveBeenCalledWith(999)
      })
    })

    describe('passes the name through verbatim', () => {
      it.each(verbatimNameCases)(
        'for $name',
        ({ repoName }) => {
          const repo = makeRepo(vi.fn().mockReturnValue(user(1, repoName)))

          const result = getCurrentCommanderUseCase(repo).execute(1)

          expect(result.status).toBe('identified')
          if (result.status !== 'identified') return
          expect(result.name).toBe(repoName)
          expect(result.name).toHaveLength(repoName.length)
        },
      )

      it('neither trims, recases, collapses, nor truncates a padded mixed-case name', () => {
        const stored = '  jean-luc   PICARD  '
        const repo = makeRepo(vi.fn().mockReturnValue(user(1, stored)))

        const result = getCurrentCommanderUseCase(repo).execute(1)

        if (result.status !== 'identified') {
          throw new Error('expected an identified identity')
        }
        expect(result.name).toBe('  jean-luc   PICARD  ')
        expect(result.name).not.toBe(stored.trim())
        expect(result.name).not.toBe(stored.toUpperCase())
        expect(result.name).not.toBe(stored.replace(/ {2,}/g, ' '))
      })
    })

    describe('propagates a repository failure', () => {
      it('rethrows the exact error thrown by findById', () => {
        const repoError = new Error('db down')
        const findById = vi.fn().mockImplementation(() => {
          throw repoError
        })
        const repo = makeRepo(findById)

        let caught: unknown
        try {
          getCurrentCommanderUseCase(repo).execute(1)
        } catch (error) {
          caught = error
        }

        expect(caught).toBe(repoError)
        expect(findById).toHaveBeenCalledTimes(1)
      })

      it('does not degrade a repository failure into unidentified', () => {
        const findById = vi.fn().mockImplementation(() => {
          throw new Error('db down')
        })
        const repo = makeRepo(findById)

        expect(() => getCurrentCommanderUseCase(repo).execute(1)).toThrow('db down')
        expect(findById).toHaveBeenCalledTimes(1)
      })
    })

    describe('returns a frozen identity', () => {
      it('refuses mutation of an identified result', () => {
        const repo = makeRepo(vi.fn().mockReturnValue(user(7, 'Bruno')))

        const result = getCurrentCommanderUseCase(repo).execute(7)

        expect(Object.isFrozen(result)).toBe(true)
        tryMutate(result, 'name', 'Hacked')
        tryMutate(result, 'status', 'unidentified')
        tryMutate(result, 'userId', 999)
        expect(result).toEqual({ status: 'identified', userId: 7, name: 'Bruno' })
      })

      it('refuses mutation of an unidentified result', () => {
        const repo = makeRepo()

        const result = getCurrentCommanderUseCase(repo).execute(null)

        expect(Object.isFrozen(result)).toBe(true)
        tryMutate(result, 'reason', 'not-found')
        tryMutate(result, 'status', 'identified')
        expect(result).toEqual({ status: 'unidentified', reason: 'no-selection' })
      })

      it('freezes a fresh object on every call', () => {
        const repo = makeRepo(vi.fn().mockReturnValue(user(7, 'Bruno')))
        const useCase = getCurrentCommanderUseCase(repo)

        const first = useCase.execute(7)
        const second = useCase.execute(7)

        expect(first).toEqual(second)
        expect(first).not.toBe(second)
      })
    })

    describe('never yields an identity the header could render blank', () => {
      it('guarantees a non-empty name and a positive integer id whenever it reports identified', () => {
        const repo = makeRepo(vi.fn().mockReturnValue(user(7, 'Bruno')))
        const useCase = getCurrentCommanderUseCase(repo)

        for (const { input } of noLookupCases) {
          expect(useCase.execute(input).status).toBe('unidentified')
        }

        const identifiedResult = useCase.execute(7)
        if (identifiedResult.status !== 'identified') {
          throw new Error('expected an identified identity')
        }
        expect(identifiedResult.name.length).toBeGreaterThan(0)
        expect(identifiedResult.name.trim()).not.toBe('')
        expect(Number.isInteger(identifiedResult.userId)).toBe(true)
        expect(identifiedResult.userId).toBeGreaterThanOrEqual(1)
      })

      it.fails(
        'KNOWN GAP: execute(1) with a stored name of "   " returns identified instead of throwing — ' +
          'commander-identity.ts checks name.length === 0, so a whitespace-only name is constructible and ' +
          'reaches the header as a blank. Needs name.trim().length === 0.',
        () => {
          const repo = makeRepo(vi.fn().mockReturnValue(user(1, '   ')))

          expect(() => getCurrentCommanderUseCase(repo).execute(1)).toThrow(
            'CommanderIdentity name must be a non-empty string',
          )
        },
      )
    })
  })

  describe('isIdentified / isUnidentified', () => {
    it('classifies an identified identity', () => {
      const identity = identified(1, 'Bruno')

      expect(isIdentified(identity)).toBe(true)
      expect(isUnidentified(identity)).toBe(false)
    })

    it.each([
      { name: 'no-selection', reason: 'no-selection' as const },
      { name: 'not-found', reason: 'not-found' as const },
    ])('classifies an unidentified identity, $name', ({ reason }) => {
      const identity = unidentified(reason)

      expect(isIdentified(identity)).toBe(false)
      expect(isUnidentified(identity)).toBe(true)
    })

    it('reports exactly one case as true for every identity', () => {
      const identities = [
        identified(1, 'Bruno'),
        unidentified('no-selection'),
        unidentified('not-found'),
      ]

      for (const identity of identities) {
        expect(Number(isIdentified(identity)) + Number(isUnidentified(identity))).toBe(1)
      }
    })

    it('narrows so the identified fields are reachable under isIdentified', () => {
      const repo = makeRepo(vi.fn().mockReturnValue(user(7, 'Bruno')))
      const identity = getCurrentCommanderUseCase(repo).execute(7)

      if (!isIdentified(identity)) {
        throw new Error('expected an identified identity')
      }

      expect(identity.userId).toBe(7)
      expect(identity.name).toBe('Bruno')
    })

    it('narrows so the reason is reachable under isUnidentified', () => {
      const repo = makeRepo()
      const identity = getCurrentCommanderUseCase(repo).execute(999)

      if (!isUnidentified(identity)) {
        throw new Error('expected an unidentified identity')
      }

      expect(identity.reason).toBe('not-found')
    })
  })
})

describe('identified', () => {
  const rejectedCases = [
    { label: 'an empty name', userId: 1, name: '' },
    { label: 'a zero id', userId: 0, name: 'Bruno' },
    { label: 'a negative id', userId: -1, name: 'Bruno' },
    { label: 'a non-integer id', userId: 1.5, name: 'Bruno' },
    { label: 'a non-string name', userId: 1, name: 42 as unknown as string },
  ]

  it.each(rejectedCases)('throws for $label', ({ userId, name }) => {
    expect(() => identified(userId, name)).toThrow()
  })

  it.fails(
    'KNOWN GAP: identified(1, "   ") is constructible — the guard is name.length === 0, not ' +
      'name.trim().length === 0, so a whitespace-only name survives into the header as a blank',
    () => {
      expect(() => identified(1, '   ')).toThrow()
    },
  )

  it('refuses a blank name without ever returning a value', () => {
    let threw = false
    let result: unknown = 'a value was returned'
    try {
      result = identified(1, '')
    } catch {
      threw = true
    }

    expect(threw).toBe(true)
    expect(result).toBe('a value was returned')
  })

  it('accepts the shortest legal name', () => {
    expect(identified(1, 'B')).toEqual({ status: 'identified', userId: 1, name: 'B' })
  })

  it('accepts the largest legal id', () => {
    expect(identified(Number.MAX_SAFE_INTEGER, 'Bruno')).toEqual({
      status: 'identified',
      userId: Number.MAX_SAFE_INTEGER,
      name: 'Bruno',
    })
  })

  it('returns a frozen object', () => {
    const identity = identified(1, 'Bruno')

    expect(Object.isFrozen(identity)).toBe(true)
    tryMutate(identity, 'name', 'Hacked')
    tryMutate(identity, 'status', 'unidentified')
    expect(identity).toEqual({ status: 'identified', userId: 1, name: 'Bruno' })
  })
})

describe('unidentified', () => {
  it.each([
    { name: 'no-selection', reason: 'no-selection' as const },
    { name: 'not-found', reason: 'not-found' as const },
  ])('builds the $name case', ({ reason }) => {
    expect(unidentified(reason)).toEqual({ status: 'unidentified', reason })
  })

  it('returns a frozen object', () => {
    const identity = unidentified('not-found')

    expect(Object.isFrozen(identity)).toBe(true)
    tryMutate(identity, 'reason', 'no-selection')
    tryMutate(identity, 'status', 'identified')
    expect(identity).toEqual({ status: 'unidentified', reason: 'not-found' })
  })
})

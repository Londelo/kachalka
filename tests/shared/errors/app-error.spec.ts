import { describe, it, expect } from 'vitest'
import { AppError } from '@/shared/errors/app-error'

describe('AppError', () => {
  let appError: AppError

  describe('constructor', () => {
    it('creates an error with a message', () => {
      appError = new AppError('Something went wrong')

      expect(appError.message).toBe('Something went wrong')
      expect(appError.name).toBe('AppError')
    })

    it('creates an error with a message and HTTP status', () => {
      appError = new AppError('Not found', { status: 404 })

      expect(appError.message).toBe('Not found')
      expect(appError.status).toBe(404)
    })

    it('creates an error with a message and cause', () => {
      const cause = new Error('underlying issue')
      appError = new AppError('wrapped error', { cause })

      expect(appError.message).toBe('wrapped error')
      expect(appError.cause).toBe(cause)
    })

    it('defaults status to 500', () => {
      appError = new AppError('internal error')

      expect(appError.status).toBe(500)
    })

    it('defaults cause to undefined', () => {
      appError = new AppError('no cause')

      expect(appError.cause).toBeUndefined()
    })
  })

  describe('status codes', () => {
    it('supports 400 for bad requests', () => {
      appError = new AppError('bad input', { status: 400 })
      expect(appError.status).toBe(400)
    })

    it('supports 404 for not found', () => {
      appError = new AppError('not found', { status: 404 })
      expect(appError.status).toBe(404)
    })

    it('supports 409 for conflicts', () => {
      appError = new AppError('duplicate', { status: 409 })
      expect(appError.status).toBe(409)
    })

    it('supports 403 for forbidden', () => {
      appError = new AppError('forbidden', { status: 403 })
      expect(appError.status).toBe(403)
    })
  })

  describe('stack trace', () => {
    it('includes a stack trace', () => {
      appError = new AppError('with stack')

      expect(typeof appError.stack).toBe('string')
      expect(appError.stack!.length).toBeGreaterThan(0)
      expect(appError.stack).toContain('AppError')
    })
  })

  describe('instanceof', () => {
    it('is an instance of Error', () => {
      appError = new AppError('test')

      expect(appError).toBeInstanceOf(Error)
    })

    it('is an instance of AppError', () => {
      appError = new AppError('test')

      expect(appError).toBeInstanceOf(AppError)
    })
  })

  describe('serialization', () => {
    it('toJSON returns name, message, and status', () => {
      const cause = new Error('underlying')
      appError = new AppError('serializable', { status: 422, cause })

      const serialized = appError.toJSON()

      expect(serialized).toEqual({
        name: 'AppError',
        message: 'serializable',
        status: 422,
      })
    })

    it('excludes cause and stack from toJSON output', () => {
      const cause = new Error('underlying')
      appError = new AppError('test', { status: 400, cause })

      const serialized = appError.toJSON()

      expect(serialized).not.toHaveProperty('cause')
      expect(serialized).not.toHaveProperty('stack')
    })
  })
})

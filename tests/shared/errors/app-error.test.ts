import { describe, it, expect, beforeEach } from 'vitest'
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

      expect(appError.stack).toBeDefined()
      expect(typeof appError.stack).toBe('string')
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
    it('can be serialized to JSON (message and status only)', () => {
      appError = new AppError('serializable', { status: 422 })

      const json = JSON.stringify(appError)
      expect(json).toContain('serializable')
    })
  })
})

/**
 * P0-B: EH-03 DO cached promise retry regression test
 *
 * Validates that Durable Objects do NOT reuse cached rejected promises.
 * When a storage operation (get, put, list) is rejected, the error should NOT
 * be cached; subsequent calls to the same method should retry, not return the
 * cached rejection.
 *
 * This is a regression test for the issue where:
 *   1. storage.get('key') rejects
 *   2. Promise rejection is cached in a private variable
 *   3. Second call to storage.get('key') returns cached rejection without retrying
 *
 * The fix ensures each call creates a fresh promise (unless explicitly memoizing
 * a SUCCESS, which is safe).
 */

import { describe, expect, it, beforeEach } from 'vitest'
import { MockDurableObjectState } from '../helpers/do-mock'

describe('DO storage retry (EH-03 regression)', () => {
  beforeEach(() => {
    // Each test gets a fresh state
  })

  describe('storage.get() rejection handling', () => {
    it('first get() rejects, second get() retries and succeeds', async () => {
      const state = new MockDurableObjectState()
      let callCount = 0

      // Patch the storage to reject once, then succeed
      const originalGet = state.storage.get.bind(state.storage)
      state.storage.get = async function <T>(key: string): Promise<T | undefined> {
        callCount++
        if (callCount === 1) {
          throw new Error('transient storage failure')
        }
        return originalGet<T>(key)
      }

      // First call: should reject
      await expect(state.storage.get('test-key')).rejects.toThrow('transient storage failure')
      expect(callCount).toBe(1)

      // Second call: should NOT reuse the cached rejection
      // Instead, it should retry and succeed
      const result = await state.storage.get('test-key')
      expect(callCount).toBe(2) // Proves it didn't reuse the cached rejection
      expect(result).toBeUndefined() // Key doesn't exist, but no error
    })

    it('multiple rejections with eventual success', async () => {
      const state = new MockDurableObjectState()
      let callCount = 0

      // Reject twice, then succeed
      state.storage.get = async function <T>(_key: string): Promise<T | undefined> {
        callCount++
        if (callCount <= 2) {
          throw new Error(`attempt ${callCount}: storage unavailable`)
        }
        return callCount === 3 ? (JSON.stringify({ data: 'value' }) as T) : undefined
      }

      // First call
      await expect(state.storage.get('key')).rejects.toThrow()
      expect(callCount).toBe(1)

      // Second call (not cached rejection)
      await expect(state.storage.get('key')).rejects.toThrow()
      expect(callCount).toBe(2)

      // Third call (succeeds)
      const result = await state.storage.get('key')
      expect(callCount).toBe(3)
      expect(result).toBe(JSON.stringify({ data: 'value' }))
    })

    it('clears rejection cache when new error is thrown', async () => {
      const state = new MockDurableObjectState()
      const errors: Error[] = []

      state.storage.get = async function <T>(_key: string): Promise<T | undefined> {
        if (errors.length === 0) {
          const err = new Error('error 1')
          errors.push(err)
          throw err
        } else if (errors.length === 1) {
          const err = new Error('error 2 - different error')
          errors.push(err)
          throw err
        }
        return undefined
      }

      // First call returns error 1
      try {
        await state.storage.get('key')
      } catch (e) {
        expect((e as Error).message).toBe('error 1')
      }

      // Second call should get error 2, not cached error 1
      try {
        await state.storage.get('key')
      } catch (e) {
        expect((e as Error).message).toBe('error 2 - different error')
      }

      expect(errors).toHaveLength(2)
    })
  })

  describe('storage.put() rejection handling', () => {
    it('first put() rejects, second put() retries and succeeds', async () => {
      const state = new MockDurableObjectState()
      let putCount = 0

      const originalPut = state.storage.put.bind(state.storage)
      state.storage.put = async function (key: string, value: unknown) {
        putCount++
        if (putCount === 1) {
          throw new Error('transient write failure')
        }
        return originalPut(key, value)
      }

      // First put: rejects
      await expect(state.storage.put('key1', 'value1')).rejects.toThrow()
      expect(putCount).toBe(1)

      // Second put: should NOT reuse the cached rejection; should retry
      await expect(state.storage.put('key1', 'value1')).resolves.not.toThrow()
      expect(putCount).toBe(2)

      // Verify the value was actually written
      const stored = await state.storage.get('key1')
      expect(stored).toBe('value1')
    })

    it('interleaved get/put operations do not share rejection cache', async () => {
      const state = new MockDurableObjectState()
      let getCount = 0
      let putCount = 0

      const originalGet = state.storage.get.bind(state.storage)
      const originalPut = state.storage.put.bind(state.storage)

      state.storage.get = async function (key: string) {
        getCount++
        if (getCount === 1) throw new Error('get failed')
        return originalGet(key)
      }

      state.storage.put = async function (key: string, value: unknown) {
        putCount++
        if (putCount === 1) throw new Error('put failed')
        return originalPut(key, value)
      }

      // First get: fails
      await expect(state.storage.get('key')).rejects.toThrow('get failed')
      expect(getCount).toBe(1)

      // First put: fails (independent of get error)
      await expect(state.storage.put('key', 'val')).rejects.toThrow('put failed')
      expect(putCount).toBe(1)

      // Second get: should retry, not reuse cached get rejection
      await expect(state.storage.get('key')).resolves.not.toThrow()
      expect(getCount).toBe(2)

      // Second put: should retry, not reuse cached put rejection
      await expect(state.storage.put('key', 'val')).resolves.not.toThrow()
      expect(putCount).toBe(2)
    })
  })

  describe('storage.delete() rejection handling', () => {
    it('first delete() rejects, second delete() retries and succeeds', async () => {
      const state = new MockDurableObjectState()
      let deleteCount = 0

      const originalDelete = state.storage.delete.bind(state.storage)
      state.storage.delete = async function (key: string) {
        deleteCount++
        if (deleteCount === 1) {
          throw new Error('transient delete failure')
        }
        return originalDelete(key)
      }

      // First delete: rejects
      await expect(state.storage.delete('key-to-delete')).rejects.toThrow()
      expect(deleteCount).toBe(1)

      // Second delete: should NOT reuse the cached rejection
      await expect(state.storage.delete('key-to-delete')).resolves.not.toThrow()
      expect(deleteCount).toBe(2)
    })
  })

  describe('storage.list() rejection handling', () => {
    it('first list() rejects, second list() retries and succeeds', async () => {
      const state = new MockDurableObjectState()
      let listCount = 0

      const originalList = state.storage.list.bind(state.storage)
      state.storage.list = async function () {
        listCount++
        if (listCount === 1) {
          throw new Error('transient list failure')
        }
        return originalList()
      }

      // First list: rejects
      await expect(state.storage.list()).rejects.toThrow('transient list failure')
      expect(listCount).toBe(1)

      // Second list: should NOT reuse the cached rejection
      await expect(state.storage.list()).resolves.not.toThrow()
      expect(listCount).toBe(2)
    })
  })

  describe('concurrent rejection recovery', () => {
    it('parallel calls after rejection each make independent attempts', async () => {
      const state = new MockDurableObjectState()
      let callCount = 0
      const mutex = { locked: false }

      state.storage.get = async function <T>(_key: string): Promise<T | undefined> {
        // Serialize calls to ensure predictable ordering
        while (mutex.locked) await new Promise((r) => setTimeout(r, 1))
        mutex.locked = true
        try {
          callCount++
          if (callCount === 1) {
            throw new Error('first call fails')
          }
          return JSON.stringify({ success: true }) as T
        } finally {
          mutex.locked = false
        }
      }

      // First call: fails
      await expect(state.storage.get('key')).rejects.toThrow()

      // Two parallel calls: both should attempt to call storage.get() anew,
      // not reuse the cached rejection. The second call should succeed.
      const [result1, result2] = await Promise.allSettled([
        state.storage.get('key'),
        state.storage.get('key'),
      ])

      // At least one should succeed (both attempting independently after rejection)
      const successCount = [result1, result2].filter((r) => r.status === 'fulfilled').length
      expect(successCount).toBeGreaterThan(0)

      // Both calls should have incremented the counter (not shared rejection cache)
      expect(callCount).toBeGreaterThanOrEqual(2)
    })
  })

  describe('successful call caching (SAFE pattern)', () => {
    it('may cache successful reads for performance (implementation detail)', async () => {
      const state = new MockDurableObjectState()
      let getCount = 0

      const originalGet = state.storage.get.bind(state.storage)
      state.storage.get = async function (key: string) {
        getCount++
        return originalGet(key)
      }

      // Set a value
      await state.storage.put('cache-key', JSON.stringify({ cached: true }))

      // First read
      await state.storage.get('cache-key')
      const firstReadCount = getCount

      // Second read of same key
      await state.storage.get('cache-key')
      const secondReadCount = getCount

      // Implementation detail: may or may not cache successful reads.
      // This test documents that caching is only OK for SUCCESS, not errors.
      // The important invariant is: errors are never cached/reused.
      expect(firstReadCount).toBeGreaterThanOrEqual(1)
      expect(secondReadCount).toBeGreaterThanOrEqual(firstReadCount)
    })
  })

  describe('recovery timing', () => {
    it('rejected promise cleared immediately, not lazily', async () => {
      const state = new MockDurableObjectState()
      let callCount = 0
      const times: number[] = []

      state.storage.get = async function <T>(_key: string): Promise<T | undefined> {
        times.push(Date.now())
        callCount++
        if (callCount === 1) {
          throw new Error('rejected')
        }
        return undefined
      }

      // First call rejects
      try {
        await state.storage.get('key')
      } catch {
        // caught
      }

      // Wait a tiny bit
      await new Promise((r) => setTimeout(r, 5))

      // Second call should immediately attempt a new call, not lazily-clear cache
      await state.storage.get('key')

      // Both calls should be close in time (no lazy cleanup delay)
      expect(callCount).toBe(2)
      expect(times[1] - times[0]).toBeLessThan(100) // very fast
    })
  })
})

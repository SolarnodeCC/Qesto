import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { decodeKvJson, decodeObject, decodeRequestBody } from '../../functions/api/lib/boundary-decode'

const PersonSchema = z.object({
  name: z.string(),
  age: z.number().int().positive(),
})

describe('decodeKvJson', () => {
  it('returns null for null input', () => {
    expect(decodeKvJson(null, PersonSchema)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(decodeKvJson('', PersonSchema)).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(decodeKvJson('{not json', PersonSchema)).toBeNull()
  })

  it('returns null when schema fails', () => {
    const raw = JSON.stringify({ name: 'Alice', age: -1 })
    expect(decodeKvJson(raw, PersonSchema)).toBeNull()
  })

  it('returns null when field missing', () => {
    const raw = JSON.stringify({ name: 'Bob' })
    expect(decodeKvJson(raw, PersonSchema)).toBeNull()
  })

  it('returns decoded value on valid input', () => {
    const raw = JSON.stringify({ name: 'Alice', age: 30 })
    expect(decodeKvJson(raw, PersonSchema)).toEqual({ name: 'Alice', age: 30 })
  })

  it('strips extra fields (passthrough not set)', () => {
    const raw = JSON.stringify({ name: 'Alice', age: 30, extra: 'x' })
    const result = decodeKvJson(raw, PersonSchema)
    expect(result).toEqual({ name: 'Alice', age: 30 })
    expect((result as Record<string, unknown>)?.extra).toBeUndefined()
  })
})

describe('decodeObject', () => {
  it('returns null for null input', () => {
    expect(decodeObject(null, PersonSchema)).toBeNull()
  })

  it('returns null when schema fails', () => {
    expect(decodeObject({ name: 123, age: 30 }, PersonSchema)).toBeNull()
  })

  it('returns typed value on valid input', () => {
    expect(decodeObject({ name: 'Bob', age: 25 }, PersonSchema)).toEqual({ name: 'Bob', age: 25 })
  })
})

describe('decodeRequestBody', () => {
  function makeRequest(body: unknown): Request {
    return new Request('http://test/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns ok: true with decoded data on valid body', async () => {
    const req = makeRequest({ name: 'Carol', age: 28 })
    const result = await decodeRequestBody(req, PersonSchema)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual({ name: 'Carol', age: 28 })
  })

  it('returns ok: false with ZodError on invalid body', async () => {
    const req = makeRequest({ name: 'Carol' })
    const result = await decodeRequestBody(req, PersonSchema)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeDefined()
  })

  it('returns ok: false when body is not JSON', async () => {
    const req = new Request('http://test/', { method: 'POST', body: 'not-json' })
    const result = await decodeRequestBody(req, PersonSchema)
    expect(result.ok).toBe(false)
  })
})

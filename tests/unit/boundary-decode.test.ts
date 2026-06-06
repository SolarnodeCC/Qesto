import { describe, expect, it } from 'vitest'
import {
  CachedThemeLabelsSchema,
  OgImageColorSchema,
  parseJsonString,
  parseJsonValue,
} from '../../functions/api/lib/boundary-decode'
import { CmkEnvelopeSchema } from '../../functions/api/lib/cmk'
import { ResidencyPinSchema } from '../../functions/api/lib/residency-enforce'

describe('boundary-decode', () => {
  it('parseJsonString returns null on invalid JSON', () => {
    expect(parseJsonString(CmkEnvelopeSchema, 'not-json')).toBeNull()
  })

  it('parseJsonString validates CMK envelope', () => {
    const raw = JSON.stringify({
      teamId: 't1',
      keyId: 'k1',
      algorithm: 'AES-256-GCM',
      rotatedAt: 1,
      status: 'active',
    })
    expect(parseJsonString(CmkEnvelopeSchema, raw)).toMatchObject({ teamId: 't1' })
  })

  it('parseJsonString rejects wrong algorithm', () => {
    const raw = JSON.stringify({
      teamId: 't1',
      keyId: 'k1',
      algorithm: 'AES-128',
      rotatedAt: 1,
      status: 'active',
    })
    expect(parseJsonString(CmkEnvelopeSchema, raw)).toBeNull()
  })

  it('parseJsonValue validates residency pin', () => {
    const value = { teamId: 't1', homeRegion: 'eu', enforcedAt: 100 }
    expect(parseJsonValue(ResidencyPinSchema, value)).toEqual(value)
  })

  it('CachedThemeLabelsSchema extracts theme labels', () => {
    const raw = JSON.stringify({ themes: ['a', 'b'] })
    expect(parseJsonString(CachedThemeLabelsSchema, raw)?.themes).toEqual(['a', 'b'])
  })

  it('OgImageColorSchema allowlists query colors', () => {
    expect(OgImageColorSchema.safeParse('purple').success).toBe(true)
    expect(OgImageColorSchema.safeParse('red').success).toBe(false)
  })
})

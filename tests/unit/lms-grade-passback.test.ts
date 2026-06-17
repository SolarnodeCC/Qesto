import { describe, expect, it, vi } from 'vitest'
import {
  formatResultScore,
  escapeXml,
  buildReplaceResultXml,
  computeBodyHash,
  buildSignedOutcomeRequest,
  buildAuthorizationHeader,
  parseOutcomeResponse,
  pushGradeToLms,
} from '../../functions/api/lib/lms-grade-passback'

const CREDS = { consumerKey: 'qesto-key', consumerSecret: 'secret-xyz' }
const URL = 'https://lms.example.edu/outcomes'

describe('LEARN-GRADE-01 — pure builders', () => {
  it('formats score to 4 decimals and clamps 0..1', () => {
    expect(formatResultScore(0.5)).toBe('0.5000')
    expect(formatResultScore(1.7)).toBe('1.0000')
    expect(formatResultScore(-2)).toBe('0.0000')
    expect(formatResultScore(NaN)).toBe('0.0000')
  })

  it('escapes XML metacharacters', () => {
    expect(escapeXml(`a&b<c>"d'e`)).toBe('a&amp;b&lt;c&gt;&quot;d&apos;e')
  })

  it('builds a replaceResultRequest envelope with score + sourcedId', () => {
    const xml = buildReplaceResultXml({
      outcomeServiceUrl: URL,
      resultSourcedId: 'rsid-1',
      scoreFraction: 0.75,
      messageId: 'msg-1',
    })
    expect(xml).toContain('<replaceResultRequest>')
    expect(xml).toContain('<sourcedId>rsid-1</sourcedId>')
    expect(xml).toContain('<textString>0.7500</textString>')
    expect(xml).toContain('<imsx_messageIdentifier>msg-1</imsx_messageIdentifier>')
  })
})

describe('LEARN-GRADE-01 — OAuth body-hash signing', () => {
  it('body hash changes with body', async () => {
    const a = await computeBodyHash('<a/>')
    const b = await computeBodyHash('<b/>')
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  it('builds an OAuth Authorization header binding the body hash', async () => {
    const { header, bodyHash } = await buildSignedOutcomeRequest({
      url: URL,
      body: '<x/>',
      consumerKey: CREDS.consumerKey,
      consumerSecret: CREDS.consumerSecret,
      nowSeconds: 1_700_000_000,
      nonce: 'fixed-nonce',
    })
    expect(header.startsWith('OAuth ')).toBe(true)
    expect(header).toContain('oauth_consumer_key="qesto-key"')
    expect(header).toContain(`oauth_body_hash="${encodeURIComponent(bodyHash)}"`)
    expect(header).toContain('oauth_signature="')
  })

  it('header serialisation percent-encodes values', () => {
    const header = buildAuthorizationHeader({
      oauth_consumer_key: 'a b',
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: '1',
      oauth_nonce: 'n',
      oauth_version: '1.0',
      oauth_body_hash: 'x+y',
      oauth_signature: 'sig/=',
    })
    expect(header).toContain('oauth_consumer_key="a%20b"')
    expect(header).toContain('oauth_body_hash="x%2By"')
  })
})

describe('LEARN-GRADE-01 — response parsing + push', () => {
  it('parses success codeMajor case-insensitively', () => {
    expect(parseOutcomeResponse('<x><imsx_codeMajor>success</imsx_codeMajor></x>')).toBe(true)
    expect(parseOutcomeResponse('<x><imsx_codeMajor>Success</imsx_codeMajor></x>')).toBe(true)
    expect(parseOutcomeResponse('<x><imsx_codeMajor>failure</imsx_codeMajor></x>')).toBe(false)
    expect(parseOutcomeResponse('no code here')).toBe(false)
  })

  it('pushGradeToLms returns ok on a success POX response', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response('<imsx_codeMajor>success</imsx_codeMajor>', { status: 200 }),
    )
    const res = await pushGradeToLms(
      { outcomeServiceUrl: URL, resultSourcedId: 'r', scoreFraction: 1, messageId: 'm' },
      CREDS,
      fetchImpl as unknown as typeof fetch,
    )
    expect(res).toEqual({ ok: true, status: 200 })
    expect(fetchImpl).toHaveBeenCalledOnce()
    const init = fetchImpl.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization.startsWith('OAuth ')).toBe(true)
  })

  it('returns typed failure on LMS rejection', async () => {
    const fetchImpl = vi.fn(async () => new Response('<imsx_codeMajor>failure</imsx_codeMajor>', { status: 200 }))
    const res = await pushGradeToLms(
      { outcomeServiceUrl: URL, resultSourcedId: 'r', scoreFraction: 1, messageId: 'm' },
      CREDS,
      fetchImpl as unknown as typeof fetch,
    )
    expect(res).toEqual({ ok: false, reason: 'lms_rejected', status: 200 })
  })

  it('returns network_error when fetch throws', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('boom')
    })
    const res = await pushGradeToLms(
      { outcomeServiceUrl: URL, resultSourcedId: 'r', scoreFraction: 1, messageId: 'm' },
      CREDS,
      fetchImpl as unknown as typeof fetch,
    )
    expect(res).toEqual({ ok: false, reason: 'network_error' })
  })
})

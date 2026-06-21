import { describe, expect, it } from 'vitest'
import {
  oauthPercentEncode,
  buildSignatureBaseString,
  signHmacSha1,
  verifyLtiLaunch,
  extractLaunchContext,
  LTI_MESSAGE_TYPE,
  LTI_VERSION,
} from '../../functions/api/lib/lti'

const SECRET = 'consumer-secret'
const URL = 'https://qesto.app/api/learn/lti/launch'

async function signedParams(overrides: Record<string, string> = {}): Promise<Record<string, string>> {
  const now = Math.floor(Date.now() / 1000)
  const params: Record<string, string> = {
    lti_message_type: LTI_MESSAGE_TYPE,
    lti_version: LTI_VERSION,
    resource_link_id: 'rl-123',
    context_id: 'course-9',
    context_title: 'Onboarding 101',
    user_id: 'lms-user-1',
    roles: 'Instructor,urn:lti:role:ims/lis/Learner',
    oauth_consumer_key: 'qesto-key',
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(now),
    oauth_nonce: 'nonce-abc',
    oauth_version: '1.0',
    ...overrides,
  }
  const base = buildSignatureBaseString('POST', URL, params)
  params['oauth_signature'] = await signHmacSha1(base, SECRET)
  return params
}

describe('LTI 1.1 consumer (LEARN-LTI-01)', () => {
  it('percent-encodes per RFC-3986 (escapes ! * \' ( ))', () => {
    expect(oauthPercentEncode("a!*'()b")).toBe('a%21%2A%27%28%29b')
    expect(oauthPercentEncode('a b')).toBe('a%20b')
  })

  it('excludes oauth_signature from the base string', () => {
    const base = buildSignatureBaseString('POST', URL, { a: '1', oauth_signature: 'zzz' })
    expect(base).not.toContain('zzz')
    expect(base.startsWith('POST&')).toBe(true)
  })

  it('verifies a correctly signed launch', async () => {
    const params = await signedParams()
    const result = await verifyLtiLaunch({ method: 'POST', url: URL, params, consumerSecret: SECRET })
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.context.resourceLinkId).toBe('rl-123')
      expect(result.context.contextId).toBe('course-9')
      expect(result.context.roles).toContain('Instructor')
    }
  })

  it('rejects a tampered signature', async () => {
    const params = await signedParams()
    params['resource_link_id'] = 'rl-TAMPERED'
    const result = await verifyLtiLaunch({ method: 'POST', url: URL, params, consumerSecret: SECRET })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('invalid_signature')
  })

  it('rejects the wrong consumer secret', async () => {
    const params = await signedParams()
    const result = await verifyLtiLaunch({ method: 'POST', url: URL, params, consumerSecret: 'wrong' })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('invalid_signature')
  })

  it('rejects a stale timestamp', async () => {
    const old = Math.floor(Date.now() / 1000) - 10_000
    const params = await signedParams({ oauth_timestamp: String(old) })
    const result = await verifyLtiLaunch({ method: 'POST', url: URL, params, consumerSecret: SECRET })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('timestamp_out_of_window')
  })

  it('rejects an unsupported message type', async () => {
    const params = await signedParams({ lti_message_type: 'something-else' })
    const result = await verifyLtiLaunch({ method: 'POST', url: URL, params, consumerSecret: SECRET })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('unsupported_message_type')
  })

  it('extracts course context with split roles', () => {
    const ctx = extractLaunchContext({ resource_link_id: 'r', roles: 'A, B ,C', context_id: 'c' })
    expect(ctx.roles).toEqual(['A', 'B', 'C'])
    expect(ctx.contextId).toBe('c')
  })

  it('extracts the LMS-signed outcome service url + result sourcedid (#587)', () => {
    const ctx = extractLaunchContext({
      resource_link_id: 'r',
      lis_outcome_service_url: 'https://lms.edu/outcomes',
      lis_result_sourcedid: 'sourced-1',
    })
    expect(ctx.outcomeServiceUrl).toBe('https://lms.edu/outcomes')
    expect(ctx.resultSourcedId).toBe('sourced-1')
  })

  it('rejects a replayed nonce after a valid first launch (#587)', async () => {
    const seen = new Set<string>()
    const nonceStore = {
      async seen(consumerKey: string, nonce: string) {
        const key = `${consumerKey}:${nonce}`
        if (seen.has(key)) return true
        seen.add(key)
        return false
      },
    }
    const params = await signedParams({ oauth_nonce: 'replay-me' })
    const first = await verifyLtiLaunch({ method: 'POST', url: URL, params, consumerSecret: SECRET, nonceStore })
    expect(first.valid).toBe(true)
    const second = await verifyLtiLaunch({ method: 'POST', url: URL, params, consumerSecret: SECRET, nonceStore })
    expect(second.valid).toBe(false)
    if (!second.valid) expect(second.reason).toBe('nonce_replayed')
  })
})

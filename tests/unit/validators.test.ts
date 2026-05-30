import { describe, expect, it } from 'vitest'
import {
  validateData,
  validateKvJson,
  parseClientMessage,
  AuthClaimsSchema,
  OAuthStateSchema,
  PasswordCredentialSchema,
  PasswordResetSchema,
  PollOptionArraySchema,
  StringArraySchema,
  TeamInviteTokenSchema,
  StripeCustomerRecordSchema,
  StripeSubscriptionRecordSchema,
  SamlStateTokenSchema,
  AuditActionSchema,
  PermissionArraySchema,
  RateLimitCounterSchema,
  CachedInsightsSchema,
  EmojiPollConfigSchema,
  QuickFingerConfigSchema,
  TeamQuizConfigSchema,
  EnergizerConfigEnvelopeSchema,
} from '../../functions/api/lib/validators'

// ── validateData / validateKvJson helpers ────────────────────────────────────

describe('validateData', () => {
  it('returns parsed value on valid input', () => {
    expect(validateData({ sub: 'u1', email: 'a@b.com', iat: 1, exp: 9999 }, AuthClaimsSchema))
      .toMatchObject({ sub: 'u1', email: 'a@b.com' })
  })

  it('returns null on schema mismatch', () => {
    expect(validateData({ sub: 123 }, AuthClaimsSchema)).toBeNull()
  })

  it('returns null on null input', () => {
    expect(validateData(null, AuthClaimsSchema)).toBeNull()
  })
})

describe('validateKvJson', () => {
  it('parses and validates a valid string', () => {
    const raw = JSON.stringify({ sub: 'u1', email: 'test@example.com', iat: 1, exp: 9999 })
    expect(validateKvJson(raw, AuthClaimsSchema)).toMatchObject({ sub: 'u1' })
  })

  it('returns null for invalid JSON', () => {
    expect(validateKvJson('not-json', AuthClaimsSchema)).toBeNull()
  })

  it('returns null for null input', () => {
    expect(validateKvJson(null, AuthClaimsSchema)).toBeNull()
  })

  it('returns null for schema mismatch', () => {
    expect(validateKvJson('{"sub":123}', AuthClaimsSchema)).toBeNull()
  })

  it('returns raw parse without schema', () => {
    expect(validateKvJson('{"x":1}')).toEqual({ x: 1 })
  })
})

// ── Auth schemas ─────────────────────────────────────────────────────────────

describe('AuthClaimsSchema', () => {
  const valid = { sub: 'u1', email: 'user@example.com', iat: 1000, exp: 9999 }

  it('accepts valid claims', () => {
    expect(validateData(valid, AuthClaimsSchema)).toMatchObject({ sub: 'u1' })
  })

  it('accepts non-RFC email (Microsoft UPN)', () => {
    expect(validateData({ ...valid, email: 'user@company.onmicrosoft' }, AuthClaimsSchema))
      .toMatchObject({ email: 'user@company.onmicrosoft' })
  })

  it('rejects missing sub', () => {
    expect(validateData({ ...valid, sub: undefined }, AuthClaimsSchema)).toBeNull()
  })

  it('rejects missing exp', () => {
    expect(validateData({ ...valid, exp: undefined }, AuthClaimsSchema)).toBeNull()
  })

  it('rejects empty email', () => {
    expect(validateData({ ...valid, email: '' }, AuthClaimsSchema)).toBeNull()
  })
})

describe('OAuthStateSchema', () => {
  it('accepts valid state', () => {
    expect(validateData({ userId: 'u1', email: 'a@b.com' }, OAuthStateSchema)).not.toBeNull()
  })

  it('rejects invalid email', () => {
    expect(validateData({ userId: 'u1', email: 'not-email' }, OAuthStateSchema)).toBeNull()
  })

  it('rejects missing userId', () => {
    expect(validateData({ email: 'a@b.com' }, OAuthStateSchema)).toBeNull()
  })
})

describe('PasswordCredentialSchema', () => {
  it('accepts valid credential', () => {
    expect(validateData({ hash: 'abc123' }, PasswordCredentialSchema)).toEqual({ hash: 'abc123' })
  })

  it('rejects missing hash', () => {
    expect(validateData({}, PasswordCredentialSchema)).toBeNull()
  })
})

describe('PasswordResetSchema', () => {
  it('accepts valid reset payload', () => {
    expect(validateData({ userId: 'u1', email: 'a@b.com' }, PasswordResetSchema)).not.toBeNull()
  })

  it('rejects invalid email', () => {
    expect(validateData({ userId: 'u1', email: 'bad' }, PasswordResetSchema)).toBeNull()
  })
})

// ── Database / KV schemas ────────────────────────────────────────────────────

describe('PollOptionArraySchema', () => {
  it('accepts valid options', () => {
    expect(validateData([{ id: '1', label: 'Yes' }, { id: '2', label: 'No' }], PollOptionArraySchema))
      .toHaveLength(2)
  })

  it('rejects non-array', () => {
    expect(validateData({ id: '1', label: 'Yes' }, PollOptionArraySchema)).toBeNull()
  })

  it('rejects items missing label', () => {
    expect(validateData([{ id: '1' }], PollOptionArraySchema)).toBeNull()
  })
})

describe('StringArraySchema', () => {
  it('accepts string array', () => {
    expect(validateData(['a', 'b'], StringArraySchema)).toEqual(['a', 'b'])
  })

  it('rejects array with non-strings', () => {
    expect(validateData([1, 2], StringArraySchema)).toBeNull()
  })
})

// ── Teams & permissions ──────────────────────────────────────────────────────

describe('TeamInviteTokenSchema', () => {
  const valid = { teamId: 'team1', email: 'a@b.com', role: 'admin' as const }

  it('accepts admin/member/viewer roles', () => {
    for (const role of ['admin', 'member', 'viewer'] as const) {
      expect(validateData({ ...valid, role }, TeamInviteTokenSchema)).not.toBeNull()
    }
  })

  it('rejects owner role', () => {
    expect(validateData({ ...valid, role: 'owner' }, TeamInviteTokenSchema)).toBeNull()
  })

  it('rejects invalid email', () => {
    expect(validateData({ ...valid, email: 'not-email' }, TeamInviteTokenSchema)).toBeNull()
  })
})

describe('PermissionArraySchema', () => {
  it('accepts valid permissions', () => {
    expect(validateData(['session:create', 'session:update'], PermissionArraySchema)).not.toBeNull()
  })

  it('rejects unknown permission strings', () => {
    expect(validateData(['session:create', 'hack:the:world'], PermissionArraySchema)).toBeNull()
  })
})

// ── Billing ──────────────────────────────────────────────────────────────────

describe('StripeCustomerRecordSchema', () => {
  it('accepts valid customer record', () => {
    expect(validateData({ customerId: 'cus_abc' }, StripeCustomerRecordSchema)).toEqual({ customerId: 'cus_abc' })
  })

  it('rejects missing customerId', () => {
    expect(validateData({}, StripeCustomerRecordSchema)).toBeNull()
  })
})

describe('StripeSubscriptionRecordSchema', () => {
  it('accepts valid subscription record', () => {
    expect(validateData({ subscriptionId: 'sub_abc' }, StripeSubscriptionRecordSchema)).toEqual({ subscriptionId: 'sub_abc' })
  })
})

// ── SAML ─────────────────────────────────────────────────────────────────────

describe('SamlStateTokenSchema', () => {
  it('accepts valid state', () => {
    expect(validateData({ teamId: 't1', idpSsoUrl: 'https://idp.example.com/sso' }, SamlStateTokenSchema)).not.toBeNull()
  })

  it('rejects non-URL idpSsoUrl', () => {
    expect(validateData({ teamId: 't1', idpSsoUrl: 'not-a-url' }, SamlStateTokenSchema)).toBeNull()
  })
})

// ── Audit ────────────────────────────────────────────────────────────────────

describe('AuditActionSchema', () => {
  it('accepts known actions', () => {
    expect(validateData('session.create', AuditActionSchema)).toBe('session.create')
    expect(validateData('insights.generate', AuditActionSchema)).toBe('insights.generate')
  })

  it('rejects unknown actions', () => {
    expect(validateData('session.hack', AuditActionSchema)).toBeNull()
    expect(validateData('', AuditActionSchema)).toBeNull()
  })
})

// ── Rate limit ───────────────────────────────────────────────────────────────

describe('RateLimitCounterSchema', () => {
  it('accepts valid counter', () => {
    expect(validateData({ count: 3, resetAt: Date.now() + 60000 }, RateLimitCounterSchema)).not.toBeNull()
  })

  it('rejects negative count', () => {
    expect(validateData({ count: -1, resetAt: 0 }, RateLimitCounterSchema)).toBeNull()
  })

  it('rejects non-integer count', () => {
    expect(validateData({ count: 1.5, resetAt: 0 }, RateLimitCounterSchema)).toBeNull()
  })
})

// ── Insights cache ───────────────────────────────────────────────────────────

describe('CachedInsightsSchema', () => {
  const valid = {
    themes: [{ theme: 'Team alignment', count: 5, examples: ['great collaboration'] }],
    trend: { '7d': 3, '30d': 12 },
    cached_at: Date.now(),
  }

  it('accepts valid cached insights', () => {
    expect(validateData(valid, CachedInsightsSchema)).not.toBeNull()
  })

  it('rejects missing trend keys', () => {
    expect(validateData({ ...valid, trend: { '7d': 1 } }, CachedInsightsSchema)).toBeNull()
  })

  it('rejects negative theme count', () => {
    const bad = { ...valid, themes: [{ theme: 'X', count: -1, examples: [] }] }
    expect(validateData(bad, CachedInsightsSchema)).toBeNull()
  })
})

// ── Energizer configs ────────────────────────────────────────────────────────

describe('EmojiPollConfigSchema', () => {
  it('accepts valid config', () => {
    expect(validateData({ emojis: ['😀', '😢'] }, EmojiPollConfigSchema)).not.toBeNull()
  })

  it('rejects missing emojis', () => {
    expect(validateData({}, EmojiPollConfigSchema)).toBeNull()
  })
})

describe('QuickFingerConfigSchema', () => {
  it('accepts valid config', () => {
    expect(validateData({ options: ['A', 'B', 'C'], correct_index: 1 }, QuickFingerConfigSchema)).not.toBeNull()
  })

  it('rejects missing correct_index', () => {
    expect(validateData({ options: ['A', 'B'] }, QuickFingerConfigSchema)).toBeNull()
  })
})

describe('TeamQuizConfigSchema', () => {
  const valid = {
    questions: [{ prompt: 'Q1', options: ['A', 'B'], correct_index: 0 }],
    current_index: 0,
  }

  it('accepts valid config', () => {
    expect(validateData(valid, TeamQuizConfigSchema)).not.toBeNull()
  })

  it('rejects question missing correct_index', () => {
    const bad = { questions: [{ prompt: 'Q1', options: ['A'] }], current_index: 0 }
    expect(validateData(bad, TeamQuizConfigSchema)).toBeNull()
  })
})

describe('EnergizerConfigEnvelopeSchema', () => {
  it('accepts any object', () => {
    expect(validateData({ arbitrary: 'fields', are: 'ok' }, EnergizerConfigEnvelopeSchema)).not.toBeNull()
  })

  it('rejects null', () => {
    expect(validateData(null, EnergizerConfigEnvelopeSchema)).toBeNull()
  })

  it('rejects arrays (not an object)', () => {
    expect(validateData(['a', 'b'], EnergizerConfigEnvelopeSchema)).toBeNull()
  })
})

// ── parseClientMessage ───────────────────────────────────────────────────────

describe('parseClientMessage', () => {
  it('parses a valid vote message', () => {
    const msg = JSON.stringify({ type: 'vote', data: { questionId: 'q1', optionId: 'o1' }, timestamp: Date.now() })
    const result = parseClientMessage(msg)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('vote')
  })

  it('returns null for invalid JSON', () => {
    expect(parseClientMessage('not-json')).toBeNull()
  })

  it('returns null for vote missing data fields', () => {
    const msg = JSON.stringify({ type: 'vote', data: {}, timestamp: Date.now() })
    expect(parseClientMessage(msg)).toBeNull()
  })

  it('returns null for unknown message type', () => {
    const msg = JSON.stringify({ type: 'explode', data: {}, timestamp: Date.now() })
    expect(parseClientMessage(msg)).toBeNull()
  })

  it('returns null for advance missing timestamp', () => {
    const msg = JSON.stringify({ type: 'advance', data: {} })
    expect(parseClientMessage(msg)).toBeNull()
  })

  // COPILOT-06: add_question presenter message (ADR-0046).
  it('parses a valid add_question message', () => {
    const msg = JSON.stringify({
      type: 'add_question',
      data: { question: { kind: 'poll', prompt: 'Which option?', options: [{ label: 'A' }, { label: 'B' }] } },
      timestamp: Date.now(),
    })
    const result = parseClientMessage(msg)
    expect(result?.type).toBe('add_question')
  })

  it('rejects add_question with an invalid kind', () => {
    const msg = JSON.stringify({
      type: 'add_question',
      data: { question: { kind: 'nonsense', prompt: 'x', options: [{ label: 'A' }] } },
      timestamp: Date.now(),
    })
    expect(parseClientMessage(msg)).toBeNull()
  })

  it('rejects add_question with an empty prompt', () => {
    const msg = JSON.stringify({
      type: 'add_question',
      data: { question: { kind: 'poll', prompt: '', options: [{ label: 'A' }] } },
      timestamp: Date.now(),
    })
    expect(parseClientMessage(msg)).toBeNull()
  })
})

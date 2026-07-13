import { describe, expect, it } from 'vitest'
import {
  findUserIdByEmail,
  insertDraftSession,
  insertFreeUser,
  insertMagicLink,
  insertSessionQuestion,
  marketingTemplateIndustryCounts,
  marketingTemplateTotals,
} from '../../functions/api/repositories/marketingTemplateRepository'
import { D1Mock } from '../helpers/d1-mock'

type MarketingTemplateRow = D1Mock['marketingTemplates'] extends Map<string, infer Row> ? Row : never

function dbForTest(): D1Database {
  return new D1Mock() as unknown as D1Database
}

function seedTemplate(db: D1Mock, id: string, overrides: Partial<MarketingTemplateRow> = {}): void {
  db.marketingTemplates.set(id, {
    id,
    source_session_id: `source_${id}`,
    content_hash: `hash_${id}`,
    industry: 'general',
    theme: 'team-wellbeing',
    topic: 'team',
    title_en: `Template ${id}`,
    question_count: 1,
    estimated_minutes: 15,
    confidence: 80,
    langs: 'en,nl',
    is_public: 1,
    is_discarded: 0,
    usage_count: 0,
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_000_000,
    ...overrides,
  })
}

describe('marketingTemplateRepository', () => {
  describe('marketingTemplateTotals()', () => {
    it('returns zero totals for an empty registry', async () => {
      const db = dbForTest()

      await expect(marketingTemplateTotals(db)).resolves.toEqual({
        total: 0,
        active: 0,
        discarded: 0,
        total_uses: 0,
        last_created_at: null,
      })
    })

    it('counts discarded templates but excludes them from usage and newest-active time', async () => {
      const mock = new D1Mock()
      seedTemplate(mock, 'active_old', { usage_count: 2, created_at: 100 })
      seedTemplate(mock, 'discarded_new', { is_discarded: 1, usage_count: 99, created_at: 300 })
      seedTemplate(mock, 'active_new', { usage_count: 3, created_at: 200 })

      const totals = await marketingTemplateTotals(mock as unknown as D1Database)

      expect(totals).toEqual({
        total: 3,
        active: 2,
        discarded: 1,
        total_uses: 5,
        last_created_at: 200,
      })
    })
  })

  describe('marketingTemplateIndustryCounts()', () => {
    it('groups only active templates by industry', async () => {
      const mock = new D1Mock()
      seedTemplate(mock, 'tech_a', { industry: 'tech' })
      seedTemplate(mock, 'tech_b', { industry: 'tech' })
      seedTemplate(mock, 'health', { industry: 'healthcare' })
      seedTemplate(mock, 'discarded_tech', { industry: 'tech', is_discarded: 1 })

      const counts = await marketingTemplateIndustryCounts(mock as unknown as D1Database)

      expect(Object.fromEntries(counts.map((row) => [row.industry, row.n]))).toEqual({
        tech: 2,
        healthcare: 1,
      })
    })
  })

  describe('findUserIdByEmail()', () => {
    it('returns the matching user id or null', async () => {
      const mock = new D1Mock()
      mock.users.set('user_123', {
        id: 'user_123',
        email: 'visitor@example.com',
        display_name: null,
        created_at: 1_700_000_000_000,
        last_login_at: null,
        plan: 'free',
      })

      await expect(findUserIdByEmail(mock as unknown as D1Database, 'visitor@example.com')).resolves.toBe('user_123')
      await expect(findUserIdByEmail(mock as unknown as D1Database, 'missing@example.com')).resolves.toBeNull()
    })
  })

  describe('insertFreeUser()', () => {
    it('creates a free-plan user with login timestamps', async () => {
      const mock = new D1Mock()
      const now = 1_700_000_123_456

      await insertFreeUser(mock as unknown as D1Database, 'user_new', 'new@example.com', now)

      expect(mock.users.get('user_new')).toMatchObject({
        id: 'user_new',
        email: 'new@example.com',
        display_name: null,
        created_at: now,
        last_login_at: now,
        plan: 'free',
      })
    })
  })

  describe('insertDraftSession()', () => {
    it('provisions gallery templates as draft reflection sessions with once-only voting', async () => {
      const mock = new D1Mock()

      await insertDraftSession(mock as unknown as D1Database, {
        id: 'session_123',
        ownerId: 'user_123',
        code: 'ABC123',
        title: 'Template session',
        now: 1_700_000_222_000,
        teamId: null,
      })

      expect(mock.sessions.get('session_123')).toMatchObject({
        id: 'session_123',
        owner_id: 'user_123',
        code: 'ABC123',
        title: 'Template session',
        status: 'draft',
        anonymity: 'full',
        vote_policy: 'once',
        session_mode: 'reflection',
        team_id: null,
      })
    })

    it('preserves the owning team id when supplied', async () => {
      const mock = new D1Mock()

      await insertDraftSession(mock as unknown as D1Database, {
        id: 'session_team',
        ownerId: 'user_123',
        code: 'TEAM42',
        title: 'Team template session',
        now: 1_700_000_333_000,
        teamId: 'team_123',
      })

      expect(mock.sessions.get('session_team')?.team_id).toBe('team_123')
    })
  })

  describe('insertSessionQuestion()', () => {
    it('persists the template question position, kind, prompt, options, and timestamp', async () => {
      const mock = new D1Mock()

      await insertSessionQuestion(mock as unknown as D1Database, {
        id: 'question_1',
        sessionId: 'session_123',
        position: 2,
        kind: 'open',
        prompt: 'What should we improve?',
        optionsJson: '[]',
        now: 1_700_000_444_000,
      })

      expect(mock.questions.get('question_1')).toEqual({
        id: 'question_1',
        session_id: 'session_123',
        position: 2,
        kind: 'open',
        prompt: 'What should we improve?',
        options_json: '[]',
        created_at: 1_700_000_444_000,
      })
    })
  })

  describe('insertMagicLink()', () => {
    it('mints an unconsumed one-time login row with requester IP', async () => {
      const mock = new D1Mock()

      await insertMagicLink(mock as unknown as D1Database, {
        tokenHash: 'hash_123',
        email: 'visitor@example.com',
        now: 1_700_000_555_000,
        expiresAt: 1_700_000_855_000,
        ip: '203.0.113.10',
      })

      expect(mock.magicLinks.get('hash_123')).toEqual({
        token_hash: 'hash_123',
        email: 'visitor@example.com',
        created_at: 1_700_000_555_000,
        expires_at: 1_700_000_855_000,
        consumed_at: null,
        requester_ip: '203.0.113.10',
      })
    })
  })
})

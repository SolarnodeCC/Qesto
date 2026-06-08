import { describe, expect, it, beforeEach } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env, Session } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const SECRET = 'integration-test-secret-at-least-32-bytes!'

function makeEnv(db: D1Mock): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: SECRET,
    DB: db as unknown as D1Database,
    USERS_KV: new KVMock() as unknown as KVNamespace,
    SESSIONS_KV: new KVMock() as unknown as KVNamespace,
    ACTIONS_KV: new KVMock() as unknown as KVNamespace,
  } as unknown as Env
}

async function authHeaders(userId: string, email: string, plan: string = 'team') {
  const token = await signJwt({ sub: userId, email, plan }, SECRET, 3600)
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

describe('session exports (EXPORT-RICH-01-A, Phase 1)', () => {
  let db: D1Mock

  beforeEach(() => {
    db = new D1Mock()
  })

  const userId = 'user-1'
  const teamId = 'team-1'
  const sessionId = 'session-1'

  function setupSession(status: 'closed' | 'archived' | 'live' = 'closed') {
    db.users.set(userId, {
      id: userId,
      email: 'user@example.com',
      display_name: 'User One',
      created_at: Date.now(),
      last_login_at: null,
      plan: 'team',
    })

    const session: Session = {
      id: sessionId,
      team_id: teamId,
      user_id: userId,
      title: 'Test Session',
      code: 'TEST123',
      kind: 'poll',
      status,
      created_at: Date.now() - 3600000,
      started_at: Date.now() - 2700000,
      closed_at: status !== 'live' ? Date.now() : null,
      archived_at: status === 'archived' ? Date.now() : null,
      anonymity_mode: 'off',
      require_names: false,
      show_results: 'during',
      duration_minutes: null,
      max_participants: null,
      settings_json: '{}',
    }
    db.sessions.set(sessionId, session)

    // Add some questions and votes for export
    db.questions.set('q-1', {
      id: 'q-1',
      session_id: sessionId,
      position: 1,
      kind: 'poll',
      prompt: 'Do you like this?',
      description: null,
      options_json: JSON.stringify([
        { id: 'opt-1', label: 'Yes' },
        { id: 'opt-2', label: 'No' },
      ]),
      created_at: Date.now(),
    })

    db.votes.set('vote-1', {
      id: 'vote-1',
      session_id: sessionId,
      question_id: 'q-1',
      participant_id: 'p-1',
      option_id: 'opt-1',
      value: 'Yes',
      created_at: Date.now(),
    })
  }

  describe('GET /:id/export.json', () => {
    it('returns structured JSON for closed session', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)
      const headers = await authHeaders(userId, 'user@example.com')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.json`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.status).toBe(200)
      const json = await res.json<any>()
      expect(json).toMatchObject({
        sessionId,
        title: 'Test Session',
        status: 'closed',
      })
      expect(Array.isArray(json.questions)).toBe(true)
    })

    it('requires session owner', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)
      const otherUserId = 'other-user'
      db.users.set(otherUserId, {
        id: otherUserId,
        email: 'other@example.com',
        display_name: 'Other',
        created_at: Date.now(),
        last_login_at: null,
        plan: 'team',
      })
      const headers = await authHeaders(otherUserId, 'other@example.com')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.json`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.status).toBe(404)
    })

    it('requires team plan', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)
      const headers = await authHeaders(userId, 'user@example.com', 'free')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.json`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.status).toBe(403)
    })

    it('requires session to be closed or archived', async () => {
      setupSession('live')
      const app = createApp()
      const env = makeEnv(db)
      const headers = await authHeaders(userId, 'user@example.com')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.json`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.status).toBe(400)
    })

    it('includes question metadata and vote counts', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)
      const headers = await authHeaders(userId, 'user@example.com')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.json`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.status).toBe(200)
      const json = await res.json<any>()
      expect(json.questions.length).toBeGreaterThan(0)
      expect(json.questions[0]).toHaveProperty('prompt')
      expect(json.questions[0]).toHaveProperty('options')
    })

    it('sets correct Content-Type header', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)
      const headers = await authHeaders(userId, 'user@example.com')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.json`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.headers.get('Content-Type')).toMatch(/application\/json/)
    })
  })

  describe('GET /:id/export.csv', () => {
    it('returns CSV format for closed session', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)
      const headers = await authHeaders(userId, 'user@example.com')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.csv`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toMatch(/Question/) // Header row
      expect(text).toMatch(/Do you like this/) // Question text
    })

    it('sets Content-Disposition header for download', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)
      const headers = await authHeaders(userId, 'user@example.com')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.csv`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.headers.get('Content-Disposition')).toMatch(/attachment/)
    })

    it('requires team plan', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)
      const headers = await authHeaders(userId, 'user@example.com', 'free')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.csv`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.status).toBe(403)
    })

    it('escapes formula injection attempts', async () => {
      // Set up a question with dangerous text
      setupSession('closed')
      db.questions.set('q-2', {
        id: 'q-2',
        session_id: sessionId,
        position: 2,
        kind: 'poll',
        prompt: '=SUM(1+1)',
        description: null,
        options_json: JSON.stringify([{ id: 'opt-1', label: '=cmd|"/c calc"!A1' }]),
        created_at: Date.now(),
      })

      const app = createApp()
      const env = makeEnv(db)
      const headers = await authHeaders(userId, 'user@example.com')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.csv`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.status).toBe(200)
      const text = await res.text()
      // Should be quoted to prevent formula interpretation
      expect(text).toMatch(/"=SUM/)
    })

    it('requires authentication', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.csv`, {
          method: 'GET',
          headers: { 'content-type': 'application/json' },
        }),
        env,
      )

      expect(res.status).toBe(401)
    })
  })

  describe('GET /:id/export.html', () => {
    it('returns signed HTML export for closed session', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)
      const headers = await authHeaders(userId, 'user@example.com')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.html`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toMatch(/<html/i)
      expect(html).toMatch(/Test Session/)
    })

    it('includes HMAC signature for authenticity', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)
      const headers = await authHeaders(userId, 'user@example.com')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.html`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.status).toBe(200)
      const html = await res.text()
      // Should contain signature meta tag or comment
      expect(html).toMatch(/signature|X-Qesto/)
    })

    it('sets print-friendly headers', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)
      const headers = await authHeaders(userId, 'user@example.com')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.html`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      const html = await res.text()
      expect(html).toMatch(/@media\s+print/)
    })

    it('requires team plan and ownership', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)
      const headers = await authHeaders(userId, 'user@example.com', 'free')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.html`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.status).toBe(403)
    })
  })

  describe('GET /:id/export.pdf', () => {
    it('returns HTML hint wrapper for PDF export', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)
      const headers = await authHeaders(userId, 'user@example.com')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.pdf`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toMatch(/<html/i)
    })

    it('requires team plan', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)
      const headers = await authHeaders(userId, 'user@example.com', 'free')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.pdf`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.status).toBe(403)
    })
  })

  describe('404 and error handling', () => {
    it('returns 404 for nonexistent session', async () => {
      const app = createApp()
      const env = makeEnv(db)
      db.users.set(userId, {
        id: userId,
        email: 'user@example.com',
        display_name: 'User',
        created_at: Date.now(),
        last_login_at: null,
        plan: 'team',
      })
      const headers = await authHeaders(userId, 'user@example.com')

      const res = await app.fetch(
        new Request(`http://local/api/sessions/nonexistent/export.json`, {
          method: 'GET',
          headers,
        }),
        env,
      )

      expect(res.status).toBe(404)
    })

    it('returns 401 without authentication', async () => {
      setupSession('closed')
      const app = createApp()
      const env = makeEnv(db)

      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}/export.json`, {
          method: 'GET',
          headers: { 'content-type': 'application/json' },
        }),
        env,
      )

      expect(res.status).toBe(401)
    })
  })
})

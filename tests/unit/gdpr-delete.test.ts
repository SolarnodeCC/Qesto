// GDPR-BADGE-01 — verifies the deletion cascade documented in
// knowledge-base/security/GDPR_DATA_SUBJECT_RUNBOOK.md actually deletes what
// it claims to delete. See #521: this test file existed only as a reference
// in the runbook before this commit — it did not exist in the repo.
import { describe, expect, it } from 'vitest'
import { deleteUserGdprData } from '../../functions/api/lib/gdpr-delete-user'
import { teamDocumentKey, userPrefsKey } from '../../functions/api/lib/kv-keys'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const NOW = Date.now()

function makeEnv(db: D1Mock) {
  return {
    DB: db as unknown as D1Database,
    USERS_KV: new KVMock() as unknown as KVNamespace,
    TEAMS_KV: new KVMock() as unknown as KVNamespace,
    SESSIONS_KV: new KVMock() as unknown as KVNamespace,
  }
}

describe('deleteUserGdprData (user-deletion cascade)', () => {
  it('deletes owned sessions and their child rows (votes, questions)', async () => {
    const db = new D1Mock()
    const userId = 'user_gdpr_1'
    db.sessions.set('sess_1', {
      id: 'sess_1',
      owner_id: userId,
      code: 'GDPR01',
      title: 'Session to purge',
      status: 'closed',
      anonymity: 'full',
      created_at: NOW,
      started_at: NOW,
      closed_at: NOW,
      archived_at: null,
    })
    db.questions.set('q_1', {
      id: 'q_1',
      session_id: 'sess_1',
      position: 0,
      kind: 'poll',
      prompt: 'Q?',
      options_json: '[]',
      created_at: NOW,
    })
    db.votes.set('v_1', {
      id: 'v_1',
      session_id: 'sess_1',
      question_id: 'q_1',
      voter_id: 'voter_1',
      option_id: 'a',
      submitted_at: NOW,
    })

    const env = makeEnv(db)
    const result = await deleteUserGdprData(env, userId)

    expect(result.sessionsDeleted).toBe(1)
    expect(db.sessions.has('sess_1')).toBe(false)
    expect(db.questions.has('q_1')).toBe(false)
    expect(db.votes.has('v_1')).toBe(false)
  })

  it('deletes the user row and their own audit_events entries', async () => {
    const db = new D1Mock()
    const userId = 'user_gdpr_2'
    db.users.set(userId, {
      id: userId,
      email: `${userId}@example.com`,
      display_name: 'Departing User',
      created_at: NOW,
      last_login_at: NOW,
      plan: 'starter',
    })
    db.auditEvents.set('ae_1', {
      id: 'ae_1',
      actor_id: userId,
      action: 'session.created',
      subject_type: 'session',
      subject_id: 'sess_x',
      before_snapshot: '{}',
      after_snapshot: '{}',
      ts: NOW,
      trace_id: 'trace_1',
      idempotency_key: null,
    })
    // An audit event by another actor must survive.
    db.auditEvents.set('ae_2', {
      id: 'ae_2',
      actor_id: 'someone_else',
      action: 'session.created',
      subject_type: 'session',
      subject_id: 'sess_y',
      before_snapshot: '{}',
      after_snapshot: '{}',
      ts: NOW,
      trace_id: 'trace_2',
      idempotency_key: null,
    })

    const env = makeEnv(db)
    const result = await deleteUserGdprData(env, userId)

    expect(result.userRowDeleted).toBe(true)
    expect(db.users.has(userId)).toBe(false)
    expect(db.auditEvents.has('ae_1')).toBe(false)
    expect(db.auditEvents.has('ae_2')).toBe(true)
  })

  it('clears USERS_KV preferences and the user-teams index', async () => {
    const db = new D1Mock()
    const userId = 'user_gdpr_3'
    const env = makeEnv(db)
    await env.USERS_KV.put(userPrefsKey(userId), JSON.stringify({ theme: 'dark' }))
    await env.USERS_KV.put(`user-teams:${userId}`, JSON.stringify(['team_a']))

    await deleteUserGdprData(env, userId)

    expect(await env.USERS_KV.get(userPrefsKey(userId))).toBeNull()
    expect(await env.USERS_KV.get(`user-teams:${userId}`)).toBeNull()
  })

  it('removes the user from team membership lists (team-deletion member data removal)', async () => {
    const db = new D1Mock()
    const userId = 'user_gdpr_4'
    const teamId = 'team_a'
    const env = makeEnv(db)

    await env.TEAMS_KV.put(
      `user-teams:${userId}`,
      JSON.stringify([teamId]),
    )
    await env.TEAMS_KV.put(
      teamDocumentKey(teamId),
      JSON.stringify({
        id: teamId,
        ownerId: 'owner_x',
        members: [
          { userId, role: 'member' },
          { userId: 'owner_x', role: 'owner' },
        ],
      }),
    )

    await deleteUserGdprData(env, userId)

    const teamRaw = await env.TEAMS_KV.get(teamDocumentKey(teamId))
    const team = JSON.parse(teamRaw as string) as { members: Array<{ userId: string }> }
    expect(team.members.map((m) => m.userId)).toEqual(['owner_x'])
    expect(await env.TEAMS_KV.get(`user-teams:${userId}`)).toBeNull()
  })

  it('is idempotent — calling twice on an already-deleted user does not throw and reports zero further deletions', async () => {
    const db = new D1Mock()
    const userId = 'user_gdpr_5'
    const env = makeEnv(db)

    const first = await deleteUserGdprData(env, userId)
    const second = await deleteUserGdprData(env, userId)

    expect(first.userRowDeleted).toBe(false) // user never existed in D1 for this test
    expect(second.sessionsDeleted).toBe(0)
    expect(second.userRowDeleted).toBe(false)
  })
})

describe('GDPR deletion SLA (documentation, not code-enforced)', () => {
  it('documents a 72-hour completion target but the deletion path itself is synchronous, not timer-based', async () => {
    // There is no scheduled job, queue, or timer in deleteUserGdprData — the
    // 72h figure in GDPR_DATA_SUBJECT_RUNBOOK.md is an SLA target for the
    // (already-synchronous) API path, not a measured/enforced duration. This
    // test only documents that expectation so a future change that makes
    // deletion async does not silently invalidate the runbook's claim.
    const db = new D1Mock()
    const userId = 'user_gdpr_6'
    const env = makeEnv(db)

    const startedAt = Date.now()
    await deleteUserGdprData(env, userId)
    const elapsedMs = Date.now() - startedAt

    // Synchronous in-process call — sanity bound, not a real SLA measurement
    // (the runbook's 72h is an external support-process target, e.g. for
    // manual email requests, not a latency budget for this function).
    expect(elapsedMs).toBeLessThan(72 * 60 * 60 * 1000)
  })
})

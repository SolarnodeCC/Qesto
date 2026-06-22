import { describe, expect, it } from 'vitest'
import {
  persistLaunchContext,
  lookupLaunchContextByResourceLink,
  kvNonceStore,
} from '../../functions/api/lib/lti-launch-store'
import type { LtiLaunchContext } from '../../functions/api/lib/lti'

// #587 — grade passback must read the LMS-signed target from the stored launch
// context, never from the request body. These tests cover persist→lookup and the
// KV nonce store used for OAuth replay protection.

type StoredRow = Record<string, unknown>

function makeDb() {
  const rows: StoredRow[] = []
  function prepare(sql: string) {
    const s = sql.trim().replace(/\s+/g, ' ')
    let bound: unknown[] = []
    const api = {
      bind(...args: unknown[]) {
        bound = args
        return api
      },
      async run() {
        if (s.startsWith('INSERT INTO lti_launch_contexts')) {
          const [id, consumer_key, context_id, resource_link_id, lis_outcome_service_url, lis_result_sourcedid, lms_user_id, roles, qesto_session_id, created_at] =
            bound as unknown[]
          // emulate ON CONFLICT(consumer_key, resource_link_id, lis_result_sourcedid) upsert
          const existing = rows.find(
            (r) =>
              r.consumer_key === consumer_key &&
              r.resource_link_id === resource_link_id &&
              r.lis_result_sourcedid === lis_result_sourcedid,
          )
          const next = {
            id, consumer_key, context_id, resource_link_id, lis_outcome_service_url,
            lis_result_sourcedid, lms_user_id, roles, qesto_session_id, created_at, updated_at: created_at,
          }
          if (existing) Object.assign(existing, next)
          else rows.push(next)
        }
        return { success: true }
      },
      async first<T>(): Promise<T | null> {
        if (s.includes('FROM lti_launch_contexts')) {
          const [consumer_key, resource_link_id] = bound as unknown[]
          const match = rows
            .filter((r) => r.consumer_key === consumer_key && r.resource_link_id === resource_link_id)
            .sort((a, b) => Number(b.updated_at) - Number(a.updated_at))[0]
          return (match ?? null) as unknown as T
        }
        return null
      },
    }
    return api
  }
  return { prepare } as unknown as D1Database
}

function makeKv() {
  const store = new Map<string, string>()
  return {
    async get(key: string) {
      return store.get(key) ?? null
    },
    async put(key: string, value: string) {
      store.set(key, value)
    },
  } as unknown as KVNamespace
}

const ctx: LtiLaunchContext = {
  consumerKey: 'qesto-key',
  contextId: 'course-9',
  contextTitle: 'Onboarding',
  resourceLinkId: 'rl-123',
  userId: 'lms-user-1',
  roles: ['Instructor'],
  personName: null,
  outcomeServiceUrl: 'https://lms.edu/outcomes',
  resultSourcedId: 'sourced-1',
}

describe('LTI launch-context store (#587)', () => {
  it('persists and looks up the signed grade target by resource link', async () => {
    const db = makeDb()
    await persistLaunchContext(db, ctx)
    const found = await lookupLaunchContextByResourceLink(db, 'qesto-key', 'rl-123')
    expect(found?.outcomeServiceUrl).toBe('https://lms.edu/outcomes')
    expect(found?.resultSourcedId).toBe('sourced-1')
    expect(found?.roles).toEqual(['Instructor'])
  })

  it('returns null when no launch is bound to the resource link', async () => {
    const db = makeDb()
    expect(await lookupLaunchContextByResourceLink(db, 'qesto-key', 'unknown')).toBeNull()
  })

  it('nonce store reports first-use false then replay true', async () => {
    const store = kvNonceStore(makeKv())
    expect(await store.seen('qesto-key', 'n1')).toBe(false)
    expect(await store.seen('qesto-key', 'n1')).toBe(true)
    expect(await store.seen('qesto-key', 'n2')).toBe(false)
  })
})

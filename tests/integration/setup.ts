import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

export const TEST_SECRET = 'integration-test-secret-at-least-32-bytes!'
export const SEED_ADMIN_EMAIL = 'qesto@example.com'

export async function cookieFor(userId: string, email: string): Promise<string> {
  const token = await signJwt({ sub: userId, email }, TEST_SECRET, 3600)
  return `qesto_session=${token}`
}

export async function testHonoApp() {
  const db = new D1Mock()
  const kv = () => new KVMock() as unknown as KVNamespace

  const env = {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: TEST_SECRET,
    SEED_ADMIN_EMAIL,
    DB: db as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
    COMMIT_SHA: 'test',
    METRICS_AE: {
      writeDataPoint: () => {}, // mock Analytics Engine
    } as unknown as AnalyticsEngineDataset,
    AI: {
      run: async () => ({
        success: true,
        result: { response: 'mocked' },
      }),
    } as unknown as Ai,
    DECISIONS_VECTORIZE: undefined as unknown as VectorizeIndex,
  } as unknown as Env

  return {
    app: createApp(),
    env,
    db,
  }
}

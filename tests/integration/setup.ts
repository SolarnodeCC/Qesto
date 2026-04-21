import { createApp } from '../../functions/api/app'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

export async function testHonoApp() {
  const db = new D1Mock()
  const kv = () => new KVMock() as unknown as KVNamespace

  const env = {
    ENV: 'dev',
    APP_URL: 'http://local',
    JWT_SECRET: 'integration-test-secret-at-least-32-bytes!',
    DB: db as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
    COMMIT_SHA: 'test',
  } as unknown as Env

  return {
    app: createApp(),
    env,
  }
}

import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../functions/api/app'
import { hmacSha256Hex } from '../../functions/api/lib/webhooks'
import type { SessionWebhookPayload } from '../../functions/api/lib/template-schemas'
import type { Env } from '../../functions/api/types'
import { KVMock } from '../helpers/kv-mock'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'
const TEST_WEBHOOK_SECRET = 'marketing-webhook-secret-at-least-32-bytes!'

function makeEnv(createWorkflow: ReturnType<typeof vi.fn>): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: TEST_JWT_SECRET,
    MARKETING_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
    MARKETING_KV: new KVMock() as unknown as KVNamespace,
    WORKFLOWS: { create: createWorkflow },
  } as unknown as Env
}

describe('Marketing webhook (/api/webhooks/marketing)', () => {
  it('queues Cloudflare Workflows with params as the event payload', async () => {
    const workflowCreate = vi.fn(async () => ({ id: 'workflow_instance_1' }))
    const env = makeEnv(workflowCreate)
    const app = createApp()
    const payload: SessionWebhookPayload = {
      sessionId: 'sess_public_1',
      isPublic: true,
      language: 'en',
      sessionMode: 'reflection',
      questionCount: 3,
      participantCount: 12,
      responseRate: 0.75,
      durationMinutes: 18,
      energizerUsed: false,
    }
    const body = JSON.stringify(payload)
    const signature = `sha256=${await hmacSha256Hex(TEST_WEBHOOK_SECRET, body)}`

    const res = await app.fetch(
      new Request('http://local/api/webhooks/marketing', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-qesto-signature': signature,
        },
        body,
      }),
      env,
    )

    expect(res.status).toBe(200)
    expect(workflowCreate).toHaveBeenCalledWith({
      params: {
        sessionId: 'sess_public_1',
        language: 'en',
        questionCount: 3,
        participantCount: 12,
        durationMinutes: 18,
      },
    })
  })
})

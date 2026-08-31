import { describe, expect, it, vi } from 'vitest'
import { dispatchOperatorAlert } from '../../functions/api/lib/alert-paging'
import type { AlertResult } from '../../functions/api/lib/alerts'

describe('dispatchOperatorAlert', () => {
  it('no-ops for non-critical alerts', async () => {
    const result = await dispatchOperatorAlert({}, {
      fired: true,
      severity: 'warn',
      reasons: ['p95=600ms'],
      message: '[warn] route=GET /api/sessions p95=600ms',
    })
    expect(result).toEqual({ emailed: false, webhook: false })
  })

  it('posts to webhook when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const alert: AlertResult = {
      fired: true,
      severity: 'critical',
      reasons: ['durable_object_crash'],
      message: '[critical] route=SessionRoom durable_object_crash',
    }
    const result = await dispatchOperatorAlert(
      { OPS_ALERT_WEBHOOK: 'https://hooks.example.com/alerts' },
      alert,
    )
    expect(result.webhook).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

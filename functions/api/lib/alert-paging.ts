/**
 * OPS-ALERTS-PAGING-01 — dispatch critical operator alerts via email or webhook.
 *
 * Called when checkAlert() returns severity=critical. No PII in alert bodies.
 */
import { sendEmail } from './email'
import type { AlertResult } from './alerts'
import { logEvent } from './log'

export type AlertPagingEnv = {
  RESEND_API_KEY?: string
  RESEND_FROM?: string
  OPS_ALERT_EMAIL?: string
  OPS_ALERT_WEBHOOK?: string
  ENV?: string
}

export async function dispatchOperatorAlert(
  env: AlertPagingEnv,
  alert: AlertResult,
): Promise<{ emailed: boolean; webhook: boolean }> {
  if (!alert.fired || alert.severity !== 'critical') {
    return { emailed: false, webhook: false }
  }

  const subject = `[Qesto ${env.ENV ?? 'unknown'}] Critical alert`
  const text = alert.message
  const html = `<p><strong>Critical platform alert</strong></p><pre>${escapeHtml(alert.message)}</pre>`

  let emailed = false
  const to = env.OPS_ALERT_EMAIL?.trim()
  if (to) {
    const result = await sendEmail(env.RESEND_API_KEY, {
      to,
      subject,
      text,
      html,
      ...(env.RESEND_FROM ? { from: env.RESEND_FROM } : {}),
    })
    emailed = result.delivered
    logEvent({ event: 'ops.alert.email', detail: emailed ? 'delivered' : 'skipped' })
  }

  let webhook = false
  const hook = env.OPS_ALERT_WEBHOOK?.trim()
  if (hook) {
    try {
      const res = await fetch(hook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ severity: alert.severity, message: alert.message, reasons: alert.reasons }),
      })
      webhook = res.ok
      logEvent({ event: 'ops.alert.webhook', detail: webhook ? 'ok' : `http_${res.status}` })
    } catch {
      logEvent({ event: 'ops.alert.webhook', detail: 'failed' })
    }
  }

  if (!emailed && !webhook) {
    console.warn(JSON.stringify({ event: 'ops.alert.noop', message: alert.message }))
  }

  return { emailed, webhook }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

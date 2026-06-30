/**
 * DSA Art. 16 — Notice and action mechanism.
 * Public endpoint; accepts illegal-content reports and routes them to abuse@qesto.cc.
 * Rate-limited in app.ts (5 per 10 min per IP).
 */
import { Hono } from 'hono'
import type { Env } from '../types'
import type { ParentApp } from './parent-app'
import { sendEmail } from '../lib/email'
import { errorResponse } from '../lib/error-handler'

type Vars = Record<string, unknown>

type ReportBody = {
  contentLocation?: string
  illegalityType?: string
  description?: string
  notifierEmail?: string
}

export function mountReportContentRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  app.post('/', async (c) => {
    const body = await c.req.json<ReportBody>().catch((): ReportBody => ({}))
    const { contentLocation, illegalityType, description, notifierEmail } = body

    if (!contentLocation?.trim() || !illegalityType?.trim() || !notifierEmail?.trim()) {
      return errorResponse(c, 400, 'missing_fields', 'content_location, illegality_type, and notifier_email are required')
    }

    if (!notifierEmail.includes('@')) {
      return errorResponse(c, 400, 'invalid_email', 'notifier_email must be a valid email address')
    }

    const referenceId = `NaA-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
    const receivedAt = new Date().toISOString()
    const ip = c.req.header('cf-connecting-ip') ?? 'unknown'

    const reportText = [
      `DSA Art. 16 Content Report — ${referenceId}`,
      `Received: ${receivedAt}`,
      `Reporter IP: ${ip}`,
      ``,
      `Content location: ${contentLocation}`,
      `Illegality type: ${illegalityType}`,
      `Description: ${description?.trim() || '(none provided)'}`,
      `Notifier email: ${notifierEmail}`,
    ].join('\n')

    const escaped = reportText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // Forward to internal abuse mailbox
    await sendEmail(c.env.RESEND_API_KEY, {
      to: 'abuse@qesto.cc',
      subject: `[Content Report] ${illegalityType} — ${referenceId}`,
      text: reportText,
      html: `<pre style="font-family:monospace;white-space:pre-wrap">${escaped}</pre>`,
      from: 'Qesto Content Reports <noreply@qesto.cc>',
    })

    // Acknowledge to notifier (Art. 16(3) DSA)
    const ackText = [
      `Thank you for your report (reference: ${referenceId}).`,
      ``,
      `We have received your content notice and will review it in accordance with Art. 16 of the Digital Services Act (EU 2022/2065).`,
      ``,
      `We aim to send you a decision within 5 business days. If the reported content is found to be illegal, we will take appropriate action and notify you of our decision, including any available redress options.`,
      ``,
      `If you have questions, reply to this email or contact legal@qesto.cc.`,
      ``,
      `— Qesto Trust & Safety`,
    ].join('\n')

    await sendEmail(c.env.RESEND_API_KEY, {
      to: notifierEmail,
      subject: `Content report received — ${referenceId}`,
      text: ackText,
      html: `
        <p>Thank you for your report (<strong>${referenceId}</strong>).</p>
        <p>We have received your content notice and will review it in accordance with Art. 16 of the Digital Services Act (EU 2022/2065).</p>
        <p>We aim to send you a decision within 5 business days. If the reported content is found to be illegal, we will take appropriate action and notify you of our decision, including any available redress options.</p>
        <p>If you have questions, reply to this email or contact <a href="mailto:legal@qesto.cc">legal@qesto.cc</a>.</p>
        <p>— Qesto Trust &amp; Safety</p>
      `,
    })

    return c.json({ ok: true, referenceId, receivedAt })
  })

  parent.route('/api/report-content', app)
}

// Email delivery via Resend. In dev (no RESEND_API_KEY), log a redacted magic-link
// hint to console so developers can sign in without a mailbox (Cursor Cloud may
// scrub the token from terminal capture — seed D1 + callback instead; see AGENTS.md).

import { CircuitBreakers } from './resilience/circuit-breaker'
import { logEvent, logExternalFailure } from './log'

export type SendEmailArgs = {
  to: string
  subject: string
  html: string
  text: string
  from?: string
}

export async function sendEmail(apiKey: string | undefined, args: SendEmailArgs): Promise<{ delivered: boolean; id?: string }> {
  if (!apiKey) {
    // Dev/local fallback when Resend is unset. Keep the magic-link URL so local
    // sign-in works; redact recipient (PII). Cursor Cloud may still scrub the
    // 64-hex token from terminal capture — use D1 seed + callback (AGENTS.md).
    logEvent({
      event: 'email.dev_fallback',
      message: `[email:dev] to=[REDACTED] subject=${args.subject}\n${args.text}`,
    })
    return { delivered: false }
  }
  const from = args.from?.trim() || 'Qesto <noreply@qesto.cc>'
  const started = Date.now()

  return CircuitBreakers.resend.execute<{ delivered: boolean; id?: string }>(
    async (signal) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to: [args.to],
          subject: args.subject,
          html: args.html,
          text: args.text,
        }),
        signal,
      })
      if (!res.ok) {
        const body = await res.text()
        const err = new Error(`resend ${res.status}`)
        logExternalFailure(err, {
          traceId: 'email',
          route: 'email.send',
          operation: 'resend.emails',
          provider: 'resend',
          httpStatus: res.status,
          duration: Date.now() - started,
          outcome: 'http_error',
          details: { body_len: body.length },
        })
        throw err
      }
      const json = (await res.json()) as { id?: string }
      logEvent({
        event: 'email.sent',
        provider: 'resend',
        duration_ms: Date.now() - started,
        has_id: Boolean(json.id),
      })
      return json.id ? { delivered: true, id: json.id } : { delivered: true }
    },
    () => {
      // Resend circuit open — caller decides whether to retry later
      logExternalFailure(new Error('resend_circuit_open'), {
        traceId: 'email',
        route: 'email.send',
        operation: 'resend.circuit',
        provider: 'resend',
        duration: Date.now() - started,
        outcome: 'circuit_open',
      })
      return { delivered: false }
    },
  )
}

/**
 * Magic-link email for the template gallery's "use this template" flow
 * (MKTP-002): signs the visitor in (creating the account on first click, same
 * as the regular magic-link callback) and lands them on their new draft
 * session. `redirect` must be a relative path — the callback re-validates it.
 */
export function templateSessionEmail(appUrl: string, token: string, sessionPath: string, templateTitle: string) {
  const url = `${appUrl}/api/auth/callback?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(sessionPath)}`
  const subject = `Your "${templateTitle}" session is ready`
  const text = `We created a draft session from the "${templateTitle}" template.\n\nOpen it here (link valid 15 minutes; signing in creates your free Qesto account if you don't have one):\n\n${url}\n\nIf you didn't request this, ignore this email.`
  const html = `<p>We created a draft session from the <strong>${escapeHtml(templateTitle)}</strong> template.</p>
<p><a href="${url}" style="display:inline-block;padding:12px 20px;background:linear-gradient(135deg,#14B8A6,#8B5CF6);color:#fff;text-decoration:none;border-radius:8px;font-family:system-ui,sans-serif">Open your session</a></p>
<p>The link is valid for 15 minutes. Signing in creates your free Qesto account if you don't have one.</p>
<p>Or paste this URL into your browser: <br><code>${url}</code></p>
<p style="color:#525252;font-size:12px">If you didn't request this, you can ignore this email.</p>`
  return { url, subject, text, html }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function magicLinkEmail(appUrl: string, token: string) {
  const url = `${appUrl}/api/auth/callback?token=${encodeURIComponent(token)}`
  const subject = 'Sign in to Qesto'
  const text = `Sign in to Qesto by opening this link (valid 15 minutes):\n\n${url}\n\nIf you didn't request this, ignore this email.`
  const html = `<p>Sign in to Qesto by clicking the button below. The link is valid for 15 minutes.</p>
<p><a href="${url}" style="display:inline-block;padding:12px 20px;background:linear-gradient(135deg,#14B8A6,#8B5CF6);color:#fff;text-decoration:none;border-radius:8px;font-family:system-ui,sans-serif">Sign in</a></p>
<p>Or paste this URL into your browser: <br><code>${url}</code></p>
<p style="color:#525252;font-size:12px">If you didn't request this, you can ignore this email.</p>`
  return { url, subject, text, html }
}

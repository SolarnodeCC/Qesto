// Email delivery via Resend. In dev (no RESEND_API_KEY), log the magic link
// to console so developers can sign in without a mailbox.

export type SendEmailArgs = {
  to: string
  subject: string
  html: string
  text: string
}

export async function sendEmail(apiKey: string | undefined, args: SendEmailArgs): Promise<{ delivered: boolean; id?: string }> {
  if (!apiKey) {
    console.log(`[email:dev] to=${args.to} subject=${args.subject}\n${args.text}`)
    return { delivered: false }
  }
  const ac = new AbortController()
  const timeout = setTimeout(() => ac.abort(), 10_000)
  let res: Response
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Qesto <login@qesto.app>',
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
      signal: ac.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`resend ${res.status}: ${body}`)
  }
  const json = (await res.json()) as { id?: string }
  return json.id ? { delivered: true, id: json.id } : { delivered: true }
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

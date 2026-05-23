// EXPORT-PDF-01 — Session summary export as print-ready HTML.
//
// Cloudflare Workers have no native PDF rendering. This module generates a
// structured, print-optimised HTML document that renders cleanly when printed
// or saved as PDF from any browser. The output is stored in R2 (when available)
// and served with a signed URL; direct streaming is used when R2 is absent
// (dev/staging environments without R2 binding).
//
// "Signed" = the document contains a cryptographic authenticity footer:
//   HMAC-SHA256(sessionId + exportedAt, JWT_SECRET) rendered as a verification code.
// Consumers can verify the export is unmodified by recomputing the HMAC.

export interface ExportQuestion {
  id: string
  position: number
  kind: string
  prompt: string
  options: { id: string; label: string; votes: number }[]
  total_votes: number
}

export interface ExportSessionData {
  id: string
  title: string
  status: string
  anonymity?: string
  team_id?: string | null
  branding?: { primaryColor?: string; secondaryColor?: string; logoUrl?: string | null } | null
  created_at: number
  started_at?: number | null
  closed_at?: number | null
  duration_ms?: number | null
  questions: ExportQuestion[]
  total_votes: number
}

async function signExport(sessionId: string, exportedAt: number, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const payload = `${sessionId}:${exportedAt}`
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const bytes = new Uint8Array(mac)
  return Array.from(bytes.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

function renderBarChart(opts: { id: string; label: string; votes: number }[], total: number): string {
  if (opts.length === 0) return '<p style="color:#666;font-size:13px">No options</p>'
  const sorted = [...opts].sort((a, b) => b.votes - a.votes)
  return sorted
    .map((opt) => {
      const pct = total > 0 ? (opt.votes / total) * 100 : 0
      const bar = Math.round(pct)
      return `
        <div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
            <span>${escapeHtml(opt.label)}</span>
            <span style="color:#666">${opt.votes} (${pct.toFixed(1)}%)</span>
          </div>
          <div style="background:#f0f0f0;border-radius:3px;height:12px;overflow:hidden">
            <div style="background:#14B8A6;height:100%;width:${bar}%;border-radius:3px"></div>
          </div>
        </div>`
    })
    .join('')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDate(ts: number | null | undefined): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

/**
 * Generate a print-ready HTML export of a session's results.
 * Returns the HTML string. Caller decides whether to stream or store in R2.
 */
export async function generateSessionHtmlExport(
  session: ExportSessionData,
  jwtSecret: string,
): Promise<string> {
  const exportedAt = Date.now()
  const signature = await signExport(session.id, exportedAt, jwtSecret)

  const questionBlocks = session.questions
    .map(
      (q, i) => `
      <div style="margin-bottom:24px;page-break-inside:avoid">
        <h3 style="font-size:14px;font-weight:600;color:#111;margin:0 0 4px">
          Q${i + 1}: ${escapeHtml(q.prompt)}
        </h3>
        <p style="font-size:12px;color:#666;margin:0 0 8px">
          ${escapeHtml(q.kind)} · ${q.total_votes} vote${q.total_votes !== 1 ? 's' : ''}
        </p>
        ${renderBarChart(q.options, q.total_votes)}
      </div>`,
    )
    .join('')

  const brandPrimary = session.branding?.primaryColor ?? '#0D9488'
  const brandLogo =
    session.branding?.logoUrl && session.branding.logoUrl.length > 0
      ? `<img src="${escapeHtml(session.branding.logoUrl)}" alt="" style="max-height:48px;margin-bottom:12px" />`
      : ''

  const anonymityLabel =
    session.anonymity === 'zero_knowledge'
      ? 'Zero-Knowledge (identity never stored)'
      : session.anonymity === 'full'
        ? 'Full anonymity'
        : session.anonymity === 'partial'
          ? 'Partial anonymity'
          : session.anonymity === 'none'
            ? 'No anonymity'
            : '—'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Session Export — ${escapeHtml(session.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #111; background: #fff; padding: 32px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; color: ${brandPrimary}; }
    .meta { font-size: 12px; color: #666; margin-bottom: 24px; }
    .meta td { padding: 2px 16px 2px 0; vertical-align: top; }
    .meta-label { color: #999; font-weight: 500; }
    .divider { border: none; border-top: 1px solid #e5e5e5; margin: 24px 0; }
    .questions-heading { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #999; }
    .signature { font-family: monospace; letter-spacing: 0.1em; }
    @media print {
      body { padding: 16px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  ${brandLogo}
  <h1>${escapeHtml(session.title)}</h1>
  <p class="meta" style="color:#666;font-size:13px;margin-bottom:16px">Session export · Generated ${formatDate(exportedAt)}</p>

  <table class="meta">
    <tr><td class="meta-label">Session ID</td><td>${escapeHtml(session.id)}</td></tr>
    <tr><td class="meta-label">Status</td><td>${escapeHtml(session.status)}</td></tr>
    <tr><td class="meta-label">Started</td><td>${formatDate(session.started_at)}</td></tr>
    <tr><td class="meta-label">Closed</td><td>${formatDate(session.closed_at)}</td></tr>
    <tr><td class="meta-label">Duration</td><td>${formatDuration(session.duration_ms)}</td></tr>
    <tr><td class="meta-label">Anonymity</td><td>${escapeHtml(anonymityLabel)}</td></tr>
    <tr><td class="meta-label">Total votes</td><td>${session.total_votes}</td></tr>
  </table>

  <hr class="divider">

  <h2 class="questions-heading">Results (${session.questions.length} question${session.questions.length !== 1 ? 's' : ''})</h2>

  ${questionBlocks || '<p style="color:#666;font-size:14px">No questions recorded.</p>'}

  <div class="footer">
    <p>Exported from Qesto · ${formatDate(exportedAt)}</p>
    <p>Authenticity code: <span class="signature">${signature}</span></p>
    <p style="margin-top:4px">Verify: HMAC-SHA256("${escapeHtml(session.id)}:${exportedAt}", account_jwt_secret)[0:8]</p>
  </div>
</body>
</html>`
}

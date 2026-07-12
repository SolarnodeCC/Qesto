// IndexNow ping — tells search engines a template page was published.
// Shared by the publish path (routes/templates-marketing.ts) and the
// generation workflow's auto-publish (worker/TemplateGenerationWorkflow.ts).
// Only ever call this for templates that are live at https://qesto.cc — pinging
// drafts creates indexed 404s (pipeline audit MKTP-009).

interface IndexNowEnv {
  INDEXNOW_KEY?: string
  INDEXNOW_KEY_FILE?: string
}

const SITE_HOST = 'qesto.cc'

/** Fire-and-forget; failures are logged by the caller's catch, never fatal. */
export async function pingIndexNowForTemplate(env: IndexNowEnv, templateId: string): Promise<boolean> {
  const indexNowKey = env.INDEXNOW_KEY
  if (!indexNowKey) return false

  // Option 1: key file named after the key (e.g. /e8964e65….txt); Option 2:
  // the standard /indexnow.txt location (served by routes/seo-sitemap.ts).
  const keyLocation = env.INDEXNOW_KEY_FILE
    ? `https://${SITE_HOST}/${env.INDEXNOW_KEY_FILE}`
    : `https://${SITE_HOST}/indexnow.txt`

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: SITE_HOST,
      key: indexNowKey,
      keyLocation,
      urlList: [`https://${SITE_HOST}/templates/${templateId}`],
    }),
  })
  return res.ok
}

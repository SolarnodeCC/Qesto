import { Context } from 'hono'
import type { Env } from '../types'
import { listTemplates } from '../lib/templates-kv'

/**
 * SEO-SITEMAP-01: Dynamic sitemap generator for template pages
 * Fetches all templates from MARKETING_KV and generates XML sitemap
 * Cacheable for 24 hours to avoid KV hammering
 */
export async function getDynamicSitemap(c: Context<{ Bindings: Env }>) {
  try {
    if (!c.env.MARKETING_KV) {
      return c.text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', 200)
    }

    const baseUrl = 'https://qesto.cc'
    const templates = await listTemplates(c.env.MARKETING_KV)

    // Build sitemap XML
    const urls = templates
      .filter((t) => !t.isDiscarded && t.isPublic)
      .map((t) => {
        const changefreq = t.usageCount > 10 ? 'weekly' : 'monthly'
        const priority = t.usageCount > 20 ? '0.8' : '0.7'
        return `  <url>
    <loc>${baseUrl}/templates/${t.id}</loc>
    <lastmod>${t.updatedAt}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
      })
      .join('\n')

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

    // Cache for 24 hours (86400 seconds)
    c.header('Content-Type', 'application/xml; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=86400')

    return c.text(sitemapXml)
  } catch (error) {
    console.error('[seo-sitemap] Error generating sitemap:', error)
    return c.json({ error: 'Failed to generate sitemap' }, 500)
  }
}

/**
 * SEO-SITEMAP-02: Sitemap index for multi-part sitemaps
 * References both static and dynamic sitemaps
 */
export async function getSitemapIndex(c: Context<{ Bindings: Env }>) {
  const baseUrl = 'https://qesto.cc'
  const now = new Date().toISOString().split('T')[0]

  const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-static.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/sitemap-templates.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`

  c.header('Content-Type', 'application/xml; charset=utf-8')
  c.header('Cache-Control', 'public, max-age=86400')

  return c.text(sitemapIndexXml)
}

/**
 * SEO-INDEXNOW-01: IndexNow key file endpoint
 * Serves at multiple locations for flexibility:
 * - /.well-known/indexnow (Option 2 - recommended)
 * - /indexnow.txt (Option 2 - alternative)
 * - /{key}.txt (Option 1 - if INDEXNOW_KEY_FILE env var matches)
 *
 * Returns plain UTF-8 text file (not JSON/HTML wrapped)
 * Required by IndexNow API specification
 */
export function getIndexNowKey(c: Context<{ Bindings: Env }>) {
  const key = c.env.INDEXNOW_KEY
  if (!key) {
    return c.text('IndexNow key not configured', 404)
  }
  // Serve as plain text file, not wrapped in any markup
  c.header('Content-Type', 'text/plain; charset=utf-8')
  c.header('Cache-Control', 'public, max-age=604800') // 7 days
  return c.text(key, 200)
}

/**
 * SEO-INDEXNOW-02: Dynamic key file endpoint for Option 1
 * Serves key at /{INDEXNOW_KEY_FILE}.txt if configured
 * Allows hosting key file with dynamic filename matching the key itself
 */
export function getIndexNowKeyFile(c: Context<{ Bindings: Env }>) {
  const key = c.env.INDEXNOW_KEY
  const keyFilename = c.env.INDEXNOW_KEY_FILE

  if (!key || !keyFilename) {
    return c.notFound()
  }

  // Return the key as plain UTF-8 text
  c.header('Content-Type', 'text/plain; charset=utf-8')
  c.header('Cache-Control', 'public, max-age=604800')
  return c.text(key, 200)
}

/**
 * Mount SEO routes (public, no auth required)
 * Supports both IndexNow options:
 * - Option 1: /{key}.txt (if INDEXNOW_KEY_FILE env var is set)
 * - Option 2: /.well-known/indexnow or /indexnow.txt
 */
export function mountSeoRoutes(app: any) {
  // Sitemaps
  app.get('/sitemap.xml', getDynamicSitemap)
  app.get('/sitemap-index.xml', getSitemapIndex)
  app.get('/sitemap-templates.xml', getDynamicSitemap)

  // IndexNow key endpoints (try in order: Option 2 standard locations)
  app.get('/.well-known/indexnow', getIndexNowKey)
  app.get('/indexnow.txt', getIndexNowKey)

  // Option 1: Dynamic key file (if INDEXNOW_KEY_FILE configured)
  // Example: if INDEXNOW_KEY_FILE="e8964e65669d47a69dd02b32bfe2a64e"
  // serves at https://qesto.cc/e8964e65669d47a69dd02b32bfe2a64e.txt
  app.get('/:keyFile.txt', getIndexNowKeyFile)
}

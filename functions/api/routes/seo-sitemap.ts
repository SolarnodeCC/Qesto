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
 * SEO-SITEMAP-03: IndexNow key file endpoint
 * Required by IndexNow API; served at /.well-known/indexnow
 * Cloudflare needs to serve this from the domain root
 */
export function getIndexNowKey(c: Context<{ Bindings: Env }>) {
  const key = c.env.INDEXNOW_KEY
  if (!key) {
    return c.text('IndexNow key not configured', 404)
  }
  c.header('Content-Type', 'text/plain')
  return c.text(key)
}

/**
 * Mount SEO routes (public, no auth required)
 */
export function mountSeoRoutes(app: any) {
  app.get('/sitemap.xml', getDynamicSitemap)
  app.get('/sitemap-index.xml', getSitemapIndex)
  app.get('/sitemap-templates.xml', getDynamicSitemap)
  app.get('/.well-known/indexnow', getIndexNowKey)
}

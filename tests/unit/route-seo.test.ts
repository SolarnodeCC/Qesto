import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ROUTE_SEO, renderFallbackHtml, resolveRouteSeo } from '../../functions/seo-meta'

const sitemapPath = fileURLToPath(new URL('../../public/sitemap.xml', import.meta.url))
const robotsPath = fileURLToPath(new URL('../../public/robots.txt', import.meta.url))
const indexHtmlPath = fileURLToPath(new URL('../../index.html', import.meta.url))
const sitemapXml = readFileSync(sitemapPath, 'utf8')
const robotsTxt = readFileSync(robotsPath, 'utf8')
const indexHtml = readFileSync(indexHtmlPath, 'utf8')

function sitemapPaths(): string[] {
  const locs = [...sitemapXml.matchAll(/<loc>https:\/\/qesto\.cc([^<]*)<\/loc>/g)].map((m) => m[1])
  // Normalize "" (https://qesto.cc) to "/"
  return locs.map((p) => (p === '' ? '/' : p))
}

describe('edge route SEO metadata (Finding 1: duplicate metadata across routes)', () => {
  it('has a ROUTE_SEO entry for every URL in the static sitemap (drift guard)', () => {
    const missing = sitemapPaths().filter((p) => !ROUTE_SEO[p])
    expect(missing).toEqual([])
  })

  it('includes Wave 0 marketing URLs that used to be missing from the sitemap', () => {
    const paths = sitemapPaths()
    for (const required of [
      '/templates',
      '/trust/gdpr',
      '/trust/soc2',
      '/marketplace',
      '/developers',
      '/partner/sla',
    ]) {
      expect(paths).toContain(required)
    }
  })

  it('resolves distinct titles and descriptions per marketing route', () => {
    const routes = ['/', '/pricing', '/features/ai-insights', '/templates', '/use-cases/workshops']
    const titles = routes.map((r) => resolveRouteSeo(r)?.title)
    const descriptions = routes.map((r) => resolveRouteSeo(r)?.description)

    expect(titles.every(Boolean)).toBe(true)
    expect(new Set(titles).size).toBe(routes.length)
    expect(new Set(descriptions).size).toBe(routes.length)
  })

  it('never canonicalizes a subpage to the homepage', () => {
    for (const [path, seo] of Object.entries(ROUTE_SEO)) {
      if (path === '/') continue
      expect(seo.canonicalPath).not.toBe('/')
      expect(seo.canonicalPath).toBe(path)
    }
  })

  it('gives /templates/:id a self-referencing canonical, not the homepage', () => {
    const seo = resolveRouteSeo('/templates/team-retro-123')
    expect(seo).not.toBeNull()
    expect(seo?.canonicalPath).toBe('/templates/team-retro-123')
  })

  it('normalizes trailing slashes', () => {
    expect(resolveRouteSeo('/pricing/')?.canonicalPath).toBe('/pricing')
  })

  it('returns null for app / noindex routes so the shell is left untouched', () => {
    expect(resolveRouteSeo('/dashboard')).toBeNull()
    expect(resolveRouteSeo('/login')).toBeNull()
    expect(resolveRouteSeo('/sessions/abc/present')).toBeNull()
  })

  it('renders a per-route no-JS fallback containing that route h1', () => {
    const pricing = renderFallbackHtml(ROUTE_SEO['/pricing'])
    const home = renderFallbackHtml(ROUTE_SEO['/'])
    expect(pricing).toContain('Start free. Pay when a room depends on it.')
    expect(home).toContain('Feel the pulse of the room')
    expect(pricing).not.toBe(home)
    // Cross-linking nav is present for link equity.
    expect(pricing).toContain('href="/features/ai-insights"')
  })

  it('ships edge JSON-LD for pricing (FAQPage) and templates (CollectionPage without SearchAction)', () => {
    const pricingLd = ROUTE_SEO['/pricing'].jsonLd as Record<string, unknown>
    expect(pricingLd['@type']).toBe('FAQPage')
    expect(Array.isArray(pricingLd.mainEntity)).toBe(true)

    const templatesLd = ROUTE_SEO['/templates'].jsonLd as Record<string, unknown>
    expect(templatesLd['@type']).toBe('CollectionPage')
    expect(templatesLd).not.toHaveProperty('potentialAction')
  })

  it('pricing title targets live-polling commercial intent', () => {
    expect(ROUTE_SEO['/pricing'].title.toLowerCase()).toContain('live polling')
    expect(ROUTE_SEO['/pricing'].description.toLowerCase()).toContain('start free')
  })
})

describe('Wave 0/1 shell + robots foundations', () => {
  it('index.html robots is index,follow,noimageai and Offer currency is EUR', () => {
    expect(indexHtml).toMatch(/name="robots"\s+content="index, follow, noimageai"/)
    expect(indexHtml).toContain('"priceCurrency": "EUR"')
    expect(indexHtml).not.toContain('"priceCurrency": "USD"')
  })

  it('robots.txt prefers sitemap-index and keeps custom Disallows', () => {
    expect(robotsTxt).toContain('Sitemap: https://qesto.cc/sitemap-index.xml')
    expect(robotsTxt).toContain('Disallow: /api/')
    expect(robotsTxt).toContain('Disallow: /dashboard')
  })
})

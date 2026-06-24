import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ROUTE_SEO, renderFallbackHtml, resolveRouteSeo } from '../../functions/seo-meta'

const sitemapPath = fileURLToPath(new URL('../../public/sitemap.xml', import.meta.url))
const sitemapXml = readFileSync(sitemapPath, 'utf8')

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
})

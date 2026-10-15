import { describe, expect, it } from 'vitest'
import { COMPARE_HUB_LINKS, COMPETITOR_PAGES } from '../../src/pages/vs/compareData'
import { ROUTE_SEO } from '../../functions/seo-meta'

describe('competitor comparison SEO pages', () => {
  it('publishes Mentimeter, Slido, and Parabol with matching ROUTE_SEO + hub links', () => {
    for (const slug of ['mentimeter', 'slido', 'parabol'] as const) {
      expect(COMPETITOR_PAGES[slug]).toBeTruthy()
      expect(ROUTE_SEO[`/vs/${slug}`]?.canonicalPath).toBe(`/vs/${slug}`)
      expect(ROUTE_SEO[`/vs/${slug}`]?.title.toLowerCase()).toContain(slug)
    }
    expect(COMPARE_HUB_LINKS.map((c) => c.slug).sort()).toEqual(['mentimeter', 'parabol', 'slido'])
    expect(ROUTE_SEO['/compare']?.canonicalPath).toBe('/compare')
  })

  it('keeps comparison tables non-empty and cites a sources note', () => {
    for (const page of Object.values(COMPETITOR_PAGES)) {
      expect(page.rows.length).toBeGreaterThanOrEqual(5)
      expect(page.whoQestoSuits.length).toBeGreaterThan(0)
      expect(page.migrationSteps.length).toBeGreaterThan(0)
      expect(page.sourcesNote.toLowerCase()).toContain('knowledge-base')
    }
  })
})

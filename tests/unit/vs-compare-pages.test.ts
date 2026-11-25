/**
 * Requirement: SEO Wave 2 competitor pages (#847) — every published /vs slug has
 * matching ROUTE_SEO edge metadata and a compare-hub link (SPEC_FRONTEND marketing routes).
 */
import { readFileSync } from 'node:fs'
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

describe('pricing FAQ structured data', () => {
  // Google requires FAQPage markup to match the visible FAQ. The edge copy in
  // functions/seo-meta.ts is hand-maintained, so pin it to Pricing.tsx.
  it('edge FAQPage JSON-LD matches the FAQ rendered by Pricing.tsx', () => {
    const pricingSrc = readFileSync('src/pages/Pricing.tsx', 'utf8')
    const jsonLd = ROUTE_SEO['/pricing'].jsonLd as {
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>
    }
    expect(jsonLd.mainEntity.length).toBeGreaterThan(0)
    for (const q of jsonLd.mainEntity) {
      expect(pricingSrc, q.name).toContain(q.name)
      expect(pricingSrc, q.name).toContain(q.acceptedAnswer.text)
    }
  })
})

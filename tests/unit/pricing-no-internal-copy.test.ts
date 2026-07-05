import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Regression guard for issue #607 (Critical): internal/technical copy must not
// leak onto the customer-facing pricing page — Stripe price IDs, internal
// source-badge tags ("Roadmap"/"Static copy"), internal API/quota identifiers,
// and dev-only "review before launch" footnotes were all rendered to buyers.
const PRICING = readFileSync(join(process.cwd(), 'src/pages/Pricing.tsx'), 'utf8')

describe('pricing page does not expose internal/technical copy (#607)', () => {
  it('does not render Stripe price identifiers', () => {
    expect(PRICING).not.toMatch(/Stripe prices/i)
    expect(PRICING).not.toContain('starterPriceIds')
    expect(PRICING).not.toMatch(/price_[A-Za-z0-9]/) // literal Stripe price id
  })

  it('does not render internal source-badge tags in the feature matrix', () => {
    expect(PRICING).not.toContain('SourceBadge')
    expect(PRICING).not.toMatch(/'Static copy'|"Static copy"|>\s*Static copy/)
  })

  it('does not expose internal API / quota identifiers to customers', () => {
    expect(PRICING).not.toContain('PLAN_QUOTAS')
    expect(PRICING).not.toContain('/api/plans/catalog')
  })

  it('does not show a dev-only "review before launch" footnote', () => {
    expect(PRICING).not.toMatch(/review against product\/commerce plans before/i)
  })

  it('does not make the unsubstantiated "Most chosen" claim', () => {
    expect(PRICING).not.toMatch(/Most chosen/i)
  })
})

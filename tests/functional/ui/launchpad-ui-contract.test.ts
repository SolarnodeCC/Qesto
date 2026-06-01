import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const launchpadSource = readFileSync('src/pages/Launchpad.tsx', 'utf8')
const layoutSource = readFileSync('src/layouts/MainLayout.tsx', 'utf8')
const stylesSource = readFileSync('src/styles.css', 'utf8')
const aiNarrativeSource = readFileSync('src/components/AINarrative.tsx', 'utf8')
const enComponents = JSON.parse(readFileSync('public/locales/en/components.json', 'utf8')) as {
  aiNarrative: Record<string, string>
}

describe('Sprint 23 polish contract', () => {
  it('keeps Launchpad edit and reorder controls wired to draft APIs', () => {
    expect(launchpadSource).toContain('/questions/reorder')
    expect(launchpadSource).toContain('/questions/${encodeURIComponent(editingId)}')
    expect(launchpadSource).toContain('setAddingQuestion(true)')
    expect(launchpadSource).toContain('refreshPreFlight')
  })

  it('keeps primary CTA motion tokenized and reusable', () => {
    expect(stylesSource).toContain('.btn-motion')
    expect(stylesSource).toContain('transform: scale(1.02)')
    expect(stylesSource).toContain('box-shadow: var(--shadow-teal)')
    expect(launchpadSource).toContain('btn-motion')
  })

  it('keeps the Qesto brand mark visible and AI copy accurate', () => {
    expect(layoutSource).toContain('Sparkle mark')
    expect(layoutSource).toContain('Qesto')
    expect(aiNarrativeSource).toContain("useT('components')")
    expect(enComponents.aiNarrative.body1).toContain('Workers AI on Cloudflare')
    expect(enComponents.aiNarrative.body1).not.toContain('on-device')
  })
})

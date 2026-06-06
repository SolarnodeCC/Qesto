import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const launchpadSource = readFileSync('src/pages/Launchpad.tsx', 'utf8')
const questionListSource = readFileSync('src/components/launchpad/QuestionList.tsx', 'utf8')
const joinCodeSource = readFileSync('src/components/launchpad/JoinCodePanel.tsx', 'utf8')
const layoutSource = readFileSync('src/layouts/MainLayout.tsx', 'utf8')
const stylesSource = readFileSync('src/styles.css', 'utf8')
const aiNarrativeSource = readFileSync('src/components/AINarrative.tsx', 'utf8')
const enComponents = JSON.parse(readFileSync('public/locales/en/components.json', 'utf8')) as {
  aiNarrative: Record<string, string>
}

describe('Sprint 23 polish contract', () => {
  it('keeps Launchpad edit and reorder controls wired to draft APIs', () => {
    // Launchpad was refactored to sub-components; QuestionList.tsx owns question editing
    // reorder lives in Launchpad.tsx; per-question PATCH is in QuestionList.tsx
    expect(launchpadSource + questionListSource).toContain('/questions/reorder')
    expect(questionListSource).toContain('/questions/${encodeURIComponent(editingId)}')
    expect(questionListSource).toContain('setAddingQuestion(true)')
    // refreshPreFlight lives in JoinCodePanel after extraction
    const allSource = launchpadSource + questionListSource + joinCodeSource
    expect(allSource).toContain('refreshPreFlight')
  })

  it('keeps primary CTA motion tokenized and reusable', () => {
    expect(stylesSource).toContain('.btn-motion')
    expect(stylesSource).toContain('transform: scale(1.02)')
    expect(stylesSource).toContain('box-shadow: var(--shadow-teal)')
    // btn-motion used somewhere in launchpad surface
    const launchpadSurface = launchpadSource + questionListSource + joinCodeSource
    expect(launchpadSurface).toContain('btn-motion')
  })

  it('keeps the Qesto brand mark visible and AI copy accurate', () => {
    expect(layoutSource).toContain('Sparkle mark')
    expect(layoutSource).toContain('Qesto')
    expect(aiNarrativeSource).toContain("useT('components')")
    expect(enComponents.aiNarrative.body1).toContain('Workers AI on Cloudflare')
    expect(enComponents.aiNarrative.body1).not.toContain('on-device')
  })
})

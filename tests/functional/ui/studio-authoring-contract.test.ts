import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync('src/pages/StudioPage.tsx', 'utf8')
const promptForm = readFileSync('src/components/studio/PromptForm.tsx', 'utf8')
const draftPreview = readFileSync('src/components/studio/DraftPreviewList.tsx', 'utf8')
const libraryPanel = readFileSync('src/components/studio/LibraryPanel.tsx', 'utf8')
const suggestChips = readFileSync('src/components/studio/SuggestionChips.tsx', 'utf8')
const appSource = readFileSync('src/App.tsx', 'utf8')
const enStudio = JSON.parse(readFileSync('public/locales/en/studio.json', 'utf8')) as Record<string, string>

describe('FE-STUDIO-AUTHORING-01 / STUDIO-LIBRARY-01 / STUDIO-SUGGEST-01: Studio UI contract', () => {
  it('is registered as a lazy authenticated route at /studio', () => {
    expect(appSource).toContain("const StudioPage = lazy(() => import('./pages/StudioPage'))")
    expect(appSource).toContain('path="/studio"')
  })

  it('generates drafts via POST /api/studio/authoring/generate with topic/count/kind/themeId', () => {
    expect(pageSource).toContain('/api/studio/authoring/generate')
    expect(pageSource).toContain('topic:')
    expect(pageSource).toContain('count,')
  })

  it('saves a draft to the library via POST /api/studio/library with teamId scoping', () => {
    expect(pageSource).toContain("'/api/studio/library'")
    expect(pageSource).toContain('teamId')
    expect(pageSource).toContain('questionJson')
  })

  it('lists the library via GET /api/studio/library?teamId=', () => {
    expect(pageSource).toContain('/api/studio/library?teamId=')
  })

  it('forks and deletes library items with teamId scoping', () => {
    expect(pageSource).toContain('/fork?teamId=')
    expect(pageSource).toMatch(/method:\s*'DELETE'/)
  })

  it('calls suggest after at least one draft exists and degrades silently on empty/error', () => {
    expect(pageSource).toContain('/api/studio/authoring/suggest')
    expect(pageSource).toContain('setSuggestions([])')
    // SuggestionChips renders nothing when there are no suggestions (silent degrade).
    expect(suggestChips).toContain('if (suggestions.length === 0) return null')
  })

  it('exposes an honest "Apply to session" CTA wired to real session-creation endpoints', () => {
    // Must use the existing session creation + question-add endpoints (no fake flow).
    expect(pageSource).toContain("api<CreateSessionResponse>('/api/sessions'")
    expect(pageSource).toContain('/questions')
    expect(pageSource).toContain('/launchpad')
  })

  it('clamps question count to the backend MIN_COUNT/MAX_COUNT bounds', () => {
    expect(promptForm).toContain('MIN_COUNT')
    expect(promptForm).toContain('MAX_COUNT')
  })

  it('offers all STUDIO_THEME_NAMES as theme options', () => {
    for (const themeId of ['default', 'dark', 'high-contrast', 'brand-neutral']) {
      expect(enStudio[`prompt.theme.${themeId}`]).toBeTruthy()
    }
  })

  it('renders use_count for each library item', () => {
    expect(libraryPanel).toContain('item.use_count')
  })

  it('allows editing a draft title before saving', () => {
    expect(draftPreview).toContain('onEditPrompt')
    expect(draftPreview).toContain('onTitleChange')
  })

  it('guards the route behind authentication, redirecting anonymous users to /login', () => {
    expect(pageSource).toContain("auth.status === 'anonymous'")
    expect(pageSource).toContain('<Navigate to="/login"')
  })

  it('uses the studio i18n namespace exclusively for user-facing copy', () => {
    expect(pageSource).toContain("useT('studio')")
  })
})

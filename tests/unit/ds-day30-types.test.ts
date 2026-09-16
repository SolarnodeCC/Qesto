/**
 * DS Day 1–30 — session status label helper + branding type re-export.
 */
import { describe, it, expect } from 'vitest'
import { sessionStatusLabel } from '../../src/lib/session-status-label'
import type { SessionBranding as FromTypes } from '../../src/types/session'
import type { SessionBranding as FromLib } from '../../src/lib/branding'
import type { TemplateGalleryRecord } from '../../src/types/template-gallery'

describe('sessionStatusLabel', () => {
  const t = (key: string) => `t:${key}`
  it('maps each lifecycle status to an i18n key', () => {
    expect(sessionStatusLabel('live', t)).toBe('t:statusLive')
    expect(sessionStatusLabel('energizing', t)).toBe('t:statusEnergizing')
    expect(sessionStatusLabel('closed', t)).toBe('t:statusClosed')
    expect(sessionStatusLabel('archived', t)).toBe('t:statusArchived')
    expect(sessionStatusLabel('draft', t)).toBe('t:statusDraft')
  })
})

describe('type consolidation', () => {
  it('SessionBranding is shared between types/session and lib/branding', () => {
    const branding: FromTypes = { logoUrl: null, primaryColor: '#14B8A6' }
    const viaLib: FromLib = branding
    expect(viaLib.primaryColor).toBe('#14B8A6')
  })

  it('TemplateGalleryRecord is the gallery SoT shape', () => {
    const sample: TemplateGalleryRecord = {
      id: 't1',
      title: { nl: 'a', en: 'a', de: 'a', fr: 'a' },
      purpose: { nl: 'p', en: 'p', de: 'p', fr: 'p' },
      bestUsedFor: { nl: [], en: [], de: [], fr: [] },
      estimatedMinutes: 30,
      questions: [],
      industry: 'general',
      theme: 'team-wellbeing',
      topic: 'x',
      usageCount: 0,
      createdAt: '2026-01-01',
    }
    expect(sample.id).toBe('t1')
  })
})

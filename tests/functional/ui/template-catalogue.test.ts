import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dashboardSource = readFileSync('src/pages/Dashboard.tsx', 'utf8')
const enDashboard = JSON.parse(readFileSync('public/locales/en/dashboard.json', 'utf8')) as Record<string, string>

describe('template catalogue UI contract', () => {
  it('keeps template cards behind an explicit overview confirmation', () => {
    expect(dashboardSource).toContain('setModal({ open: true, template')
    expect(dashboardSource).toContain('handleUseTemplate')
    expect(dashboardSource).not.toContain('handleCreateFromTemplate')
    expect(dashboardSource).not.toContain('create(template.name)')
  })

  it('declares copy for all rendered Qesto topic groups', () => {
    for (const topic of ['team', 'product', 'learning']) {
      expect(enDashboard[`templateTopic.${topic}`]).toBeTruthy()
      expect(enDashboard[`templateTopicSubtitle.${topic}`]).toBeTruthy()
    }
  })

  it('renders accessible preview art with stable dimensions', () => {
    expect(dashboardSource).toContain('role="img"')
    expect(dashboardSource).toContain('aria-label={tmpl.previewAlt}')
    expect(dashboardSource).toContain('className="h-24')
    expect(dashboardSource).toContain('className="h-32')
  })
})

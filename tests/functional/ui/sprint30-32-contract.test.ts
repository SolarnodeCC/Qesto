import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Sprint 30-32 enterprise release contract', () => {
  it('keeps admin engagement analytics aggregate and export-safe', () => {
    const adminRoutes = readFileSync('functions/api/routes/admin/platform/analytics.ts', 'utf8')
    const analyticsTab = readFileSync('src/components/admin/AdminAnalyticsTab.tsx', 'utf8')

    expect(adminRoutes).toContain('energizer_activations')
    expect(adminRoutes).toContain('badge_breakdown')
    expect(analyticsTab).toContain('energizer_dropouts')
    expect(analyticsTab).toContain('geen vraagtekst, vrije tekst, e-mailadressen of tokens')
  })

  it('keeps energizer activation permissioned separately from session lifecycle', () => {
    const authz = readFileSync('functions/api/lib/authz.ts', 'utf8')
    const teamSettings = readFileSync('src/pages/TeamSettings.tsx', 'utf8')
    const room = readFileSync('functions/api/SessionRoom.ts', 'utf8')
    const audit = readFileSync('src/components/AuditLogViewer.tsx', 'utf8')

    expect(authz).toContain("'energizer:activate'")
    expect(teamSettings).toContain('Activate energizers')
    expect(room).toContain('canActivateEnergizer')
    expect(room).toContain('ws.energizer_activation_denied')
    expect(audit).toContain('ws.energizer_completed')
  })

  it('documents the release-candidate scope and rollout gates', () => {
    const sprint30 = readFileSync('docs/SPRINT30_IMPLEMENTATION_SPEC.md', 'utf8')
    const sprint31 = readFileSync('docs/SPRINT31_IMPLEMENTATION_SPEC.md', 'utf8')
    const sprint32 = readFileSync('docs/SPRINT32_IMPLEMENTATION_SPEC.md', 'utf8')
    const rollout = readFileSync('docs/V2_2_ROLLOUT_PLAN.md', 'utf8')

    expect(sprint30).toContain('no raw prompts')
    expect(sprint31).toContain('energizer:activate')
    expect(sprint32).toContain('release candidate')
    expect(rollout).toContain('Rollback Trigger')
  })
})

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const teamSettingsSource = readFileSync('src/pages/TeamSettings.tsx', 'utf8')
const adminAnalyticsSource = readFileSync('src/components/admin/AdminAnalyticsTab.tsx', 'utf8')
const realtimeSource = readFileSync('functions/api/realtime.ts', 'utf8')
const sessionRoomSource = readFileSync('functions/api/SessionRoom.ts', 'utf8')
const sprint24Spec = readFileSync('docs/SPRINT24_IMPLEMENTATION_SPEC.md', 'utf8')
const adr0005 = readFileSync('docs/adr/ADR-0005-do-protocol-versioning.md', 'utf8')

describe('Sprint 24 contract', () => {
  it('documents and enforces the v1 Durable Object protocol envelope', () => {
    expect(adr0005).toContain('Current version: `1`')
    expect(realtimeSource).toContain('LIVE_PROTOCOL_VERSION = 1')
    expect(sessionRoomSource).toContain('unsupported_protocol')
  })

  it('keeps custom role management wired into team settings', () => {
    expect(teamSettingsSource).toContain('/roles')
    expect(teamSettingsSource).toContain('team:manage_members')
    expect(teamSettingsSource).toContain('Assign role')
    expect(teamSettingsSource).toContain('Unassign')
  })

  it('keeps admin analytics exportable from sanitized aggregate data', () => {
    expect(adminAnalyticsSource).toContain('Export CSV')
    expect(adminAnalyticsSource).toContain('qesto-admin-analytics.csv')
    expect(adminAnalyticsSource).not.toContain('email')
    expect(adminAnalyticsSource).not.toContain('prompt')
  })

  it('tracks Sprint 24 committed scope in the implementation spec', () => {
    for (const item of ['DO-PROTOCOL-ADR-01', 'AUTHZ-ROLE-UI-01', 'ADMIN-ANALYTICS-01', 'BACKLOG-HYGIENE-01']) {
      expect(sprint24Spec).toContain(item)
    }
  })
})

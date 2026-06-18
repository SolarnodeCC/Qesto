import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync('src/pages/ConnectJoinPage.tsx', 'utf8')
const appSource = readFileSync('src/App.tsx', 'utf8')
const enConnect = JSON.parse(readFileSync('public/locales/en/connect.json', 'utf8')) as Record<string, string>

describe('FE-CONNECT-JOIN-UI-01: federation join UI contract', () => {
  it('is registered as a lazy authenticated route at /connect/join', () => {
    expect(appSource).toContain("const ConnectJoinPage = lazy(() => import('./pages/ConnectJoinPage'))")
    expect(appSource).toContain('path="/connect/join"')
  })

  it('posts the invite token + joiningTeamId to the federation join endpoint', () => {
    expect(pageSource).toContain('/api/federation/connect/join')
    expect(pageSource).toContain('joiningTeamId')
    expect(pageSource).toMatch(/method:\s*'POST'/)
  })

  it('renders tenantCount as an aggregate-only stat, never a tenant name/identity field', () => {
    expect(pageSource).toContain('tenantCount')
    expect(pageSource).toContain("t('join.tenantCount'")
    // Privacy guarantee (ADR-0062): the response's `member` object only exposes
    // teamId/scope/regionId/joinedAt for the CALLER's own membership — the UI must
    // never read or render another tenant's name. Guard against accidental fields
    // like hostName / tenantNames / members[] (a list would leak other tenants).
    expect(pageSource).not.toMatch(/tenantNames|hostName|otherTeam|members\[/i)
  })

  it('maps each documented error code to a friendly keyed message', () => {
    for (const code of ['invite_invalid', 'forbidden', 'already_member', 'federation_disabled', 'kv_unavailable', 'not_found']) {
      expect(pageSource).toContain(code)
    }
  })

  it('guards the route behind authentication, redirecting anonymous users to /login', () => {
    expect(pageSource).toContain("auth.status === 'anonymous'")
    expect(pageSource).toContain('<Navigate to="/login"')
  })

  it('uses the connect i18n namespace exclusively for user-facing copy', () => {
    expect(pageSource).toContain("useT('connect')")
  })

  it('ships EN locale keys for every error code and the success state', () => {
    expect(enConnect['join.tenantCount_one']).toBeTruthy()
    expect(enConnect['join.tenantCount_other']).toBeTruthy()
    expect(enConnect['error.invite_invalid']).toBeTruthy()
    expect(enConnect['error.already_member']).toBeTruthy()
    expect(enConnect['join.privacyNote']).toMatch(/never reveals/i)
  })
})

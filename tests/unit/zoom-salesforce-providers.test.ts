import { describe, expect, it } from 'vitest'
import { getZoomProvider } from '../../functions/api/lib/integrations/providers/zoom'
import { getSalesforceProvider } from '../../functions/api/lib/integrations/providers/salesforce'

describe('Zoom provider (Sprint 40)', () => {
  it('returns null when credentials missing', () => {
    expect(getZoomProvider({})).toBeNull()
  })

  it('builds authorize URL with API_URL callback', () => {
    const p = getZoomProvider({
      ZOOM_CLIENT_ID: 'cid',
      ZOOM_CLIENT_SECRET: 'sec',
      API_URL: 'https://api.example.com',
    })
    expect(p).not.toBeNull()
    const url = p!.getAuthUrl('state-token', '')
    expect(url).toContain('zoom.us/oauth/authorize')
    expect(url).toContain('state=state-token')
  })
})

describe('Salesforce provider (Sprint 40)', () => {
  it('returns null when credentials missing', () => {
    expect(getSalesforceProvider({})).toBeNull()
  })

  it('builds authorize URL with API_URL callback', () => {
    const p = getSalesforceProvider({
      SALESFORCE_CLIENT_ID: 'cid',
      SALESFORCE_CLIENT_SECRET: 'sec',
      API_URL: 'https://api.example.com',
    })
    expect(p).not.toBeNull()
    const url = p!.getAuthUrl('sf-state', '')
    expect(url).toContain('login.salesforce.com')
    expect(url).toContain('state=sf-state')
  })
})

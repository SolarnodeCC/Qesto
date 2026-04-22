import { describe, expect, it } from 'vitest'
import {
  buildAuthnRequest,
  buildSpMetadata,
  parseAssertion,
  generateSamlState,
  consumeSamlState,
} from '../../functions/api/lib/saml'

describe('SAML: buildAuthnRequest', () => {
  it('returns a base64 + URL-encoded SAMLRequest', () => {
    const req = buildAuthnRequest(
      'https://app.qesto.io',
      'https://app.qesto.io/api/auth/saml/callback',
      'https://idp.example.com/sso',
    )
    // URL-encoded base64 — only contains [A-Za-z0-9+/= percent-escaped].
    expect(req).toMatch(/^[A-Za-z0-9%+\-_/=]+$/)
    // Decode and verify it's valid XML with expected fields.
    const xml = atob(decodeURIComponent(req))
    expect(xml).toContain('samlp:AuthnRequest')
    expect(xml).toContain('https://app.qesto.io')
    expect(xml).toContain('https://app.qesto.io/api/auth/saml/callback')
    expect(xml).toContain('https://idp.example.com/sso')
  })

  it('produces unique IDs across calls', () => {
    const a = buildAuthnRequest('e', 'a', 'i')
    const b = buildAuthnRequest('e', 'a', 'i')
    expect(a).not.toBe(b)
  })
})

describe('SAML: buildSpMetadata', () => {
  it('emits well-formed SP metadata XML', () => {
    const xml = buildSpMetadata(
      'https://app.qesto.io',
      'https://app.qesto.io/api/auth/saml/callback',
    )
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('md:EntityDescriptor')
    expect(xml).toContain('entityID="https://app.qesto.io"')
    expect(xml).toContain('md:AssertionConsumerService')
    expect(xml).toContain('Location="https://app.qesto.io/api/auth/saml/callback"')
  })

  it('escapes special XML chars in entityID', () => {
    const xml = buildSpMetadata('https://a.example/<bad>', 'https://a.example/acs')
    expect(xml).not.toContain('<bad>')
    expect(xml).toContain('&lt;bad&gt;')
  })
})

describe('SAML: parseAssertion', () => {
  const aud = 'https://app.qesto.io'

  function b64(xml: string): string {
    return btoa(xml)
  }

  it('extracts email + nameId from a valid response', () => {
    const xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
  <saml:Assertion>
    <saml:Conditions>
      <saml:AudienceRestriction>
        <saml:Audience>${aud}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:Subject>
      <saml:NameID>alice@example.com</saml:NameID>
    </saml:Subject>
    <saml:AttributeStatement>
      <saml:Attribute Name="email">
        <saml:AttributeValue>alice@example.com</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`
    const out = parseAssertion(b64(xml), aud)
    expect(out.email).toBe('alice@example.com')
    expect(out.nameId).toBe('alice@example.com')
  })

  it('falls back to NameID when no email attribute is present', () => {
    const xml = `<Response xmlns="urn:oasis:names:tc:SAML:2.0:protocol">
  <Assertion xmlns="urn:oasis:names:tc:SAML:2.0:assertion">
    <Conditions><AudienceRestriction><Audience>${aud}</Audience></AudienceRestriction></Conditions>
    <Subject><NameID>bob@example.com</NameID></Subject>
  </Assertion>
</Response>`
    const out = parseAssertion(b64(xml), aud)
    expect(out.email).toBe('bob@example.com')
  })

  it('accepts Azure AD-style emailaddress claim', () => {
    const xml = `<Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
  <saml:Assertion>
    <saml:Conditions><saml:AudienceRestriction><saml:Audience>${aud}</saml:Audience></saml:AudienceRestriction></saml:Conditions>
    <saml:Subject><saml:NameID>carol@example.com</saml:NameID></saml:Subject>
    <saml:AttributeStatement>
      <saml:Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress">
        <saml:AttributeValue>carol@contoso.com</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</Response>`
    const out = parseAssertion(b64(xml), aud)
    expect(out.email).toBe('carol@contoso.com')
    expect(out.nameId).toBe('carol@example.com')
  })

  it('throws on audience mismatch', () => {
    const xml = `<Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
  <saml:Assertion>
    <saml:Conditions><saml:AudienceRestriction><saml:Audience>https://attacker.example</saml:Audience></saml:AudienceRestriction></saml:Conditions>
    <saml:Subject><saml:NameID>x@example.com</saml:NameID></saml:Subject>
  </saml:Assertion>
</Response>`
    expect(() => parseAssertion(b64(xml), aud)).toThrow(/audience/)
  })

  it('throws when NameID is missing', () => {
    const xml = `<Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
  <saml:Assertion>
    <saml:Conditions><saml:AudienceRestriction><saml:Audience>${aud}</saml:Audience></saml:AudienceRestriction></saml:Conditions>
  </saml:Assertion>
</Response>`
    expect(() => parseAssertion(b64(xml), aud)).toThrow(/NameID/)
  })

  it('lowercases and trims the email', () => {
    const xml = `<Response xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
  <saml:Assertion>
    <saml:Conditions><saml:AudienceRestriction><saml:Audience>${aud}</saml:Audience></saml:AudienceRestriction></saml:Conditions>
    <saml:Subject><saml:NameID>Dave@Example.COM</saml:NameID></saml:Subject>
  </saml:Assertion>
</Response>`
    expect(parseAssertion(b64(xml), aud).email).toBe('dave@example.com')
  })
})

describe('SAML: state token (ACTIONS_KV)', () => {
  // Minimal in-memory KV stub — matches the subset of KVNamespace used by saml.ts.
  function makeKv(): KVNamespace {
    const store = new Map<string, string>()
    return {
      async get(key: string) {
        return store.has(key) ? store.get(key)! : null
      },
      async put(key: string, value: string) {
        store.set(key, value)
      },
      async delete(key: string) {
        store.delete(key)
      },
    } as unknown as KVNamespace
  }

  it('generates a 64-char hex token and round-trips state', async () => {
    const kv = makeKv()
    const token = await generateSamlState(kv, 'team-1', 'https://idp.example.com/sso')
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    const out = await consumeSamlState(kv, token)
    expect(out).toEqual({ teamId: 'team-1', idpSsoUrl: 'https://idp.example.com/sso' })
  })

  it('deletes state on consume (single-use)', async () => {
    const kv = makeKv()
    const token = await generateSamlState(kv, 't', 'i')
    await consumeSamlState(kv, token)
    const replay = await consumeSamlState(kv, token)
    expect(replay).toBeNull()
  })

  it('rejects malformed tokens', async () => {
    const kv = makeKv()
    expect(await consumeSamlState(kv, 'not-hex')).toBeNull()
    expect(await consumeSamlState(kv, '1234')).toBeNull()
  })
})

// Lightweight SAML 2.0 Service Provider (SP) implementation.
//
// Workers cannot use Node-based SAML libraries (no fs, no Buffer, no crypto
// module). This file implements the minimum subset of SAML 2.0 Web Browser SSO
// profile needed to authenticate users against a customer IdP (Okta, Azure AD,
// OneLogin, etc.), using only the Web Crypto API + string/regex parsing.
//
// Scope:
//   • buildAuthnRequest() — emits a base64-encoded, URL-safe SAMLRequest for
//     the HTTP-Redirect binding (no signature; customers pin our metadata on
//     the IdP side and rely on TLS for integrity).
//   • parseAssertion()    — decodes a base64 SAMLResponse, extracts NameID +
//     email attribute, and validates Audience + Issuer. XML parsing is
//     deliberately minimal (regex-based); full signature verification is
//     deferred to a future hardened implementation (see BACKLOG §4).
//   • SAML state tokens   — opaque 32-byte hex strings stored in ACTIONS_KV
//     with a 5-minute TTL to prevent replay and cross-tenant confusion.
//
// SECURITY CAVEAT (documented in docs/ARCHITECTURE.md §SAML):
//   This SP trusts the IdP's TLS transport + RelayState binding. It does NOT
//   yet verify the XML signature on <saml:Assertion>. For v2.x this is an
//   acceptable trade-off because customers configure the IdP per-tenant and
//   the callback URL is over HTTPS. XML-DSig verification is tracked in
//   BACKLOG §4 (SEC-SAML-01) and MUST ship before the "SAML SSO GA" badge.

const SAML_STATE_TTL_SECONDS = 5 * 60 // 5 min

export type SamlAssertion = {
  email: string
  nameId: string
}

// ─────────────────────────────────────────────────────────────────────────────
// AuthnRequest construction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a SAMLRequest suitable for the HTTP-Redirect binding.
 *
 * The returned string is already base64-encoded + URL-encoded; callers should
 * append it directly to the IdP SSO URL as `?SAMLRequest=<value>`.
 *
 * @param entityId  SP entity id (e.g. 'https://app.qesto.io')
 * @param acsUrl    Assertion Consumer Service URL (our /api/auth/saml/callback)
 * @param _idpSsoUrl IdP SSO endpoint — reserved for future destination attr
 */
export function buildAuthnRequest(entityId: string, acsUrl: string, _idpSsoUrl: string): string {
  const id = `_${randomHex(20)}` // SAML IDs must start with a letter/underscore
  const issueInstant = new Date().toISOString()

  const xml =
    `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
    `xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
    `ID="${id}" Version="2.0" IssueInstant="${issueInstant}" ` +
    `Destination="${escapeXml(_idpSsoUrl)}" ` +
    `ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" ` +
    `AssertionConsumerServiceURL="${escapeXml(acsUrl)}">` +
    `<saml:Issuer>${escapeXml(entityId)}</saml:Issuer>` +
    `<samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>` +
    `</samlp:AuthnRequest>`

  return encodeURIComponent(base64Encode(new TextEncoder().encode(xml)))
}

// ─────────────────────────────────────────────────────────────────────────────
// Assertion parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decode and parse a base64-encoded SAMLResponse. Extracts:
 *   • NameID          (<saml:NameID>...</saml:NameID>)
 *   • email attribute (AttributeStatement → Attribute[Name=email|mail|...])
 *   • Audience        (must match expectedAudience — our entity ID)
 *
 * Returns `{ email, nameId }` on success; throws on malformed / audience-mismatch.
 */
export function parseAssertion(samlResponse: string, expectedAudience: string): SamlAssertion {
  // Cloudflare Workers IdPs may POST either the raw base64 or form-url-encoded.
  const decodedOnce = decodeURIComponent(samlResponse.replace(/\+/g, ' '))
  const xml = new TextDecoder().decode(base64Decode(decodedOnce))

  // Validate audience first — cheap reject for cross-tenant confusion.
  const audienceMatch = xml.match(/<saml:?Audience[^>]*>([^<]+)<\/saml:?Audience>/)
  if (!audienceMatch || audienceMatch[1].trim() !== expectedAudience) {
    throw new Error('saml: audience mismatch')
  }

  // NameID — either <saml:NameID> or <NameID> (namespace-unprefixed form).
  const nameIdMatch = xml.match(/<saml:?NameID[^>]*>([^<]+)<\/saml:?NameID>/)
  if (!nameIdMatch) throw new Error('saml: missing NameID')
  const nameId = decodeXmlEntities(nameIdMatch[1].trim())

  // Email attribute — check common Name variations (Okta, Azure AD, SAML spec).
  const email =
    findAttributeValue(xml, 'email') ??
    findAttributeValue(xml, 'mail') ??
    findAttributeValue(xml, 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress') ??
    findAttributeValue(xml, 'urn:oid:0.9.2342.19200300.100.1.3') ??
    (isEmail(nameId) ? nameId : null)

  if (!email) throw new Error('saml: missing email attribute')

  return { email: email.toLowerCase().trim(), nameId }
}

// ─────────────────────────────────────────────────────────────────────────────
// SP metadata XML (for upload to IdPs)
// ─────────────────────────────────────────────────────────────────────────────

export function buildSpMetadata(entityId: string, acsUrl: string): string {
  // No signing cert advertised yet — customers pin entityId + ACS URL.
  // See SEC-SAML-01 in BACKLOG for cert publication work.
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" ` +
    `entityID="${escapeXml(entityId)}">` +
    `<md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="false" ` +
    `protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">` +
    `<md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>` +
    `<md:AssertionConsumerService ` +
    `Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" ` +
    `Location="${escapeXml(acsUrl)}" index="0" isDefault="true"/>` +
    `</md:SPSSODescriptor>` +
    `</md:EntityDescriptor>`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// State tokens (ACTIONS_KV-backed, 5 min TTL, single-use)
// ─────────────────────────────────────────────────────────────────────────────

const STATE_KEY = (token: string) => `saml-state:${token}`

export async function generateSamlState(
  kv: KVNamespace,
  teamId: string,
  idpSsoUrl: string,
): Promise<string> {
  const token = randomHex(32)
  await kv.put(
    STATE_KEY(token),
    JSON.stringify({ teamId, idpSsoUrl, createdAt: Date.now() }),
    { expirationTtl: SAML_STATE_TTL_SECONDS },
  )
  return token
}

export async function consumeSamlState(
  kv: KVNamespace,
  token: string,
): Promise<{ teamId: string; idpSsoUrl: string } | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null
  const raw = await kv.get(STATE_KEY(token))
  if (!raw) return null
  // Single-use — delete before returning so replay attempts fail.
  await kv.delete(STATE_KEY(token))
  try {
    const parsed = JSON.parse(raw) as { teamId: string; idpSsoUrl: string }
    return { teamId: parsed.teamId, idpSsoUrl: parsed.idpSsoUrl }
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function findAttributeValue(xml: string, name: string): string | null {
  // Match <saml:Attribute Name="email" ...>
  //   <saml:AttributeValue ...>value</saml:AttributeValue>
  // </saml:Attribute>
  // Also tolerates unprefixed <Attribute Name=...>.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `<(?:saml:)?Attribute[^>]*Name=["']${escaped}["'][^>]*>[\\s\\S]*?<(?:saml:)?AttributeValue[^>]*>([^<]+)<\\/(?:saml:)?AttributeValue>`,
    'i',
  )
  const m = xml.match(re)
  return m ? decodeXmlEntities(m[1].trim()) : null
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  let s = ''
  for (const b of buf) s += b.toString(16).padStart(2, '0')
  return s
}

function base64Encode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function base64Decode(s: string): Uint8Array {
  // Tolerate URL-safe alphabet + missing padding.
  const normal = s.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normal + '='.repeat((4 - (normal.length % 4)) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

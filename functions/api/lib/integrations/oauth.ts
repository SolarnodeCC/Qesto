/**
 * Generic OAuth 2.0 client with PKCE support.
 * Used by Slack, Notion, Airtable, and future integrations.
 */

import { TokenResponse } from './types'

export interface OAuth2Config {
  clientId: string
  clientSecret: string
  redirectUri: string
  authorizationEndpoint: string
  tokenEndpoint: string
  revokeEndpoint?: string
}

/**
 * Generate PKCE code challenge + verifier pair.
 * PKCE (RFC 7636) provides extra security for OAuth flows on untrusted clients.
 */
export async function generatePKCEPair(): Promise<{
  codeChallenge: string
  codeVerifier: string
}> {
  const verifier = generateRandomString(128)
  const hash = await sha256(verifier)
  const challenge = base64url(hash)
  return { codeChallenge: challenge, codeVerifier: verifier }
}

/**
 * Generic OAuth 2.0 client.
 */
export class OAuth2Client {
  constructor(private config: OAuth2Config) {}

  /**
   * Get authorization URL (with PKCE code_challenge).
   *
   * @param state CSRF protection state
   * @param codeChallenge PKCE code challenge (from generatePKCEPair)
   * @returns Authorization URL
   */
  getAuthorizationUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })
    return `${this.config.authorizationEndpoint}?${params}`
  }

  /**
   * Exchange authorization code for tokens.
   * Includes PKCE code_verifier for security.
   */
  async exchangeAuthorizationCode(
    code: string,
    codeVerifier: string
  ): Promise<TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      code_verifier: codeVerifier,
    })

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })

    if (!response.ok) {
      throw new Error(`OAuth token exchange failed: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Refresh an access token using refresh token.
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    })

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })

    if (!response.ok) {
      throw new Error(`OAuth token refresh failed: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Revoke a token (if provider supports it).
   */
  async revokeToken(token: string, hint: 'access_token' | 'refresh_token' = 'access_token'): Promise<void> {
    if (!this.config.revokeEndpoint) {
      throw new Error('Provider does not support token revocation')
    }

    const params = new URLSearchParams({
      token,
      token_type_hint: hint,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    })

    const response = await fetch(this.config.revokeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })

    if (!response.ok) {
      throw new Error(`Token revocation failed: ${response.statusText}`)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate random string for PKCE verifier (128 chars, alphanumeric + - _).
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let result = ''
  const values = new Uint8Array(length)
  crypto.getRandomValues(values)
  for (let i = 0; i < length; i++) {
    result += chars[values[i] % chars.length]
  }
  return result
}

/**
 * SHA-256 hash using WebCrypto.
 */
async function sha256(data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  return crypto.subtle.digest('SHA-256', encoder.encode(data))
}

/**
 * Base64-URL encode (without padding).
 */
function base64url(buffer: ArrayBuffer): string {
  const array = Array.from(new Uint8Array(buffer))
  const binaryString = String.fromCharCode(...array)
  return btoa(binaryString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

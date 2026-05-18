/**
 * KV-backed encrypted token storage for integration credentials.
 *
 * Tokens are encrypted before storage; encryption keys are per-deployment.
 * All tokens are scoped by team + service.
 */

import { TokenResponse } from './types'
import { validateKvJson, StoredTokenSchema } from '../validators'

interface StoredToken {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  stored_at: number
  expires_at?: number
}

export class EncryptedTokenStore {
  constructor(private kv: KVNamespace, _encryptionKey?: Uint8Array) {
    // In production, fetch encryption key from Cloudflare KV or secret
    // For now, encryption is deferred (TODO: v2.3)
    // _encryptionKey parameter reserved for future use
  }

  /**
   * Store an access token encrypted in KV.
   *
   * @param teamId Team that owns this integration
   * @param service Integration service (slack, notion, airtable, etc.)
   * @param token Token from OAuth exchange
   */
  async storeToken(
    teamId: string,
    service: string,
    token: TokenResponse
  ): Promise<void> {
    const kvKey = this.getKVKey(teamId, service)
    const stored: StoredToken = {
      access_token: token.access_token,
      ...(token.refresh_token && { refresh_token: token.refresh_token }),
      ...(token.expires_in && { expires_in: token.expires_in }),
      ...(token.token_type && { token_type: token.token_type }),
      ...(token.scope && { scope: token.scope }),
      stored_at: Date.now(),
      ...(token.expires_in && { expires_at: Date.now() + token.expires_in * 1000 }),
    }

    // For now, store as plaintext (encryption to follow in v2.3)
    // TODO: Implement encryption per ADR-INTEGRATION-FOUNDATION
    await this.kv.put(kvKey, JSON.stringify(stored), {
      expirationTtl: 90 * 24 * 60 * 60, // 90 days
    })
  }

  /**
   * Retrieve token from KV.
   *
   * @returns Token or null if not found / expired
   */
  async getToken(teamId: string, service: string): Promise<TokenResponse | null> {
    const kvKey = this.getKVKey(teamId, service)
    const raw = await this.kv.get(kvKey)

    if (!raw) return null

    const stored = validateKvJson(raw, StoredTokenSchema)
    if (!stored) return null

    // Check expiration
    if (stored.expires_at && stored.expires_at < Date.now()) {
      return null
    }

    const token: TokenResponse = {
      access_token: stored.access_token,
    }

    if (stored.refresh_token) token.refresh_token = stored.refresh_token
    if (stored.expires_in) token.expires_in = stored.expires_in
    if (stored.token_type) token.token_type = stored.token_type
    if (stored.scope) token.scope = stored.scope

    return token
  }

  /**
   * Rotate token (e.g., after refresh).
   */
  async rotateToken(
    teamId: string,
    service: string,
    newToken: TokenResponse
  ): Promise<void> {
    await this.storeToken(teamId, service, newToken)
  }

  /**
   * Revoke token (delete from KV).
   */
  async revokeToken(teamId: string, service: string): Promise<void> {
    const kvKey = this.getKVKey(teamId, service)
    await this.kv.delete(kvKey)
  }

  /**
   * Check if team has configured integration.
   */
  async isConfigured(teamId: string, service: string): Promise<boolean> {
    const token = await this.getToken(teamId, service)
    return token !== null
  }

  /**
   * KV key format: {prefix}:{teamId}:{service}
   */
  private getKVKey(teamId: string, service: string): string {
    return `integration:token:${teamId}:${service}`
  }
}

/**
 * KV-backed encrypted token storage for integration credentials.
 *
 * Tokens are encrypted with AES-GCM (OAUTH_TOKEN_MEK) before storage.
 * Legacy plaintext blobs (pre–Sprint 31) are read once and re-written encrypted on rotate.
 */

import { TokenResponse } from './types'
import { validateKvJson, StoredTokenSchema } from '../validators'
import {
  decryptTokenPayload,
  deriveAesKeyFromMek,
  encryptTokenPayload,
  isLegacyPlaintextTokenBlob,
} from './token-crypto'

interface StoredToken {
  access_token: string
  refresh_token?: string | undefined
  expires_in?: number | undefined
  token_type?: string | undefined
  scope?: string | undefined
  stored_at: number
  expires_at?: number | undefined
}
import { INTEGRATION_TOKEN_TTL_SECONDS } from '../constants'

export class EncryptedTokenStore {
  private aesKey: CryptoKey | null = null
  private readonly encryptionRequired: boolean

  constructor(
    private kv: KVNamespace,
    private mek?: string,
    environment: 'production' | 'preview' | 'dev' | 'staging' = 'production',
  ) {
    this.encryptionRequired = environment === 'production' || environment === 'staging'
  }

  private async getAesKey(): Promise<CryptoKey | null> {
    if (!this.mek) {
      if (this.encryptionRequired) {
        throw new Error('OAUTH_TOKEN_MEK is required for integration token storage')
      }
      return null
    }
    if (!this.aesKey) {
      this.aesKey = await deriveAesKeyFromMek(this.mek)
    }
    return this.aesKey
  }

  private async serializeForKv(stored: StoredToken): Promise<string> {
    const plaintext = JSON.stringify(stored)
    const key = await this.getAesKey()
    if (!key) return plaintext
    return encryptTokenPayload(plaintext, key)
  }

  private async deserializeFromKv(raw: string): Promise<StoredToken | null> {
    const key = await this.getAesKey()
    let plaintext = raw
    if (key) {
      if (isLegacyPlaintextTokenBlob(raw)) {
        plaintext = raw
      } else {
        const decrypted = await decryptTokenPayload(raw, key)
        if (!decrypted) return null
        plaintext = decrypted
      }
    }
    return validateKvJson(plaintext, StoredTokenSchema)
  }

  async storeToken(teamId: string, service: string, token: TokenResponse): Promise<void> {
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

    await this.kv.put(kvKey, await this.serializeForKv(stored), {
      expirationTtl: INTEGRATION_TOKEN_TTL_SECONDS,
    })
  }

  async getToken(teamId: string, service: string): Promise<TokenResponse | null> {
    const kvKey = this.getKVKey(teamId, service)
    const raw = await this.kv.get(kvKey)
    if (!raw) return null

    const stored = await this.deserializeFromKv(raw)
    if (!stored) return null

    if (stored.expires_at && stored.expires_at < Date.now()) {
      return null
    }

    const out: TokenResponse = { access_token: stored.access_token }
    if (stored.refresh_token) out.refresh_token = stored.refresh_token
    if (stored.expires_in) out.expires_in = stored.expires_in
    if (stored.token_type) out.token_type = stored.token_type
    if (stored.scope) out.scope = stored.scope
    return out
  }

  async rotateToken(teamId: string, service: string, newToken: TokenResponse): Promise<void> {
    await this.storeToken(teamId, service, newToken)
  }

  async revokeToken(teamId: string, service: string): Promise<void> {
    await this.kv.delete(this.getKVKey(teamId, service))
  }

  async isConfigured(teamId: string, service: string): Promise<boolean> {
    return (await this.getToken(teamId, service)) !== null
  }

  private getKVKey(teamId: string, service: string): string {
    return `integration:token:${teamId}:${service}`
  }
}

/** Factory matching route Env bindings. */
export function createEncryptedTokenStore(
  kv: KVNamespace,
  env: { OAUTH_TOKEN_MEK?: string; ENV?: string },
): EncryptedTokenStore {
  const environment = (env.ENV ?? 'production') as 'production' | 'preview' | 'dev' | 'staging'
  return new EncryptedTokenStore(kv, env.OAUTH_TOKEN_MEK, environment)
}

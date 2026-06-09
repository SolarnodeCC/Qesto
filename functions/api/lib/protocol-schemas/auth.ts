// Proof-aware decoders for auth, OAuth, and external identity boundaries.

import { z } from 'zod'

// ── Storage Validators ───────────────────────────────────────────────────────

export const AuthClaimsSchema = z.object({
  sub: z.string(),
  // Intentionally coarse: RFC email validation belongs at the OAuth/SAML edge.
  // Microsoft preferred_username can be a non-RFC-email UPN on some tenants.
  email: z.string().min(1),
  jti: z.string().optional(),
  iat: z.number(),
  exp: z.number(),
})

export type ValidAuthClaims = z.infer<typeof AuthClaimsSchema>

// ── Auth KV Validators ───────────────────────────────────────────────────────

export const OAuthStateSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
})

export type ValidOAuthState = z.infer<typeof OAuthStateSchema>

export const PasswordCredentialSchema = z.object({
  hash: z.string(),
})

export type ValidPasswordCredential = z.infer<typeof PasswordCredentialSchema>

export const PasswordResetSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
})

export type ValidPasswordReset = z.infer<typeof PasswordResetSchema>

// ── OAuth/External Service Validators ─────────────────────────────────────

export const GoogleTokenResponseSchema = z.object({
  id_token: z.string().optional(),
  access_token: z.string().optional(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
})

export type ValidGoogleTokenResponse = z.infer<typeof GoogleTokenResponseSchema>

export const MicrosoftTokenResponseSchema = z.object({
  id_token: z.string(),
  access_token: z.string().optional(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
})

export type ValidMicrosoftTokenResponse = z.infer<typeof MicrosoftTokenResponseSchema>

// JWT payload schemas for Google and Microsoft ID tokens
export const GoogleIdTokenPayloadSchema = z.object({
  email: z.string().optional(),
  sub: z.string().optional(),
  email_verified: z.boolean().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  exp: z.number().optional(),
  iss: z.string().optional(),
  iat: z.number().optional(),
})

export type ValidGoogleIdTokenPayload = z.infer<typeof GoogleIdTokenPayloadSchema>

export const MicrosoftIdTokenPayloadSchema = z.object({
  email: z.string().optional(),
  preferred_username: z.string().optional(),
  oid: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  exp: z.number().optional(),
  iss: z.string().optional(),
  iat: z.number().optional(),
})

export type ValidMicrosoftIdTokenPayload = z.infer<typeof MicrosoftIdTokenPayloadSchema>

export const JwtHeaderSchema = z.object({
  alg: z.string().optional(),
  kid: z.string().optional(),
  typ: z.string().optional(),
})

export type ValidJwtHeader = z.infer<typeof JwtHeaderSchema>

export const JwksResponseSchema = z.object({
  keys: z.array(z.record(z.string(), z.unknown())).optional(),
})

export type ValidJwksResponse = z.infer<typeof JwksResponseSchema>

// ── User Context Validator (validates auth token payload before casting) ─────

export const UserContextSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.boolean().optional(),
  teams: z.array(z.string()).optional(),
  aud: z.string().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
})

export type ValidUserContext = z.infer<typeof UserContextSchema>

// ── OAuth state token validator (integrations) ───────────────────────────────

export const OAuthStatePayloadSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
  exp: z.number(),
})

export type ValidOAuthStatePayload = z.infer<typeof OAuthStatePayloadSchema>

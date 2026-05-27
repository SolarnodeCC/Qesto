/**
 * SEC-JOIN-CAPTCHA-01 — short-lived join tokens when JOIN_CAPTCHA_ENABLED=true.
 */
import { signJwt, verifyJwtWithSecrets, jwtVerificationSecrets } from './jwt'

const TTL_SEC = 600

export async function issueJoinCaptchaToken(
  env: { JWT_SECRET: string; JWT_SECRET_PREV?: string },
  sessionCode: string,
): Promise<string> {
  return signJwt({ sub: `join:${sessionCode}`, email: 'join-captcha@internal' }, env.JWT_SECRET, TTL_SEC)
}

export async function verifyJoinCaptchaToken(
  env: { JWT_SECRET: string; JWT_SECRET_PREV?: string },
  token: string,
  sessionCode: string,
): Promise<boolean> {
  const claims = await verifyJwtWithSecrets(token, jwtVerificationSecrets(env))
  return claims?.sub === `join:${sessionCode}`
}

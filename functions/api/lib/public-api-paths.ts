/**
 * ARCH-HONO-02 — Routes that must not require session JWT (OAuth callbacks, health).
 * Used for documentation and future centralized auth middleware.
 */
export const PUBLIC_API_PATH_PREFIXES = [
  '/api/auth/',
  '/api/admin/health',
  '/api/version',
  '/api/webhooks/marketing',
  '/api/integrations/slack/callback',
  '/api/integrations/teams/callback',
  '/api/integrations/zoom/callback',
  '/api/integrations/salesforce/callback',
  '/api/integrations/notion/callback',
  '/api/sessions/by-code/',
  '/api/events/',
  '/api/v1/',
  '/api/v2/',
  '/api/marketplace/',
  '/api/partner/sla',
] as const

export function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

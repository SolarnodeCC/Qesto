import { createApp } from './api/app'
import type { Env } from './api/types'

const app = createApp()

// Valid SPA routes that should return 200 status
const validSpaRoutes = [
  '/',
  '/login',
  '/reset-password',
  '/privacy',
  '/terms',
  '/pricing',
  '/events',
  '/hr',
  '/nonprofit',
  '/nonprofits',
  '/consulting',
  '/features',
  '/use-cases',
  '/trust',
  '/templates',
  '/dashboard',
  '/settings',
  '/admin',
  '/sessions',
  '/join',
  '/j',
  '/display',
  '/th',
  '/teams',
  '/marketplace',
  '/partner',
  '/developers',
]

function isValidSpaRoute(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return true // root

  const firstSegment = '/' + parts[0]
  return validSpaRoutes.some((route) => {
    if (route === firstSegment) return true
    if (route.endsWith('/*') && firstSegment === route.slice(0, -2)) return true
    return route === pathname
  })
}

// Dynamic SEO endpoints served by the Hono app (functions/api/routes/seo-sitemap.ts).
// They live at the site root rather than under /api/, so this catch-all must forward
// them to Hono explicitly — otherwise they contain a "." and fall through to the SPA,
// returning HTML instead of XML / plain text. /sitemap.xml is intentionally excluded:
// it is served as a static marketing sitemap from public/sitemap.xml.
const SEO_HONO_PATHS = new Set([
  '/sitemap-index.xml',
  '/sitemap-templates.xml',
  '/.well-known/indexnow',
  '/indexnow.txt',
])

function forwardToHono(context: { request: Request; env: Env }) {
  const waitUntil = (context as unknown as { waitUntil?: (promise: Promise<unknown>) => void }).waitUntil
  const passThroughOnException = (context as unknown as { passThroughOnException?: () => void }).passThroughOnException
  const exec: ExecutionContext = {
    waitUntil: typeof waitUntil === 'function' ? waitUntil.bind(context) : () => {},
    passThroughOnException: typeof passThroughOnException === 'function' ? passThroughOnException.bind(context) : () => {},
    props: {},
  }
  return app.fetch(context.request, context.env, exec)
}

export const onRequest: PagesFunction<Env> = (context) => {
  const url = new URL(context.request.url)
  const pathname = url.pathname

  // Route API requests to Hono
  if (pathname.startsWith('/api/')) {
    return forwardToHono(context)
  }

  // Route dynamic SEO endpoints (sitemap index/templates, IndexNow) to Hono.
  // Includes the optional IndexNow Option-1 key file at /{INDEXNOW_KEY_FILE}.txt.
  const indexNowKeyFile = context.env.INDEXNOW_KEY_FILE
  if (SEO_HONO_PATHS.has(pathname) || (indexNowKeyFile && pathname === `/${indexNowKeyFile}.txt`)) {
    return forwardToHono(context)
  }

  // Check if it's a static asset or valid SPA route
  if (pathname.includes('.') || isValidSpaRoute(pathname)) {
    return context.next()
  }

  // Return 404 for invalid routes
  return new Response(
    JSON.stringify({
      ok: false,
      error: { code: 'not_found', message: 'Page not found' },
    }),
    {
      status: 404,
      headers: { 'content-type': 'application/json' },
    },
  )
}

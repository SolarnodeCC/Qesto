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

export const onRequest: PagesFunction<Env> = (context) => {
  const url = new URL(context.request.url)

  // Route API requests to Hono
  if (url.pathname.startsWith('/api/')) {
    const waitUntil = (context as unknown as { waitUntil?: (promise: Promise<unknown>) => void }).waitUntil
    const passThroughOnException = (context as unknown as { passThroughOnException?: () => void }).passThroughOnException
    const exec: ExecutionContext = {
      waitUntil: typeof waitUntil === 'function' ? waitUntil.bind(context) : () => {},
      passThroughOnException: typeof passThroughOnException === 'function' ? passThroughOnException.bind(context) : () => {},
      props: {},
    }
    return app.fetch(context.request, context.env, exec)
  }

  // Check if it's a static asset or valid SPA route
  const pathname = url.pathname
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

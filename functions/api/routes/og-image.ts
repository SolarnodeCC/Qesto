import { Context } from 'hono'
import type { Env } from '../types'
import { generateOgImageSvg } from '../lib/og-image-generator'

/**
 * SEO-OG-01: Dynamic OG image generation endpoint
 * Returns SVG images for social media sharing
 * Usage: /api/og?title=...&industry=...&theme=...
 */
export async function getOgImage(c: Context<{ Bindings: Env }>) {
  try {
    const title = c.req.query('title') || 'Qesto Template'
    const subtitle = c.req.query('subtitle')
    const industry = c.req.query('industry')
    const theme = c.req.query('theme')
    const color = (c.req.query('color') as 'teal' | 'purple' | 'orange') || 'teal'

    const params: Parameters<typeof generateOgImageSvg>[0] = {
      title: decodeURIComponent(title),
      color,
    }

    if (subtitle) params.subtitle = decodeURIComponent(subtitle)
    if (industry) params.industry = decodeURIComponent(industry)
    if (theme) params.theme = decodeURIComponent(theme)

    const svg = generateOgImageSvg(params)

    c.header('Content-Type', 'image/svg+xml; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=31536000, immutable')
    c.header('X-Content-Type-Options', 'nosniff')

    return c.text(svg)
  } catch (error) {
    console.error('[og-image] Error generating OG image:', error)
    return c.text('Failed to generate OG image', 500)
  }
}

export function mountOgImageRoutes(app: any) {
  app.get('/api/og', getOgImage)
}

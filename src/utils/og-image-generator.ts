/**
 * Client-side OG image URL builder — SVG rendering lives in functions/api only.
 * @see functions/api/routes/og-image.ts
 */

export interface OgImageParams {
  title: string
  subtitle?: string
  industry?: string
  theme?: string
  color?: 'teal' | 'purple' | 'orange'
}

export function generateOgImageUrl(params: OgImageParams): string {
  const searchParams = new URLSearchParams({
    title: params.title,
    ...(params.subtitle && { subtitle: params.subtitle }),
    ...(params.industry && { industry: params.industry }),
    ...(params.theme && { theme: params.theme }),
    ...(params.color && { color: params.color }),
  })
  return `/api/og?${searchParams.toString()}`
}

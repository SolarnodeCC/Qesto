/**
 * OG Image Generator — creates dynamic Open Graph images for social sharing
 * Generates SVG images that are lightweight and cache-friendly
 * Used by /api/og?title=...&industry=...&template=tmpl_xxx
 */

interface OgImageParams {
  title: string
  subtitle?: string
  industry?: string
  theme?: string
  color?: 'teal' | 'purple' | 'orange'
}

const colors = {
  teal: '#14B8A6',
  purple: '#8B5CF6',
  orange: '#F97316',
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function generateOgImageSvg(params: OgImageParams): string {
  const { title, subtitle, industry, theme, color = 'teal' } = params
  const primaryColor = colors[color]
  const width = 1200
  const height = 630

  // Truncate and wrap text
  const titleLines = title
    .split(' ')
    .reduce((lines: string[], word: string) => {
      const lastLine = lines[lines.length - 1] || ''
      const testLine = lastLine ? `${lastLine} ${word}` : word
      if (testLine.length > 30) {
        lines.push(word)
      } else {
        lines[lines.length - 1] = testLine
      }
      return lines
    }, [])
    .slice(0, 3)

  const tagline = industry ? industry.replace(/-/g, ' ').toUpperCase() : 'TEMPLATE'

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8B5CF6;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="grad2" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#0A0F1E;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1A1F35;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#grad2)" />

  <!-- Top accent bar -->
  <rect width="${width}" height="8" fill="url(#grad1)" />

  <!-- Left gradient accent -->
  <rect x="0" y="0" width="20" height="${height}" fill="url(#grad1)" opacity="0.3" />

  <!-- Tagline -->
  <text
    x="60"
    y="120"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="32"
    font-weight="700"
    fill="${primaryColor}"
    text-transform="uppercase"
    letter-spacing="2"
  >
    ${escapeXml(tagline)}
  </text>

  <!-- Title (multi-line) -->
  ${titleLines
    .map(
      (line, i) => `
  <text
    x="60"
    y="${200 + i * 80}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="72"
    font-weight="800"
    fill="white"
    line-height="1.2"
  >
    ${escapeXml(line)}
  </text>`,
    )
    .join('')}

  <!-- Subtitle -->
  ${
    subtitle
      ? `
  <text
    x="60"
    y="${480}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="28"
    fill="#8893AD"
  >
    ${escapeXml(subtitle)}
  </text>`
      : ''
  }

  <!-- Qesto logo/text -->
  <text
    x="${width - 60}"
    y="${height - 40}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="20"
    font-weight="600"
    fill="${primaryColor}"
    text-anchor="end"
  >
    Qesto
  </text>

  <!-- Theme badge (if present) -->
  ${
    theme
      ? `
  <rect x="60" y="${height - 80}" width="auto" height="50" rx="8" fill="${primaryColor}" opacity="0.15" />
  <text
    x="80"
    y="${height - 50}"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="16"
    fill="${primaryColor}"
    font-weight="600"
  >
    ${escapeXml(theme.replace(/-/g, ' '))}
  </text>`
      : ''
  }
</svg>`
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

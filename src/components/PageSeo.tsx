import { useEffect } from 'react'

type SeoJsonLd = Record<string, unknown>

interface PageSeoProps {
  title: string
  description: string
  canonicalPath: string
  ogImage?: string
  noindex?: boolean
  jsonLd?: SeoJsonLd | SeoJsonLd[]
}

function upsertMeta(selector: string, attributes: Record<string, string>, content: string): void {
  let meta = document.head.querySelector<HTMLMetaElement>(selector)
  if (!meta) {
    meta = document.createElement('meta')
    Object.entries(attributes).forEach(([key, value]) => meta?.setAttribute(key, value))
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', content)
}

// Production apex origin. Canonical, og:url and og:image must always resolve to this
// host regardless of the host the visitor actually used (e.g. www.qesto.cc), so the
// www/non-www duplicate-content signal collapses to a single canonical even for
// JS-executing crawlers. Mirrors PAGES_URL/API_URL in wrangler.toml and the apex used
// in public/sitemap.xml and public/robots.txt.
const CANONICAL_ORIGIN = 'https://qesto.cc'

function toAbsoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl
  return `${CANONICAL_ORIGIN}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`
}

export default function PageSeo({
  title,
  description,
  canonicalPath,
  ogImage,
  noindex = false,
  jsonLd,
}: PageSeoProps) {
  useEffect(() => {
    document.title = title

    const canonicalUrl = toAbsoluteUrl(canonicalPath)
    const resolvedOgImage = ogImage ? toAbsoluteUrl(ogImage) : undefined

    let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonicalLink) {
      canonicalLink = document.createElement('link')
      canonicalLink.setAttribute('rel', 'canonical')
      document.head.appendChild(canonicalLink)
    }
    canonicalLink.setAttribute('href', canonicalUrl)

    upsertMeta('meta[name="description"]', { name: 'description' }, description)
    upsertMeta('meta[property="og:title"]', { property: 'og:title' }, title)
    upsertMeta('meta[property="og:description"]', { property: 'og:description' }, description)
    upsertMeta('meta[property="og:type"]', { property: 'og:type' }, 'website')
    upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl)
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image')
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, title)
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, description)
    upsertMeta('meta[name="robots"]', { name: 'robots' }, noindex ? 'noindex, nofollow' : 'index, follow')

    if (resolvedOgImage) {
      upsertMeta('meta[property="og:image"]', { property: 'og:image' }, resolvedOgImage)
      upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, resolvedOgImage)
    }

    document.querySelectorAll('script[data-qesto-jsonld="true"]').forEach((node) => node.remove())
    const jsonLdEntries = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []
    jsonLdEntries.forEach((entry) => {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute('data-qesto-jsonld', 'true')
      script.text = JSON.stringify(entry)
      document.head.appendChild(script)
    })
  }, [title, description, canonicalPath, ogImage, noindex, jsonLd])

  return null
}

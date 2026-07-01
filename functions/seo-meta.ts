// Edge-side SEO source of truth for the SPA shell.
//
// Qesto is a client-rendered SPA: functions/[[path]].ts serves the same static
// index.html for every route, and src/components/PageSeo.tsx only corrects the
// <head> after React mounts. Non-JS crawlers (and `curl -A Googlebot`) therefore
// saw the homepage title/description/canonical on EVERY route — telling search
// engines each subpage *is* the homepage (Finding 1).
//
// This module is the static, per-route metadata the catch-all function injects
// into the shell at the edge via HTMLRewriter, so the server-returned HTML
// differs per route before any JS runs.
//
// PARITY: values mirror each page's <PageSeo .../> props. For pages whose PageSeo
// reads i18n (use-cases, templates gallery, marketplace, trust/soc2, partner/sla)
// the ENGLISH strings are inlined here from public/locales/en/{common,solutions}.json.
// Keep them in sync; tests/unit/route-seo.test.ts guards sitemap coverage.

const CANONICAL_ORIGIN = 'https://qesto.cc' // mirrors PageSeo.tsx + sitemap/robots

export interface RouteSeo {
  title: string
  description: string
  canonicalPath: string
  ogImage?: string
  /** No-JS body fallback heading (mirrors the live page's <h1>). */
  h1: string
  /** No-JS body fallback lead copy (one or more paragraphs). */
  intro: string | string[]
}

// Cross-linking nav reused in every no-JS fallback so link equity flows between
// the marketing pages even for crawlers that don't execute JS. Mirrors the
// primary nav baked into index.html.
const INTERNAL_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/pricing', label: 'Pricing & anonymity modes' },
  { href: '/features/live-polling', label: 'Live polling' },
  { href: '/features/ai-insights', label: 'AI insights' },
  { href: '/use-cases/workshops', label: 'Workshops' },
  { href: '/templates', label: 'Templates' },
]

export const ROUTE_SEO: Record<string, RouteSeo> = {
  '/': {
    title: 'Qesto — Real-time Feedback & AI Insights for Teams',
    description:
      'Live polling, anonymous feedback, and AI-powered insights for workshops, training, and meetings. No account required to participate.',
    canonicalPath: '/',
    h1: 'Feel the pulse of the room, amplified by AI.',
    intro: [
      'Make it easy for everyone to take part, share what they think, and stay with you start to finish. For teachers, trainers, facilitators, and team leaders.',
      'Qesto helps teams and facilitators run live polls, rankings, and consent rounds during workshops, classrooms, and meetings — with AI-powered insights afterward.',
    ],
  },
  '/pricing': {
    title: 'Pricing — Qesto',
    description:
      'Start free. Edge inference and consent tooling on every tier; monthly session and per-room caps match in-app enforcement—see the matrix below.',
    canonicalPath: '/pricing',
    h1: 'Start free. Pay when a room depends on it.',
    intro:
      'Every plan includes edge inference and consent-aware flows. Session and room-size limits are published per tier and match what the product enforces—you don’t get surprise hard-stops after you’ve committed to a room.',
  },
  '/privacy': {
    title: 'Privacy Policy — Qesto',
    description:
      'Read how Qesto handles session data, consent logs, retention, security controls, and privacy rights.',
    canonicalPath: '/privacy',
    h1: 'Privacy Policy',
    intro:
      'How Qesto handles session data, consent logs, retention, security controls, and your privacy rights.',
  },
  '/terms': {
    title: 'Terms of Service — Qesto',
    description:
      'Review Qesto terms covering service use, plan limits, billing, prohibited use, and legal conditions.',
    canonicalPath: '/terms',
    h1: 'Terms of Service',
    intro:
      'The terms covering service use, plan limits, billing, prohibited use, and legal conditions for Qesto.',
  },
  '/legal': {
    title: 'Legal Information — Qesto',
    description:
      'Company registration, DSA contact points, content reporting, and compliance transparency for Qesto.',
    canonicalPath: '/legal',
    h1: 'Legal Information',
    intro:
      "This page fulfils Qesto's disclosure obligations under Art. 11 and Art. 15 of the Digital Services Act (EU 2022/2065), Art. 5 of the eCommerce Directive (2000/31/EC), and related Dutch law.",
  },
  '/legal/report': {
    title: 'Report Illegal Content — Qesto',
    description:
      'Submit a notice of alleged illegal content hosted on Qesto under Art. 16 of the Digital Services Act (EU 2022/2065).',
    canonicalPath: '/legal/report',
    h1: 'Report Illegal Content',
    intro: 'Art. 16, Regulation (EU) 2022/2065 (Digital Services Act)',
  },
  '/events': {
    title: 'Qesto for Events — The room answers back',
    description:
      'Turn any keynote, panel, or breakout into a two-way conversation. Live tallies, AI insights, and a recap before the applause lands.',
    canonicalPath: '/events',
    ogImage: '/images/solutions/photo-1572021335469-31706a17aaef.avif',
    h1: 'The room answers back.',
    intro:
      'Turn any keynote, panel, or breakout into a two-way conversation. Live tallies project on the main screen, AI surfaces the question a facilitator missed, and the speaker walks offstage with a recap before the applause lands.',
  },
  '/hr': {
    title: 'Qesto for HR — Honest pulse without a witch hunt',
    description:
      'Run quarterly climate checks, manager 360s, and open-comment sessions where people actually speak. Consent rounds protect every voice.',
    canonicalPath: '/hr',
    ogImage: '/images/solutions/photo-1543269865-cbf427effbad.avif',
    h1: 'Honest pulse. Without a witch hunt.',
    intro:
      'Run quarterly climate checks, manager 360s, and open-comment sessions where people actually speak. Consent rounds mean every attendee picks their visibility before the first vote — and no result is shown until the floor is large enough to protect them.',
  },
  '/nonprofit': {
    title: 'Qesto for Nonprofit Boards — Motions on the record',
    description:
      'Roll-call votes, secret ballots, and chair-called polls — run inside your board meeting, exported as the minutes themselves.',
    canonicalPath: '/nonprofit',
    ogImage: '/images/solutions/photo-1681949103006-70066fb25dfe.avif',
    h1: 'Motions on the record. Minutes before the meeting ends.',
    intro:
      "Roll-call votes, secret ballots, and chair-called polls — run inside your board meeting, exported as the minutes themselves. Identity logged where bylaws require it; anonymized where they don't.",
  },
  '/consulting': {
    title: 'Qesto for Consulting — Workshops that ship evidence',
    description:
      'Run client discovery, strategy offsites, and change-management sessions where every conclusion is backed by a tally.',
    canonicalPath: '/consulting',
    ogImage: '/images/solutions/photo-1552664730-d307ca884978.avif',
    h1: 'Workshops that ship evidence, not vibes.',
    intro:
      'Run client discovery, strategy offsites, and change-management sessions where every conclusion is backed by a tally. The slide deck writes itself — and it quotes the room, not your intern.',
  },
  '/features/ai-insights': {
    title: 'AI Insights for Live Sessions — Qesto',
    description:
      'See what your audience is thinking. Get themes from open responses in seconds, each backed by real answers from your room.',
    canonicalPath: '/features/ai-insights',
    ogImage: '/images/solutions/photo-1521737604893-d14cc237f11d.avif',
    h1: 'See what your audience is thinking, in real time.',
    intro:
      'Ask an open question. Get themes in seconds — each one backed by real responses from your room. Understand what people actually think without reading every answer, so you can adapt while the moment still matters.',
  },
  '/features/live-polling': {
    title: 'Live Polling for Meetings, Training & Events — Qesto',
    description:
      'Ask a question and see what your room is thinking in real time. Live polling for teachers, trainers, facilitators, and team leaders.',
    canonicalPath: '/features/live-polling',
    ogImage: '/images/solutions/photo-1572021335469-31706a17aaef.avif',
    h1: 'Ask a question. Hear from everyone.',
    intro:
      'Responses show up in real time as people answer. Everyone in the room can see what the group thinks — while the moment still matters. No app to install, no waiting for results.',
  },
  '/features/privacy': {
    title: 'Privacy by Default — Qesto',
    description:
      "Every Qesto session starts with a consent round. Participants choose whether they're identified, cohort-visible, or fully anonymous.",
    canonicalPath: '/features/privacy',
    ogImage: '/images/solutions/photo-1543269865-cbf427effbad.avif',
    h1: 'The room picks its posture.',
    intro:
      "Every Qesto session starts with a consent round. Participants choose whether they're identified, cohort-visible, or fully anonymous for the session. Results stay hidden until the minimum tally is met.",
  },
  '/use-cases/workshops': {
    title: 'Use case: Workshops | Hybrid facilitation craft',
    description:
      'Facilitate ideation and prioritization workshops with parallel idea capture, AI affinity clustering, and outputs that survive the handoff.',
    canonicalPath: '/use-cases/workshops',
    ogImage: '/images/solutions/photo-1704652070195-61e76e1466db.avif',
    h1: 'Facilitate hybrid workshops without losing the room.',
    intro:
      'Move from idea capture to prioritized decisions with digital workflows that give in-room and remote participants the same voice and the same view.',
  },
  '/use-cases/team-meetings': {
    title: 'Use case: Team meetings | Decisions with rationale',
    description:
      'Improve retros, planning, and decision checkpoints with consent rounds, ranked agendas, and recap exports into Slack, Notion, and Linear.',
    canonicalPath: '/use-cases/team-meetings',
    ogImage: '/images/solutions/photo-1551434678-e076c223a692.avif',
    h1: 'Run meetings that ship decisions, not just notes.',
    intro:
      'Use short structured rounds to replace circular debate, catch quiet disagreement before it becomes rework, and ship recaps straight into Slack, Notion, or Linear.',
  },
  '/use-cases/training': {
    title: 'Use case: Training | Live formative checks',
    description:
      'Run formative checks, confidence scales, and reflection prompts with real-time feedback — Kirkpatrick L1 and L2 evidence inside the session.',
    canonicalPath: '/use-cases/training',
    ogImage: '/images/solutions/photo-1434030216411-0b793f4b4173.avif',
    h1: 'Measure understanding while learning is still happening.',
    intro:
      'Use formative checks and confidence signals in-session to catch quiet learners, adapt delivery before the module ends, and produce L&D-grade evidence the program can act on.',
  },
  '/templates': {
    title: 'Qesto — Session Template Gallery',
    description:
      'Browse ready-made session templates, apply in one click, and start collecting live responses in minutes.',
    canonicalPath: '/templates',
    h1: 'Ready-made session templates',
    intro:
      'Created from real Qesto sessions. Anonymised, rewritten, and ready to use in minutes.',
  },
  '/trust/gdpr': {
    title: 'GDPR & Data Trust — Qesto',
    description:
      'How Qesto handles EU data, subprocessors, anonymity modes, and your rights under GDPR.',
    canonicalPath: '/trust/gdpr',
    h1: 'GDPR-ready by design',
    intro:
      "Qesto runs on Cloudflare's edge network. Session data is processed close to participants with privacy-by-default anonymity modes — including zero-knowledge sessions where individual identity is never stored.",
  },
  '/trust/soc2': {
    title: 'SOC 2 Type II — Qesto Trust',
    description:
      'Qesto SOC 2 program status (Type II in progress), security controls, and penetration test status.',
    canonicalPath: '/trust/soc2',
    h1: 'SOC 2 Type II',
    intro:
      'Qesto maintains a security and availability control framework aligned with the SOC 2 Type II trust service criteria (security, availability, and confidentiality). SOC 2 Type I controls are in place today; an independent Type II audit is targeted for 2027 Q3.',
  },
  '/marketplace': {
    title: 'Partner Marketplace — Qesto',
    description:
      'Discover Qesto partner integrations for Workday, Jira, Mattermost, and more.',
    canonicalPath: '/marketplace',
    h1: 'Integration marketplace',
    intro: 'Connect HR, engineering, and collaboration tools to your live sessions.',
  },
  '/developers': {
    title: 'Developer Portal — Qesto API v3',
    description:
      'Explore the Qesto Public API v3. Issue keys from your dashboard and integrate live sessions, results, and webhooks.',
    canonicalPath: '/developers',
    h1: 'Developer portal',
    intro: 'Public API v3 explorer. Issue keys from your dashboard and build on live Qesto sessions.',
  },
  '/partner/sla': {
    title: 'Partner SLA — Qesto',
    description:
      'Uptime, latency, and webhook delivery guarantees for Qesto partner integrations.',
    canonicalPath: '/partner/sla',
    h1: 'Service level agreement',
    intro: 'Transparent metrics for partner API and webhook integrations.',
  },
}

/**
 * Resolve the SEO metadata to inject for a given request path.
 * - Exact marketing route → its ROUTE_SEO entry.
 * - /templates/<id> → templates-gallery defaults, but with a SELF-referencing
 *   canonical so detail pages no longer canonicalize to the homepage (PageSeo
 *   still overrides title/description with the real template once JS runs).
 * - Anything else (app/noindex routes: /dashboard, /login, /sessions/*, …) →
 *   null, leaving the static shell untouched.
 */
export function resolveRouteSeo(pathname: string): RouteSeo | null {
  const normalized = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  const exact = ROUTE_SEO[normalized]
  if (exact) return exact

  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 2 && segments[0] === 'templates') {
    const gallery = ROUTE_SEO['/templates']
    return { ...gallery, canonicalPath: normalized }
  }

  return null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Build the no-JS body fallback for a route. Mirrors the inline-style pattern in
 * index.html (CSP allows 'unsafe-inline' for style-src). createRoot().render()
 * clears these children when React mounts, so JS visitors get the full app while
 * crawlers/tools that don't execute JS read a true per-route H1, lead copy, and
 * internal links. Returned as a trusted HTML string (inserted with { html: true }).
 */
export function renderFallbackHtml(seo: RouteSeo): string {
  const paragraphs = Array.isArray(seo.intro) ? seo.intro : [seo.intro]
  const intro = paragraphs
    .map(
      (p) =>
        `<p style="font-size: 18px; line-height: 1.55; margin: 0 0 24px">${escapeHtml(p)}</p>`,
    )
    .join('')
  const links = INTERNAL_LINKS.map(
    (l) => `<li><a href="${l.href}">${escapeHtml(l.label)}</a></li>`,
  ).join('')

  return `<main style="max-width: 760px; margin: 0 auto; padding: 64px 24px; font-family: system-ui, sans-serif">
        <h1 style="font-size: 40px; line-height: 1.1; margin: 0 0 16px">${escapeHtml(seo.h1)}</h1>
        ${intro}
        <nav aria-label="Primary">
          <ul style="line-height: 1.8">${links}</ul>
        </nav>
        <p><a href="/login">Launch your next session</a></p>
      </main>`
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// HTMLRewriter element handlers. HTMLRewriter is a built-in global in the
// Workers/Pages runtime, so no dependency is needed.
class SetText {
  constructor(private readonly value: string) {}
  element(element: Element) {
    // Default html:false → content is HTML-escaped (matches the &amp; in the shell title).
    element.setInnerContent(this.value)
  }
}

class SetAttr {
  constructor(
    private readonly attr: string,
    private readonly value: string,
  ) {}
  element(element: Element) {
    element.setAttribute(this.attr, this.value)
  }
}

class SetInnerHtml {
  constructor(private readonly html: string) {}
  element(element: Element) {
    element.setInnerContent(this.html, { html: true })
  }
}

// Appends the meta tags PageSeo adds client-side that aren't present in the
// static shell. og:title/og:description/og:url already exist in the shell and are
// rewritten in place, so they are intentionally NOT appended here (no duplicates).
class AppendExtraHead {
  constructor(private readonly seo: RouteSeo) {}
  element(element: Element) {
    const tags = [
      `<meta name="twitter:title" content="${escapeAttr(this.seo.title)}" />`,
      `<meta name="twitter:description" content="${escapeAttr(this.seo.description)}" />`,
    ]
    if (this.seo.ogImage) {
      const imageUrl = `${CANONICAL_ORIGIN}${this.seo.ogImage}`
      tags.push(`<meta property="og:image" content="${escapeAttr(imageUrl)}" />`)
      tags.push(`<meta name="twitter:image" content="${escapeAttr(imageUrl)}" />`)
    }
    element.append(tags.join('\n    '), { html: true })
  }
}

/**
 * Rewrite the static index.html shell so the server-returned HTML carries this
 * route's own <head> metadata and no-JS body fallback (Finding 1). Returns the
 * original response untouched for non-HTML responses or unmapped (app/noindex)
 * routes. HTMLRewriter.transform preserves status + headers, so the
 * public/_headers cache rules still apply.
 */
export function injectRouteSeo(response: Response, pathname: string): Response {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) return response

  const seo = resolveRouteSeo(pathname)
  if (!seo) return response

  const canonicalUrl = `${CANONICAL_ORIGIN}${seo.canonicalPath}`

  return new HTMLRewriter()
    .on('title', new SetText(seo.title))
    .on('meta[name="description"]', new SetAttr('content', seo.description))
    .on('link[rel="canonical"]', new SetAttr('href', canonicalUrl))
    .on('meta[property="og:title"]', new SetAttr('content', seo.title))
    .on('meta[property="og:description"]', new SetAttr('content', seo.description))
    .on('meta[property="og:url"]', new SetAttr('content', canonicalUrl))
    .on('head', new AppendExtraHead(seo))
    .on('div#root', new SetInnerHtml(renderFallbackHtml(seo)))
    .transform(response)
}

export { CANONICAL_ORIGIN }

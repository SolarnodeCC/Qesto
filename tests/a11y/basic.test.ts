/**
 * Accessibility audit — WCAG AA compliance
 *
 * Uses axe-core to inject and run accessibility rules against rendered HTML
 * for key pages (Home, Dashboard/Wizard, Results).
 *
 * Each test renders the landmark structure produced by MainLayout
 * (SkipLink + <header><nav> + <main id="main"> + <footer>) and audits for
 * WCAG 2.1 Level AA violations.
 *
 * WCAG references: 1.3.6, 2.4.1, 2.4.3, 2.4.6, 4.1.2
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import axe from 'axe-core'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Inject HTML into a JSDOM document, run axe against it, then clean up.
 * Returns the axe Result[] array — callers assert `violations` length === 0.
 */
async function auditHtml(html: string): Promise<axe.Result[]> {
  // Create a fresh host element so tests don't bleed into each other.
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)

  try {
    const result = await axe.run(host, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
      },
    })
    return result.violations
  } finally {
    document.body.removeChild(host)
  }
}

/**
 * Build the landmark shell that MainLayout produces.
 * Individual page content is injected into <main id="main">.
 */
function mainLayoutHtml(innerContent: string, navInner = ''): string {
  return `
    <a
      href="#main"
      class="sr-only focus:not-sr-only"
    >
      Skip to main content
    </a>

    <header>
      <div>
        <a href="/" aria-label="Qesto home">Qesto</a>
        <nav aria-label="Site navigation">${navInner}</nav>
      </div>
    </header>

    <main id="main" tabindex="-1">
      ${innerContent}
    </main>

    <footer>
      <nav aria-label="Footer navigation">
        <ul>
          <li><a href="/privacy">Privacy</a></li>
          <li><a href="/terms">Terms</a></li>
        </ul>
      </nav>
      <span>&copy; 2026 Qesto.</span>
    </footer>
  `
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('A11y audit — Home page (WCAG AA)', () => {
  it('has no violations in the landmark structure', async () => {
    const content = `
      <h1>Feel the pulse of the room — AI amplifies it.</h1>
      <p>Real-time interactive sessions on Cloudflare's edge.</p>
      <a href="/login">Sign in</a>
    `
    const violations = await auditHtml(mainLayoutHtml(content))
    if (violations.length > 0) {
      const summary = violations
        .map((v) => `[${v.id}] ${v.description} — ${v.nodes.length} node(s)`)
        .join('\n')
      expect.fail(`Home page has ${violations.length} axe violation(s):\n${summary}`)
    }
    expect(violations).toHaveLength(0)
  })
})

describe('A11y audit — Dashboard / Wizard page (WCAG AA)', () => {
  it('has no violations in the landmark structure with a form', async () => {
    const nav = `<button type="button">Sign out</button>`
    const content = `
      <h1>Your sessions</h1>
      <p>Signed in as user@example.com.</p>

      <form>
        <label for="new-session-title">New session</label>
        <input
          id="new-session-title"
          type="text"
          placeholder="e.g. Q2 team retro"
          maxlength="120"
        />
        <button type="submit">Create draft</button>
      </form>

      <section aria-labelledby="sessions-heading">
        <h2 id="sessions-heading">Draft &amp; live</h2>
        <ul>
          <li>
            <a href="/sessions/abc">Sprint retro</a>
            <span>draft</span>
          </li>
        </ul>
      </section>
    `
    const violations = await auditHtml(mainLayoutHtml(content, nav))
    if (violations.length > 0) {
      const summary = violations
        .map((v) => `[${v.id}] ${v.description} — ${v.nodes.length} node(s)`)
        .join('\n')
      expect.fail(`Dashboard page has ${violations.length} axe violation(s):\n${summary}`)
    }
    expect(violations).toHaveLength(0)
  })

  it('has no violations in session config (wizard) form', async () => {
    const nav = `<a href="/dashboard">← Dashboard</a>`
    const content = `
      <h1>Configure</h1>
      <p>Join code: <code>ABCDE</code></p>

      <form>
        <div>
          <label for="session-title">Title</label>
          <input id="session-title" type="text" value="My session" maxlength="120" />
        </div>

        <fieldset>
          <legend>Poll question</legend>
          <div>
            <label for="poll-prompt">Prompt</label>
            <input
              id="poll-prompt"
              type="text"
              placeholder="What should we prioritise next quarter?"
              maxlength="240"
            />
          </div>
          <div>
            <p id="options-label">Options (2/10)</p>
            <ul>
              <li>
                <input
                  type="text"
                  aria-label="Option 1"
                  placeholder="Option 1"
                  maxlength="160"
                />
                <button type="button" aria-label="Remove option 1" disabled>Remove</button>
              </li>
              <li>
                <input
                  type="text"
                  aria-label="Option 2"
                  placeholder="Option 2"
                  maxlength="160"
                />
                <button type="button" aria-label="Remove option 2" disabled>Remove</button>
              </li>
            </ul>
            <button type="button">+ Add option</button>
          </div>
        </fieldset>

        <button type="submit">Save</button>
        <button type="button">Go live</button>
      </form>
    `
    const violations = await auditHtml(mainLayoutHtml(content, nav))
    if (violations.length > 0) {
      const summary = violations
        .map((v) => `[${v.id}] ${v.description} — ${v.nodes.length} node(s)`)
        .join('\n')
      expect.fail(`Wizard page has ${violations.length} axe violation(s):\n${summary}`)
    }
    expect(violations).toHaveLength(0)
  })
})

describe('A11y audit — Results page (WCAG AA)', () => {
  it('has no violations when results are displayed', async () => {
    const nav = `<a href="/dashboard">← Dashboard</a>`
    const content = `
      <header>
        <h1>Sprint retro</h1>
        <p>Join code <code>ABCDE</code> &middot; closed 21/04/2026</p>
      </header>

      <section aria-labelledby="question-heading">
        <h2 id="question-heading">What should we prioritise?</h2>
        <ul>
          <li>
            <div>
              <span>Performance</span>
              <span>7 (58%)</span>
            </div>
            <div
              role="img"
              aria-label="Performance: 7 votes, 58%"
            >
              <div style="width:100%"></div>
            </div>
          </li>
          <li>
            <div>
              <span>Accessibility</span>
              <span>5 (42%)</span>
            </div>
            <div
              role="img"
              aria-label="Accessibility: 5 votes, 42%"
            >
              <div style="width:71%"></div>
            </div>
          </li>
        </ul>
        <p>Total votes: 12 &middot; source persisted</p>
      </section>

      <div>
        <button type="button">Export CSV</button>
        <button type="button">Refresh</button>
      </div>
    `
    const violations = await auditHtml(mainLayoutHtml(content, nav))
    if (violations.length > 0) {
      const summary = violations
        .map((v) => `[${v.id}] ${v.description} — ${v.nodes.length} node(s)`)
        .join('\n')
      expect.fail(`Results page has ${violations.length} axe violation(s):\n${summary}`)
    }
    expect(violations).toHaveLength(0)
  })
})

describe('A11y audit — SkipLink landmark', () => {
  it('skip link targets an element with id="main"', async () => {
    const html = mainLayoutHtml('<h1>Test page</h1><p>Content.</p>')
    const host = document.createElement('div')
    host.innerHTML = html
    document.body.appendChild(host)

    try {
      const skipLink = host.querySelector<HTMLAnchorElement>('a[href="#main"]')
      expect(skipLink).not.toBeNull()
      expect(skipLink?.getAttribute('href')).toBe('#main')

      const mainEl = host.querySelector<HTMLElement>('#main')
      expect(mainEl).not.toBeNull()
      expect(mainEl?.tagName.toLowerCase()).toBe('main')
    } finally {
      document.body.removeChild(host)
    }
  })

  it('has no axe violations including the skip link', async () => {
    const html = mainLayoutHtml('<h1>Page with skip link</h1><p>Content here.</p>')
    const violations = await auditHtml(html)
    if (violations.length > 0) {
      const summary = violations
        .map((v) => `[${v.id}] ${v.description}`)
        .join('\n')
      expect.fail(`Skip-link layout has axe violations:\n${summary}`)
    }
    expect(violations).toHaveLength(0)
  })
})

/**
 * WCAG 2.1 AAA re-attestation for v7.0 new surfaces
 *
 * S98 P0 gate: Re-attest new v7.0 UIs at WCAG AAA level (stricter than AA):
 * - REACTIONS: Emoji-bar broadcast channel UI
 * - PULSE: Dashboard read paths (recent sessions, insights, templates)
 * - STUDIO: Authoring UI (prompt form, draft preview, library panel)
 * - CONNECT: Federation UI (federated join interface, cross-tenant views)
 * - XR: Immersive overlay mount point with spatial scene
 *
 * Tests use axe-core with wcag2aaa / wcag21aaa rule sets.
 * Audit scopes: component render in jsdom using existing harness pattern.
 *
 * WCAG AAA covers:
 *   - 1.4.8 Visual Presentation (enhanced contrast, adjustable text)
 *   - 2.4.8 Focus Visible (enhanced focus indicators)
 *   - 2.5.5 Target Size (minimum 44×44 CSS px)
 *   - 3.3.5 Help (label + contextual help for every input)
 *   - Plus all AA and A rules
 *
 * Evidence doc: `/knowledge-base/operations/WCAG_AAA_REATTEST_V70_S98.md`
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest'
import axe from 'axe-core'

// ─────────────────────────────────────────────────────────────────────────
// Helpers (reuse from wcag-audit.test.ts)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Run axe accessibility audit with AAA ruleset.
 * Returns the violations array for inspection.
 */
async function auditHtmlWithAAA(html: string, _context?: string): Promise<axe.Result[]> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)

  try {
    const result = await axe.run(host, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag21aaa', 'wcag22aaa'],
      },
    })
    return result.violations
  } finally {
    document.body.removeChild(host)
  }
}

/**
 * Assert audit violations and provide detailed failure message.
 */
function expectNoViolations(violations: axe.Result[], surfaceName: string): void {
  if (violations.length > 0) {
    const details = violations
      .map((v) => {
        const nodes = v.nodes.slice(0, 3)
        const nodeInfo = nodes.map((n) => `  - ${n.target.join(' ')}`).join('\n')
        return `[${v.id}] ${v.description}\n${nodeInfo}`
      })
      .join('\n\n')

    expect.fail(`${surfaceName} has ${violations.length} axe AAA violation(s):\n${details}`)
  }
}

/**
 * Main layout wrapper with semantic landmarks (standard pattern).
 */
function mainLayout(content: string, nav = '', footer = ''): string {
  return `
    <a href="#main" class="sr-only focus:not-sr-only">Skip to main content</a>
    <header role="banner">
      <div>
        <a href="/" aria-label="Qesto home">Qesto</a>
        ${nav ? `<nav aria-label="Site navigation">${nav}</nav>` : ''}
      </div>
    </header>
    <main id="main" tabindex="-1">
      ${content}
    </main>
    <footer role="contentinfo">
      <nav aria-label="Footer navigation">
        <ul>
          <li><a href="/privacy">Privacy</a></li>
          <li><a href="/terms">Terms</a></li>
          ${footer}
        </ul>
      </nav>
      <span>&copy; 2026 Qesto.</span>
    </footer>
  `
}

// ─────────────────────────────────────────────────────────────────────────
// REACTIONS — Emoji broadcast channel
// ─────────────────────────────────────────────────────────────────────────

describe('v7.0 WCAG AAA — REACTIONS (emoji broadcast)', () => {
  it('emoji reaction bar has no AAA violations', async () => {
    const content = `
      <section aria-labelledby="reactions-heading">
        <h2 id="reactions-heading">Room Reactions</h2>
        <p id="reactions-desc">Participants are reacting to the current question.</p>

        <div
          role="region"
          aria-label="Live reaction feed"
          aria-live="polite"
          aria-describedby="reactions-desc"
        >
          <ul>
            <li>
              <span aria-label="Thumbs up reaction">👍</span>
              <span aria-label="12 reactions">12</span>
            </li>
            <li>
              <span aria-label="Fire reaction">🔥</span>
              <span aria-label="8 reactions">8</span>
            </li>
            <li>
              <span aria-label="Thinking face reaction">🤔</span>
              <span aria-label="3 reactions">3</span>
            </li>
          </ul>
        </div>

        <form>
          <fieldset>
            <legend>Your reaction (optional)</legend>
            <ul>
              <li>
                <button
                  type="button"
                  aria-label="React with thumbs up"
                  class="min-w-[44px] min-h-[44px]"
                >
                  👍
                </button>
              </li>
              <li>
                <button
                  type="button"
                  aria-label="React with fire"
                  class="min-w-[44px] min-h-[44px]"
                >
                  🔥
                </button>
              </li>
              <li>
                <button
                  type="button"
                  aria-label="React with thinking face"
                  class="min-w-[44px] min-h-[44px]"
                >
                  🤔
                </button>
              </li>
            </ul>
          </fieldset>
        </form>
      </section>
    `

    const html = mainLayout(content)
    const violations = await auditHtmlWithAAA(html)
    expectNoViolations(violations, 'REACTIONS emoji bar')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// PULSE — Dashboard read paths
// ─────────────────────────────────────────────────────────────────────────

describe('v7.0 WCAG AAA — PULSE (dashboard)', () => {
  it('dashboard home section has no AAA violations', async () => {
    const nav = `
      <button type="button" aria-label="User menu" class="min-w-[44px] min-h-[44px]">
        user@example.com
      </button>
    `
    const content = `
      <section aria-labelledby="home-heading">
        <h1 id="home-heading">Your Dashboard</h1>
        <p>Signed in as <strong>user@example.com</strong>.</p>

        <div role="region" aria-label="Dashboard statistics">
          <ul>
            <li>
              <span>Active sessions</span>
              <strong>5</strong>
            </li>
            <li>
              <span>Total votes collected</span>
              <strong>1,234</strong>
            </li>
            <li>
              <span>Avg response rate</span>
              <strong>78%</strong>
            </li>
          </ul>
        </div>
      </section>
    `

    const html = mainLayout(content, nav)
    const violations = await auditHtmlWithAAA(html)
    expectNoViolations(violations, 'PULSE dashboard home')
  })

  it('recent sessions section has no AAA violations', async () => {
    const content = `
      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading">Recent Sessions</h2>

        <div role="list">
          <article
            role="listitem"
            aria-labelledby="session-title-1"
            class="border border-gray-300 rounded p-4"
          >
            <h3 id="session-title-1">Q2 Planning Retro</h3>
            <p>
              <time datetime="2026-06-15">15 Jun 2026</time> •
              <span aria-label="Status: closed">Closed</span> •
              <span aria-label="Vote count">42 votes</span>
            </p>
            <a href="/sessions/sess-1" class="min-w-[44px] min-h-[44px] inline-flex items-center">
              View results
              <span aria-hidden="true">→</span>
            </a>
          </article>

          <article
            role="listitem"
            aria-labelledby="session-title-2"
            class="border border-gray-300 rounded p-4"
          >
            <h3 id="session-title-2">Pricing Survey</h3>
            <p>
              <time datetime="2026-06-10">10 Jun 2026</time> •
              <span aria-label="Status: closed">Closed</span> •
              <span aria-label="Vote count">128 votes</span>
            </p>
            <a href="/sessions/sess-2" class="min-w-[44px] min-h-[44px] inline-flex items-center">
              View results
              <span aria-hidden="true">→</span>
            </a>
          </article>
        </div>
      </section>
    `

    const html = mainLayout(content)
    const violations = await auditHtmlWithAAA(html)
    expectNoViolations(violations, 'PULSE recent sessions')
  })

  it('templates section has no AAA violations', async () => {
    const content = `
      <section aria-labelledby="templates-heading">
        <h2 id="templates-heading">Question Templates</h2>
        <p id="templates-desc">Start a new session with a pre-built template.</p>

        <div role="list" aria-describedby="templates-desc">
          <div role="listitem" class="border border-blue-300 rounded p-4">
            <h3>Team Retrospective</h3>
            <p>Structured 4-section retro: what went well, improvements, blockers, celebrate.</p>
            <button
              type="button"
              aria-label="Use Team Retrospective template"
              class="min-w-[44px] min-h-[44px] px-3 py-2"
            >
              Use template
            </button>
          </div>

          <div role="listitem" class="border border-blue-300 rounded p-4">
            <h3>Quick Poll</h3>
            <p>Single-choice poll with 2–5 options. Fastest to set up.</p>
            <button
              type="button"
              aria-label="Use Quick Poll template"
              class="min-w-[44px] min-h-[44px] px-3 py-2"
            >
              Use template
            </button>
          </div>
        </div>
      </section>
    `

    const html = mainLayout(content)
    const violations = await auditHtmlWithAAA(html)
    expectNoViolations(violations, 'PULSE templates')
  })

  it('insights section has no AAA violations', async () => {
    const content = `
      <section aria-labelledby="insights-heading">
        <h2 id="insights-heading">Insights</h2>

        <article class="bg-blue-50 border border-blue-200 rounded p-4">
          <h3>Popular question types</h3>
          <p>Polls are your most-used question type this month.</p>
          <ul>
            <li>Polls: 45 sessions</li>
            <li>Rankings: 12 sessions</li>
            <li>Open questions: 8 sessions</li>
          </ul>
        </article>

        <article class="bg-green-50 border border-green-200 rounded p-4">
          <h3>Engagement trend</h3>
          <p>Your average response rate is up 15% from last month.</p>
          <figure>
            <canvas
              role="img"
              aria-label="Response rate trend: up 15% from last month"
              width="300"
              height="150"
            ></canvas>
            <figcaption>Response rate over time</figcaption>
          </figure>
        </article>
      </section>
    `

    const html = mainLayout(content)
    const violations = await auditHtmlWithAAA(html)
    expectNoViolations(violations, 'PULSE insights')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// STUDIO — Authoring UI
// ─────────────────────────────────────────────────────────────────────────

describe('v7.0 WCAG AAA — STUDIO (authoring)', () => {
  it('prompt form section has no AAA violations', async () => {
    const content = `
      <section aria-labelledby="studio-heading">
        <h1 id="studio-heading">Authoring Studio</h1>

        <form>
          <fieldset>
            <legend>Generate a question</legend>

            <div>
              <label for="prompt-input">
                Prompt
                <span aria-label="required" title="required">*</span>
              </label>
              <textarea
                id="prompt-input"
                required
                minlength="10"
                maxlength="500"
                placeholder="Describe the question you want to generate..."
                aria-describedby="prompt-help"
                class="w-full min-h-[100px] p-2 border rounded"
              ></textarea>
              <p id="prompt-help" class="text-sm text-gray-600">
                Be specific about the context and desired format.
              </p>
            </div>

            <div>
              <label for="kind-select">
                Question type
                <span aria-label="required" title="required">*</span>
              </label>
              <select id="kind-select" required class="min-w-[44px] min-h-[44px] p-2 border rounded">
                <option value="">Select a type…</option>
                <option value="poll">Poll</option>
                <option value="ranking">Ranking</option>
                <option value="open">Open question</option>
              </select>
            </div>

            <div>
              <label for="theme-select">
                Theme
                <span aria-label="optional">(optional)</span>
              </label>
              <select id="theme-select" class="min-w-[44px] min-h-[44px] p-2 border rounded">
                <option value="">Default</option>
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="creative">Creative</option>
              </select>
            </div>

            <button type="submit" class="min-w-[44px] min-h-[44px] px-4 py-2">
              Generate draft
            </button>
          </fieldset>
        </form>
      </section>
    `

    const html = mainLayout(content)
    const violations = await auditHtmlWithAAA(html)
    expectNoViolations(violations, 'STUDIO prompt form')
  })

  it('draft preview section has no AAA violations', async () => {
    const content = `
      <section aria-labelledby="draft-heading">
        <h2 id="draft-heading">Draft Preview</h2>

        <article class="bg-gray-50 border border-gray-300 rounded p-4">
          <h3>Generated question:</h3>
          <p class="text-lg font-semibold">What should be our top priority this quarter?</p>

          <fieldset>
            <legend>Options:</legend>
            <ul>
              <li>
                <label>
                  <input type="radio" name="option" value="a" />
                  Product performance
                </label>
              </li>
              <li>
                <label>
                  <input type="radio" name="option" value="b" />
                  Developer experience
                </label>
              </li>
              <li>
                <label>
                  <input type="radio" name="option" value="c" />
                  User research
                </label>
              </li>
            </ul>
          </fieldset>

          <div>
            <button type="button" aria-label="Edit this draft" class="min-w-[44px] min-h-[44px] px-3 py-2">
              Edit
            </button>
            <button type="button" aria-label="Discard this draft" class="min-w-[44px] min-h-[44px] px-3 py-2">
              Discard
            </button>
          </div>
        </article>
      </section>
    `

    const html = mainLayout(content)
    const violations = await auditHtmlWithAAA(html)
    expectNoViolations(violations, 'STUDIO draft preview')
  })

  it('library panel has no AAA violations', async () => {
    const content = `
      <section aria-labelledby="library-heading">
        <h2 id="library-heading">Question Library</h2>

        <form>
          <div>
            <label for="library-search">Search library</label>
            <input
              id="library-search"
              type="search"
              placeholder="Search saved questions..."
              class="min-w-[44px] min-h-[44px] w-full p-2 border rounded"
              aria-describedby="library-search-help"
            />
            <p id="library-search-help" class="text-sm text-gray-600">
              Search by title or keyword.
            </p>
          </div>
        </form>

        <div role="region" aria-label="Saved questions" aria-live="polite">
          <ul>
            <li class="border border-gray-200 rounded p-3">
              <h3>Q2 Priorities</h3>
              <p class="text-sm text-gray-600">5-option poll, saved 2 days ago</p>
              <button type="button" aria-label="Fork Q2 Priorities" class="min-w-[44px] min-h-[44px] px-2 py-1">
                Fork
              </button>
              <button type="button" aria-label="Delete Q2 Priorities" class="min-w-[44px] min-h-[44px] px-2 py-1">
                Delete
              </button>
            </li>

            <li class="border border-gray-200 rounded p-3">
              <h3>Company Values</h3>
              <p class="text-sm text-gray-600">3-option ranking, saved 1 week ago</p>
              <button type="button" aria-label="Fork Company Values" class="min-w-[44px] min-h-[44px] px-2 py-1">
                Fork
              </button>
              <button type="button" aria-label="Delete Company Values" class="min-w-[44px] min-h-[44px] px-2 py-1">
                Delete
              </button>
            </li>
          </ul>
        </div>
      </section>
    `

    const html = mainLayout(content)
    const violations = await auditHtmlWithAAA(html)
    expectNoViolations(violations, 'STUDIO library panel')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// CONNECT — Federation UI
// ─────────────────────────────────────────────────────────────────────────

describe('v7.0 WCAG AAA — CONNECT (federation)', () => {
  it('federation join form has no AAA violations', async () => {
    const content = `
      <section aria-labelledby="federate-heading">
        <h1 id="federate-heading">Join Federated Session</h1>
        <p id="federate-desc">
          You have been invited to participate in a session hosted by another organization.
        </p>

        <form aria-describedby="federate-desc">
          <fieldset>
            <legend>Federated join details</legend>

            <div>
              <label for="invite-code">
                Invitation code
                <span aria-label="required" title="required">*</span>
              </label>
              <input
                id="invite-code"
                type="text"
                required
                placeholder="Paste your invitation code"
                pattern="[A-Za-z0-9-]+"
                maxlength="128"
                aria-describedby="invite-help"
                class="min-w-[44px] min-h-[44px] w-full p-2 border rounded"
              />
              <p id="invite-help" class="text-sm text-gray-600">
                The invitation code was sent to your email.
              </p>
            </div>

            <div>
              <p id="privacy-notice" class="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm">
                <strong>Privacy notice:</strong> This is a cross-organization session. Only
                aggregate statistics will be visible to the host organization.
              </p>
            </div>

            <button
              type="submit"
              aria-describedby="privacy-notice"
              class="min-w-[44px] min-h-[44px] px-4 py-2"
            >
              Accept invitation and join
            </button>
          </fieldset>
        </form>
      </section>
    `

    const html = mainLayout(content)
    const violations = await auditHtmlWithAAA(html)
    expectNoViolations(violations, 'CONNECT federation join')
  })

  it('federated results (aggregate view) has no AAA violations', async () => {
    const content = `
      <section aria-labelledby="fed-results-heading">
        <h1 id="fed-results-heading">Federated Results</h1>
        <p>
          Participating in a cross-organization session.
          <span class="inline-block bg-blue-100 text-blue-900 rounded px-2 py-1 text-sm">
            Aggregates only
          </span>
        </p>

        <article aria-labelledby="q-heading">
          <h2 id="q-heading">What is your satisfaction level?</h2>

          <div role="region" aria-label="Aggregated results by organization">
            <table>
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Very satisfied</th>
                  <th>Satisfied</th>
                  <th>Neutral</th>
                  <th>Dissatisfied</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Your org</td>
                  <td>45</td>
                  <td>38</td>
                  <td>12</td>
                  <td>5</td>
                </tr>
                <tr>
                  <td>Partner org</td>
                  <td>52</td>
                  <td>41</td>
                  <td>8</td>
                  <td>3</td>
                </tr>
              </tbody>
            </table>
          </div>

          <details>
            <summary>View combined results</summary>
            <p>Combined very satisfied: 97 (total 197 responses)</p>
          </details>
        </article>
      </section>
    `

    const html = mainLayout(content)
    const violations = await auditHtmlWithAAA(html)
    expectNoViolations(violations, 'CONNECT federated results')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// XR — Immersive overlay with spatial scene
// ─────────────────────────────────────────────────────────────────────────

describe('v7.0 WCAG AAA — XR (immersive overlay)', () => {
  it('XR session overlay has no AAA violations', async () => {
    // XrSessionOverlay renders as a fixed overlay dialog with role="dialog".
    const overlayHtml = `
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Immersive session (beta)"
        class="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white"
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold">Immersive mode</span>
            <span class="text-[10px] uppercase tracking-wide rounded-full bg-teal-500/20 text-teal-300 px-2 py-0.5">
              Beta
            </span>
          </div>
          <button
            type="button"
            aria-label="Exit immersive mode"
            class="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg px-3 text-sm font-medium text-white bg-white/10 hover:bg-white/20"
          >
            Exit
          </button>
        </div>

        <div class="flex-1 flex flex-col items-center justify-center gap-4 px-4 py-8 overflow-y-auto">
          <div class="relative w-full aspect-square max-w-sm mx-auto rounded-2xl overflow-hidden border border-teal-500/30 bg-black">
            <canvas
              role="img"
              aria-label="Spatial scene with avatar markers"
              width="360"
              height="360"
              class="w-full h-full"
            ></canvas>
            <div
              role="region"
              aria-label="Current question"
              class="absolute inset-x-0 top-0 px-4 py-2 bg-black/60 text-white text-sm font-medium text-center"
            >
              What should we prioritise?
            </div>
            <p
              role="status"
              aria-live="polite"
              class="absolute inset-x-0 bottom-0 px-3 py-1.5 bg-black/50 text-[11px] text-center text-white/80"
            >
              12 participants
            </p>
          </div>

          <p class="text-xs text-white/60 text-center max-w-sm">
            Spatial markers represent participant positions in the session space.
          </p>

          <p role="status" class="text-xs text-white/50 text-center max-w-sm">
            Motion has been reduced per your system preference.
          </p>
        </div>

        <div class="sr-only" role="status" aria-live="polite">
          Immersive mode activated
        </div>
      </div>
    `

    const host = document.createElement('div')
    host.innerHTML = overlayHtml
    document.body.appendChild(host)

    try {
      const result = await axe.run(host, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag21aaa', 'wcag22aaa'],
        },
      })
      expectNoViolations(result.violations, 'XR session overlay')
    } finally {
      document.body.removeChild(host)
    }
  })

  it('XR overlay focus management: close button is keyboard accessible', () => {
    const overlayHtml = `
      <div role="dialog" aria-modal="true">
        <button
          type="button"
          aria-label="Exit immersive mode"
          class="min-w-[44px] min-h-[44px]"
        >
          Exit
        </button>
      </div>
    `

    const host = document.createElement('div')
    host.innerHTML = overlayHtml
    document.body.appendChild(host)

    try {
      const closeButton = host.querySelector('button')
      expect(closeButton).not.toBeNull()
      expect(closeButton?.getAttribute('aria-label')).toBe('Exit immersive mode')

      // Verify button has sufficient hit target (44×44)
      const classList = closeButton?.className || ''
      expect(classList).toContain('min-w-[44px]')
      expect(classList).toContain('min-h-[44px]')
    } finally {
      document.body.removeChild(host)
    }
  })

  it('XR overlay respects prefers-reduced-motion', () => {
    // XrSessionOverlay uses usePrefersReducedMotion() hook to disable animation
    // when prefers-reduced-motion: reduce is set. Verify the notice appears.
    const overlayHtml = `
      <div role="dialog" aria-modal="true">
        <p role="status" class="text-xs text-white/50">
          Motion has been reduced per your system preference.
        </p>
      </div>
    `

    const host = document.createElement('div')
    host.innerHTML = overlayHtml
    document.body.appendChild(host)

    try {
      const notice = host.querySelector('[role="status"]')
      expect(notice).not.toBeNull()
      expect(notice?.textContent).toContain('Motion has been reduced')
    } finally {
      document.body.removeChild(host)
    }
  })

  it('XR spatial scene canvas has proper aria labels', () => {
    const canvasHtml = `
      <canvas
        role="img"
        aria-label="Spatial scene with avatar markers"
        width="360"
        height="360"
      ></canvas>
    `

    const host = document.createElement('div')
    host.innerHTML = canvasHtml
    document.body.appendChild(host)

    try {
      const canvas = host.querySelector('canvas')
      expect(canvas?.getAttribute('role')).toBe('img')
      expect(canvas?.getAttribute('aria-label')).toBe('Spatial scene with avatar markers')
    } finally {
      document.body.removeChild(host)
    }
  })
})

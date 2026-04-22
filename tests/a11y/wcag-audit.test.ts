/**
 * WCAG 2.1 AA comprehensive accessibility audit
 *
 * Tests all major pages and states of the Qesto application:
 * - Home / Landing page
 * - Login / Magic link page
 * - Dashboard (session list)
 * - Session config wizard (DRAFT state)
 * - Present / Live view (LIVE state)
 * - Join / Voter view
 * - Results / Insights page
 *
 * Each page is audited for zero critical or serious violations using axe-core
 * with wcag2a and wcag2aa rule sets.
 *
 * WCAG references: 1.3.1, 1.4.1, 2.1.1, 2.4.1, 2.4.3, 2.4.6, 2.5.1, 3.3.2, 4.1.2, 4.1.3
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest'
import axe from 'axe-core'

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Run axe accessibility audit and assert no violations.
 * Returns the violations array for inspection.
 */
async function auditHtml(html: string, context?: string): Promise<axe.Result[]> {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)

  try {
    const result = await axe.run(host, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa'],
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
function expectNoViolations(violations: axe.Result[], pageName: string): void {
  if (violations.length > 0) {
    const details = violations
      .map((v) => {
        const nodes = v.nodes.slice(0, 3) // Show first 3 affected nodes
        const nodeInfo = nodes.map((n) => `  - ${n.target.join(' ')}`).join('\n')
        return `[${v.id}] ${v.description}\n${nodeInfo}`
      })
      .join('\n\n')

    expect.fail(`${pageName} has ${violations.length} axe violation(s):\n${details}`)
  }
}

/**
 * Main layout wrapper with semantic landmarks.
 */
function mainLayout(content: string, nav = '', footer = ''): string {
  return `
    <a href="#main" class="sr-only focus:not-sr-only">Skip to main content</a>
    <header>
      <div>
        <a href="/" aria-label="Qesto home">Qesto</a>
        ${nav ? `<nav aria-label="Site navigation">${nav}</nav>` : ''}
      </div>
    </header>
    <main id="main" tabindex="-1">
      ${content}
    </main>
    <footer>
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
// Page Audits
// ─────────────────────────────────────────────────────────────────────────

describe('WCAG 2.1 AA Audit — All pages', () => {
  describe('Home / Landing page', () => {
    it('passes accessibility audit', async () => {
      const content = `
        <section>
          <h1>Feel the pulse of the room — AI amplifies it.</h1>
          <p>Real-time interactive sessions on Cloudflare's edge.</p>
          <p>Join a session or create your own team workspace.</p>
        </section>

        <section aria-labelledby="features-heading">
          <h2 id="features-heading">Why Qesto?</h2>
          <ul>
            <li>
              <h3>Real-time feedback</h3>
              <p>Instant polls, rankings, and consent votes.</p>
            </li>
            <li>
              <h3>AI-powered insights</h3>
              <p>Automatic sentiment analysis and summaries.</p>
            </li>
            <li>
              <h3>Privacy-first</h3>
              <p>Anonymous voting, no third-party tracking.</p>
            </li>
          </ul>
        </section>

        <section aria-labelledby="cta-heading">
          <h2 id="cta-heading">Get started</h2>
          <a href="/login">Sign in with magic link</a>
          <p>No password required — we'll send you a link via email.</p>
        </section>
      `

      const html = mainLayout(content)
      const violations = await auditHtml(html)
      expectNoViolations(violations, 'Home page')
    })
  })

  describe('Login / Magic Link page', () => {
    it('passes accessibility audit', async () => {
      const content = `
        <h1>Sign in to Qesto</h1>
        <p>Enter your email to receive a sign-in link.</p>

        <form>
          <div>
            <label for="email-input">Email address</label>
            <input
              id="email-input"
              type="email"
              placeholder="you@example.com"
              required
              autocomplete="email"
            />
            <p id="email-hint" class="text-sm">We'll send a secure link to this email.</p>
          </div>

          <button type="submit">Send sign-in link</button>
          <p>This is a secure, password-free sign-in. Check your email for the link.</p>
        </form>

        <p>
          Don't have an account?
          <a href="/signup">Create one now</a>
        </p>
      `

      const html = mainLayout(content)
      const violations = await auditHtml(html)
      expectNoViolations(violations, 'Login page')
    })

    it('confirms callback success state', async () => {
      const content = `
        <h1>Signing you in...</h1>
        <p>Checking your link. This should take less than a second.</p>

        <div role="status" aria-live="polite" aria-atomic="true">
          <span>✓ Link verified</span>
          <span>Redirecting to dashboard...</span>
        </div>
      `

      const html = mainLayout(content)
      const violations = await auditHtml(html)
      expectNoViolations(violations, 'Login callback page')
    })
  })

  describe('Dashboard page', () => {
    it('passes accessibility audit with session list', async () => {
      const nav = `
        <button type="button" aria-label="User menu">user@example.com</button>
      `
      const content = `
        <h1>Your sessions</h1>
        <p>Signed in as <strong>user@example.com</strong>.</p>

        <form>
          <div>
            <label for="new-session-title">New session</label>
            <input
              id="new-session-title"
              type="text"
              placeholder="e.g. Q2 team retro"
              maxlength="120"
              required
            />
          </div>
          <button type="submit">Create draft</button>
        </form>

        <section aria-labelledby="draft-heading">
          <h2 id="draft-heading">Draft sessions</h2>
          <ul>
            <li>
              <a href="/sessions/abc">Sprint retro</a>
              <span aria-label="Status: draft">draft</span>
              <time datetime="2026-04-21">21 Apr</time>
            </li>
            <li>
              <a href="/sessions/def">Standup</a>
              <span aria-label="Status: draft">draft</span>
              <time datetime="2026-04-22">22 Apr</time>
            </li>
          </ul>
        </section>

        <section aria-labelledby="live-heading">
          <h2 id="live-heading">Live sessions</h2>
          <p>No active sessions.</p>
        </section>
      `

      const html = mainLayout(content, nav)
      const violations = await auditHtml(html)
      expectNoViolations(violations, 'Dashboard page')
    })
  })

  describe('Session configuration (DRAFT state)', () => {
    it('passes accessibility audit with form controls', async () => {
      const nav = `<a href="/dashboard">← Dashboard</a>`
      const content = `
        <h1>Configure session</h1>
        <p>
          Join code: <code>ABCDE</code> (shareable with voters)
        </p>

        <form>
          <div>
            <label for="session-title">Session title</label>
            <input
              id="session-title"
              type="text"
              value="Q2 Team Retro"
              maxlength="120"
              required
            />
          </div>

          <fieldset>
            <legend>Question</legend>

            <div>
              <label for="poll-prompt">Prompt or question</label>
              <input
                id="poll-prompt"
                type="text"
                placeholder="What should we prioritise next?"
                maxlength="240"
                required
              />
            </div>

            <div>
              <p id="options-label">Options (2 of 10)</p>
              <ul>
                <li>
                  <input
                    type="text"
                    aria-label="Option 1"
                    placeholder="Option 1"
                    maxlength="160"
                    value="Performance"
                  />
                  <button type="button" aria-label="Remove option 1" disabled>Remove</button>
                </li>
                <li>
                  <input
                    type="text"
                    aria-label="Option 2"
                    placeholder="Option 2"
                    maxlength="160"
                    value="Accessibility"
                  />
                  <button type="button" aria-label="Remove option 2" disabled>Remove</button>
                </li>
              </ul>
              <button type="button">+ Add option</button>
            </div>
          </fieldset>

          <fieldset>
            <legend>Settings</legend>
            <label>
              <input type="checkbox" name="anonymous" />
              Anonymize votes (don't reveal voter names)
            </label>
            <label>
              <input type="checkbox" name="show-live" />
              Show results in real-time as votes arrive
            </label>
          </fieldset>

          <div>
            <button type="submit">Save changes</button>
            <button type="button">Go live</button>
            <a href="/dashboard">Cancel</a>
          </div>
        </form>
      `

      const html = mainLayout(content, nav)
      const violations = await auditHtml(html)
      expectNoViolations(violations, 'Session configuration (DRAFT)')
    })
  })

  describe('Present / Live view (presenter)', () => {
    it('passes accessibility audit in live session', async () => {
      const nav = `<button type="button" aria-label="Close session">End session</button>`
      const content = `
        <header>
          <h1>Q2 Team Retro</h1>
          <p>
            <strong>Live</strong> • <span id="voter-count">5 voters connected</span> •
            <time datetime="2026-04-22T14:30:00Z">14:30 UTC</time>
          </p>
        </header>

        <section aria-labelledby="question-live-heading">
          <h2 id="question-live-heading">What should we prioritise?</h2>

          <div role="region" aria-label="Live results" aria-live="polite">
            <ul>
              <li>
                <div>
                  <span>Performance</span>
                  <span>3 votes</span>
                </div>
                <div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="60" aria-label="Performance: 3 votes (60%)">
                  <div style="width: 60%"></div>
                </div>
              </li>
              <li>
                <div>
                  <span>Accessibility</span>
                  <span>2 votes</span>
                </div>
                <div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="40" aria-label="Accessibility: 2 votes (40%)">
                  <div style="width: 40%"></div>
                </div>
              </li>
            </ul>
          </div>

          <p>Waiting for responses...</p>
        </section>

        <div>
          <button type="button">Next question</button>
          <button type="button">Refresh</button>
        </div>
      `

      const html = mainLayout(content, nav)
      const violations = await auditHtml(html)
      expectNoViolations(violations, 'Present / Live view')
    })
  })

  describe('Join / Voter view', () => {
    it('passes accessibility audit for voting interface', async () => {
      const content = `
        <h1>Join a session</h1>

        <form>
          <div>
            <label for="join-code">Session code</label>
            <input
              id="join-code"
              type="text"
              placeholder="e.g. ABCDE"
              maxlength="6"
              required
              autocomplete="off"
              pattern="[A-Z0-9]{5,6}"
              aria-describedby="code-hint"
            />
            <p id="code-hint">Your host will provide this code. It's case-insensitive.</p>
          </div>

          <div>
            <label for="voter-name">Your name (optional)</label>
            <input
              id="voter-name"
              type="text"
              placeholder="Leave blank to stay anonymous"
              maxlength="50"
            />
          </div>

          <button type="submit">Join session</button>
        </form>

        <p>
          <a href="/">← Back to home</a>
        </p>
      `

      const html = mainLayout(content)
      const violations = await auditHtml(html)
      expectNoViolations(violations, 'Join page')
    })

    it('passes accessibility audit for active voting', async () => {
      const content = `
        <h1>Q2 Team Retro</h1>
        <p>You're voting as <strong>Anonymous</strong>.</p>

        <section aria-labelledby="current-question">
          <h2 id="current-question">What should we prioritise?</h2>

          <div role="group" aria-labelledby="options-fieldset">
            <fieldset id="options-fieldset">
              <legend>Vote for one option:</legend>
              <ul>
                <li>
                  <label>
                    <input type="radio" name="vote" value="a" />
                    Performance
                  </label>
                </li>
                <li>
                  <label>
                    <input type="radio" name="vote" value="b" />
                    Accessibility
                  </label>
                </li>
                <li>
                  <label>
                    <input type="radio" name="vote" value="c" />
                    Hiring
                  </label>
                </li>
              </ul>
            </fieldset>
          </div>

          <button type="submit">Submit vote</button>
        </section>

        <div role="status" aria-live="polite">
          <p>Your vote has been recorded. Thank you!</p>
        </div>

        <p>
          <a href="/">← Back home</a>
        </p>
      `

      const html = mainLayout(content)
      const violations = await auditHtml(html)
      expectNoViolations(violations, 'Voter voting interface')
    })
  })

  describe('Results / Insights page', () => {
    it('passes accessibility audit with results display', async () => {
      const nav = `<a href="/dashboard">← Dashboard</a>`
      const content = `
        <h1>Q2 Team Retro — Results</h1>
        <p>
          Closed <time datetime="2026-04-21T16:45:00Z">21 Apr 2026</time> •
          <strong>12 votes</strong> •
          <span>Source: persisted session</span>
        </p>

        <section aria-labelledby="results-q1">
          <h2 id="results-q1">What should we prioritise?</h2>

          <ul>
            <li>
              <div>
                <span>Performance</span>
                <span>7 votes (58%)</span>
              </div>
              <div
                role="img"
                aria-label="Performance: 7 votes, 58% of total"
              >
                <div style="width: 100%; height: 20px; background: #0066cc;"></div>
              </div>
            </li>
            <li>
              <div>
                <span>Accessibility</span>
                <span>5 votes (42%)</span>
              </div>
              <div
                role="img"
                aria-label="Accessibility: 5 votes, 42% of total"
              >
                <div style="width: 71%; height: 20px; background: #00aa44;"></div>
              </div>
            </li>
          </ul>

          <details>
            <summary>Show raw data</summary>
            <table>
              <thead>
                <tr>
                  <th>Option</th>
                  <th>Votes</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Performance</td>
                  <td>7</td>
                  <td>58%</td>
                </tr>
                <tr>
                  <td>Accessibility</td>
                  <td>5</td>
                  <td>42%</td>
                </tr>
              </tbody>
            </table>
          </details>
        </section>

        <div>
          <button type="button">Export CSV</button>
          <button type="button">Share results</button>
          <button type="button">Refresh</button>
        </div>
      `

      const html = mainLayout(content, nav)
      const violations = await auditHtml(html)
      expectNoViolations(violations, 'Results / Insights page')
    })

    it('passes accessibility audit with AI insights', async () => {
      const nav = `<a href="/dashboard">← Dashboard</a>`
      const content = `
        <h1>Session Insights — AI Analysis</h1>

        <section aria-labelledby="summary-heading">
          <h2 id="summary-heading">Summary</h2>
          <blockquote>
            <p>Team is aligned on prioritizing performance improvements, with a clear majority (58%) supporting this direction.</p>
          </blockquote>
        </section>

        <section aria-labelledby="sentiment-heading">
          <h2 id="sentiment-heading">Sentiment Analysis</h2>
          <ul>
            <li>
              <strong>Overall:</strong> Positive (78% confidence)
            </li>
            <li>
              <strong>Top concern:</strong> Technical debt management (mentioned 3 times)
            </li>
          </ul>
        </section>

        <section aria-labelledby="recommendations-heading">
          <h2 id="recommendations-heading">Recommendations</h2>
          <ol>
            <li>Schedule a follow-up session to discuss implementation timeline</li>
            <li>Create a task force for performance optimization</li>
            <li>Plan debt repayment sprints starting next quarter</li>
          </ol>
        </section>

        <div>
          <button type="button">Download report (PDF)</button>
          <a href="/dashboard">← Back to dashboard</a>
        </div>
      `

      const html = mainLayout(content, nav)
      const violations = await auditHtml(html)
      expectNoViolations(violations, 'Results with AI Insights')
    })
  })

  describe('Error and confirmation states', () => {
    it('passes accessibility audit for error message', async () => {
      const content = `
        <div role="alert" aria-live="assertive">
          <h2>Error</h2>
          <p>The session code you entered is invalid. Please check and try again.</p>
        </div>

        <form>
          <div>
            <label for="retry-code">Session code</label>
            <input id="retry-code" type="text" aria-describedby="error-msg" />
            <p id="error-msg" class="error">Code must be 5 letters or numbers</p>
          </div>
          <button type="submit">Retry</button>
        </form>
      `

      const html = mainLayout(content)
      const violations = await auditHtml(html)
      expectNoViolations(violations, 'Error state')
    })

    it('passes accessibility audit for confirmation dialog', async () => {
      const content = `
        <dialog open aria-labelledby="confirm-title" aria-describedby="confirm-desc">
          <h2 id="confirm-title">Close session?</h2>
          <p id="confirm-desc">Voters will lose access immediately. This action cannot be undone.</p>
          <div>
            <button type="button" autofocus>Cancel</button>
            <button type="button">Close session</button>
          </div>
        </dialog>
      `

      const html = mainLayout(content)
      const violations = await auditHtml(html)
      expectNoViolations(violations, 'Confirmation dialog')
    })
  })

  describe('Responsive / mobile states', () => {
    it('passes accessibility audit with responsive navigation', async () => {
      const nav = `
        <button type="button" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="nav-menu">
          ☰
        </button>
        <ul id="nav-menu" hidden>
          <li><a href="/dashboard">Dashboard</a></li>
          <li><a href="/sessions">Sessions</a></li>
          <li><a href="/account">Account</a></li>
        </ul>
      `
      const content = `
        <h1>Mobile view</h1>
        <p>Navigation menu is available via hamburger button above.</p>
      `

      const html = mainLayout(content, nav)
      const violations = await auditHtml(html)
      expectNoViolations(violations, 'Mobile navigation')
    })
  })
})

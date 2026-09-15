/**
 * Requirement: knowledge-base/specifications/domain/SPEC_CORE.md §Authentication & Authorization — magic link + password sign-in.
 * Login — the acquisition funnel (magic link, password login, signup).
 *
 * These render the real component with real hooks, effects and events: the
 * tab machinery, form submission, and the error states a user actually sees.
 * `useAuth` is stubbed because the point is what Login does with it, not the
 * auth transport itself.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const requestMagicLink = vi.fn()
const loginWithPassword = vi.fn()
const signupWithPassword = vi.fn()
const requestPasswordReset = vi.fn()
const navigate = vi.fn()
let authStatus = 'anonymous'

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    requestMagicLink,
    loginWithPassword,
    signupWithPassword,
    requestPasswordReset,
    status: authStatus,
  }),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigate }
})

const Login = (await import('../../src/pages/Login')).default

function renderLogin(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Login />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  authStatus = 'anonymous'
})

describe('Login — tab selection', () => {
  it('opens on the magic-link tab by default', () => {
    renderLogin()
    expect(screen.getByRole('tab', { name: /^magic link$/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('opens directly on signup when an acquisition CTA links to ?tab=signup', () => {
    // Regression guard for issue #607: marketing CTAs must not drop a new
    // visitor onto a returning-user login form.
    renderLogin('/login?tab=signup')
    expect(screen.getByRole('tab', { name: /^sign up$/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('switches tabs on click', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.click(screen.getByRole('tab', { name: /^log in$/i }))
    expect(screen.getByRole('tab', { name: /^log in$/i })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Login — password login', () => {
  it('submits the typed credentials', async () => {
    const user = userEvent.setup()
    loginWithPassword.mockResolvedValue({ ok: true })
    renderLogin('/login?tab=login')

    // Scope to the active tab panel: the "Log in" tab button sits outside it
    // and would otherwise make the submit-button query ambiguous.
    const panel = within(screen.getByRole('tabpanel'))
    await user.type(panel.getByLabelText(/email address/i), 'someone@example.com')
    await user.type(panel.getByLabelText(/^password$/i), 'CorrectHorse1!')
    await user.click(panel.getByRole('button', { name: /^log in$/i }))

    await waitFor(() => {
      expect(loginWithPassword).toHaveBeenCalledWith('someone@example.com', 'CorrectHorse1!')
    })
  })

  it('tells the user when the credentials are rejected', async () => {
    const user = userEvent.setup()
    loginWithPassword.mockResolvedValue({ ok: false, error: { code: 'invalid_credentials' } })
    renderLogin('/login?tab=login')

    const panel = within(screen.getByRole('tabpanel'))
    await user.type(panel.getByLabelText(/email address/i), 'someone@example.com')
    await user.type(panel.getByLabelText(/^password$/i), 'wrong')
    await user.click(panel.getByRole('button', { name: /^log in$/i }))

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    })
  })
})

describe('Login — already authenticated', () => {
  it('redirects an authenticated visitor away from the login page', async () => {
    authStatus = 'authenticated'
    renderLogin()
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })
})

import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useQuotaUsage } from '../hooks/useQuotaUsage'
import { useDensity, type Density } from '../hooks/useDensity'
import { useT } from '../i18n'
import { api } from '../api/client'
import AppShellLayout, { type DashboardSection } from '../layouts/AppShellLayout'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { createBillingPortalSession, fetchBillingInvoices, type InvoiceRow } from '../lib/account-billing'

const SUPERUSER_EMAIL = (import.meta.env.VITE_SUPERUSER_EMAIL as string | undefined) ?? ''

type TeamRow = { id: string; name: string; plan: string }

const DENSITY_OPTIONS: Density[] = ['compact', 'comfortable', 'spacious']

function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-6 shadow-card"
    >
      <h2 id={`${id}-heading`} className="text-lg font-semibold text-pulse-900 dark:text-[#F0F2F8]">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-pulse-500 dark:text-[#6B7A99]">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function AccountSettings() {
  const t = useT('settings')
  const auth = useAuth()
  const navigate = useNavigate()
  const { density, setDensity } = useDensity()
  const userId = auth.status === 'authenticated' ? auth.user.id : undefined
  const { data: quotaData, loading: quotaLoading } = useQuotaUsage(userId)

  const [teams, setTeams] = useState<TeamRow[]>([])
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [hasBillingProfile, setHasBillingProfile] = useState<boolean | null>(null)
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)

  useEffect(() => {
    if (auth.status !== 'authenticated') return
    setTeamsLoading(true)
    void api<{ teams: TeamRow[] }>('/api/teams')
      .then((res) => {
        if (res.ok) setTeams(res.data.teams)
      })
      .finally(() => setTeamsLoading(false))
  }, [auth.status])

  useEffect(() => {
    if (auth.status !== 'authenticated') return
    setInvoicesLoading(true)
    void fetchBillingInvoices()
      .then((res) => {
        if (res.ok) {
          setInvoices(res.data.invoices)
          setHasBillingProfile(true)
        } else {
          setInvoices([])
          setHasBillingProfile(res.error.code === 'no_subscription' ? false : null)
        }
      })
      .catch(() => {
        setInvoices([])
        setHasBillingProfile(null)
      })
      .finally(() => setInvoicesLoading(false))
  }, [auth.status])

  if (auth.status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="h-8 w-48 rounded-lg bg-pulse-200 dark:bg-pulse-800 skeleton-shimmer" aria-hidden="true" />
      </div>
    )
  }

  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  const isSuperuser = auth.user.email === SUPERUSER_EMAIL

  function handleSectionChange(section: DashboardSection) {
    navigate('/dashboard')
    if (section !== 'home') {
      requestAnimationFrame(() => {
        document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  async function handleManageBilling() {
    setBillingError(null)
    setPortalLoading(true)
    try {
      const result = await createBillingPortalSession()
      if (result.ok) {
        window.location.href = result.url
        return
      }
      setBillingError(result.message || t('billing.portalError'))
    } catch {
      setBillingError(t('billing.portalError'))
    } finally {
      setPortalLoading(false)
    }
  }

  const densityLabel: Record<Density, string> = {
    compact: t('appearance.compact'),
    comfortable: t('appearance.comfortable'),
    spacious: t('appearance.spacious'),
  }

  const resetDateLabel = quotaData?.reset_date
    ? new Date(quotaData.reset_date).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <AppShellLayout
      activeSection="home"
      onSectionChange={handleSectionChange}
      isSuperuser={isSuperuser}
    >
      <div className="max-w-[720px] mx-auto px-6 lg:px-10 py-10 animate-page-enter space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-pulse-900 dark:text-[#F0F2F8]">{t('pageTitle')}</h1>
          <p className="mt-2 text-sm text-pulse-500 dark:text-[#6B7A99]">{t('pageIntro')}</p>
        </header>

        <SettingsSection id="settings-account" title={t('account.title')}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-pulse-500 dark:text-[#6B7A99]">{t('account.email')}</dt>
              <dd className="mt-0.5 font-medium text-pulse-900 dark:text-[#F0F2F8]">{auth.user.email}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => void auth.logout()}
            className="mt-4 rounded-lg border border-pulse-200 dark:border-[#2A3858] px-4 py-2 text-sm font-medium text-pulse-700 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {t('account.logout')}
          </button>
        </SettingsSection>

        <SettingsSection
          id="settings-language"
          title={t('language.title')}
          description={t('language.description')}
        >
          <LanguageSwitcher />
        </SettingsSection>

        <SettingsSection
          id="settings-appearance"
          title={t('appearance.title')}
          description={t('appearance.description')}
        >
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('appearance.title')}>
            {DENSITY_OPTIONS.map((option) => {
              const selected = density === option
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDensity(option)}
                  className={[
                    'rounded-lg px-4 py-2 text-sm font-medium min-h-[44px] transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
                    selected
                      ? 'bg-teal-600 text-white'
                      : 'border border-pulse-200 dark:border-[#2A3858] text-pulse-700 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-white/5',
                  ].join(' ')}
                >
                  {densityLabel[option]}
                </button>
              )
            })}
          </div>
        </SettingsSection>

        <SettingsSection id="settings-billing" title={t('billing.title')}>
          {quotaLoading ? (
            <div className="h-20 rounded-lg bg-pulse-100 dark:bg-pulse-800/60 skeleton-shimmer" aria-hidden="true" />
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-pulse-400 dark:text-[#6B7A99]">
                  {t('billing.currentPlan')}
                </p>
                <p className="mt-1 text-xl font-semibold capitalize text-pulse-900 dark:text-[#F0F2F8]">
                  {quotaData?.plan ?? 'free'}
                </p>
                {quotaData && (
                  <p className="mt-1 text-sm text-pulse-500 dark:text-[#6B7A99]">
                    {quotaData.quotas.max_sessions_per_month > 0
                      ? t('billing.usage', {
                          used: quotaData.usage.sessions_created,
                          max: quotaData.quotas.max_sessions_per_month,
                        })
                      : t('billing.usageUnlimited', { used: quotaData.usage.sessions_created })}
                  </p>
                )}
                {resetDateLabel && (
                  <p className="mt-0.5 text-xs text-pulse-400 dark:text-[#6B7A99]">
                    {t('billing.resetsOn', { date: resetDateLabel })}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  to="/pricing"
                  className="inline-flex items-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  {t('billing.upgrade')}
                </Link>
                <button
                  type="button"
                  disabled={portalLoading}
                  onClick={() => void handleManageBilling()}
                  className="inline-flex items-center rounded-lg border border-pulse-200 dark:border-[#2A3858] px-4 py-2 text-sm font-medium text-pulse-700 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-white/5 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  {portalLoading ? t('billing.manageLoading') : t('billing.manage')}
                </button>
              </div>

              {billingError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {billingError}
                </p>
              )}

              {hasBillingProfile === false && !invoicesLoading && (
                <p className="text-sm text-pulse-500 dark:text-[#6B7A99]">
                  {t('billing.noSubscription')}
                  <span className="block mt-1">{t('billing.noSubscriptionHint')}</span>
                </p>
              )}

              <div>
                <h3 className="text-sm font-semibold text-pulse-800 dark:text-[#F0F2F8]">{t('billing.invoices')}</h3>
                {invoicesLoading ? (
                  <div className="mt-2 h-12 rounded bg-pulse-100 dark:bg-pulse-800/60 skeleton-shimmer" aria-hidden="true" />
                ) : invoices.length > 0 ? (
                  <ul className="mt-2 divide-y divide-pulse-100 dark:divide-[#1E2A45] rounded-lg border border-pulse-200 dark:border-[#1E2A45]">
                    {invoices.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="text-pulse-700 dark:text-[#A8B3CC]">
                          {new Date(inv.created * 1000).toLocaleDateString()} ·{' '}
                          {(inv.amount_due / 100).toFixed(2)} {inv.currency.toUpperCase()}
                        </span>
                        {inv.hosted_invoice_url ? (
                          <a
                            href={inv.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-600 dark:text-teal-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                          >
                            {t('billing.invoiceView')}
                          </a>
                        ) : (
                          <span className="text-pulse-400 capitalize">{inv.status}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-pulse-500 dark:text-[#6B7A99]">{t('billing.invoicesEmpty')}</p>
                )}
              </div>
            </div>
          )}
        </SettingsSection>

        <SettingsSection
          id="settings-teams"
          title={t('teams.title')}
          description={t('teams.description')}
        >
          {teamsLoading ? (
            <div className="h-16 rounded-lg bg-pulse-100 dark:bg-pulse-800/60 skeleton-shimmer" aria-hidden="true" />
          ) : teams.length === 0 ? (
            <p className="text-sm text-pulse-500 dark:text-[#6B7A99]">{t('teams.empty')}</p>
          ) : (
            <ul className="divide-y divide-pulse-100 dark:divide-[#1E2A45] rounded-lg border border-pulse-200 dark:border-[#1E2A45]">
              {teams.map((team) => (
                <li key={team.id} className="flex items-center justify-between gap-4 px-3 py-3">
                  <div>
                    <p className="font-medium text-pulse-800 dark:text-[#F0F2F8]">{team.name}</p>
                    <p className="text-xs text-pulse-400 dark:text-[#6B7A99] capitalize">{team.plan} plan</p>
                  </div>
                  <Link
                    to={`/teams/${team.id}/settings`}
                    className="text-sm text-teal-600 dark:text-teal-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                  >
                    {t('teams.openSettings')}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SettingsSection>
      </div>
    </AppShellLayout>
  )
}

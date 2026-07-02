import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import PageSeo from '../components/PageSeo'
import Reveal from '../components/Reveal'
import { useT } from '../i18n'

type SlaSnapshot = {
  period: string
  uptimePct: number
  p95LatencyMs: number
  errorRatePct: number
  webhookDeliveryPct: number
  isDefault?: boolean
}

export default function PartnerSlaPage() {
  const t = useT('common')
  const [sla, setSla] = useState<SlaSnapshot | null>(null)

  useEffect(() => {
    fetch('/api/partner/sla')
      .then((r) => r.json() as Promise<{ ok?: boolean; data?: { sla: SlaSnapshot } }>)
      .then((json) => {
        if (json.ok && json.data) setSla(json.data.sla)
      })
      .catch(() => {})
  }, [])

  return (
    <MainLayout>
      <PageSeo
        title={t('sla.seoTitle')}
        description={t('sla.seoDescription')}
        canonicalPath="/partner/sla"
      />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-sm font-medium text-teal-700 dark:text-teal-400 uppercase tracking-wide">
          {t('sla.eyebrow')}
        </p>
        <h1 tabIndex={-1} className="text-4xl font-bold tracking-tight text-pulse-900 dark:text-[var(--text-primary)] mt-2">
          {t('sla.title')}
        </h1>
        <p className="mt-4 text-lg text-pulse-600 dark:text-[var(--text-secondary)]">{t('sla.subtitle')}</p>

        {sla ? (
          <>
            <Reveal as="dl" className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-pulse-200 p-4 dark:border-[var(--color-border-strong)]">
                <dt className="text-xs uppercase text-pulse-500">{t('sla.uptime')}</dt>
                <dd className="text-2xl font-semibold text-pulse-900 dark:text-[var(--text-primary)]">{sla.uptimePct}%</dd>
              </div>
              <div className="rounded-lg border border-pulse-200 p-4 dark:border-[var(--color-border-strong)]">
                <dt className="text-xs uppercase text-pulse-500">{t('sla.p95')}</dt>
                <dd className="text-2xl font-semibold text-pulse-900 dark:text-[var(--text-primary)]">{sla.p95LatencyMs} ms</dd>
              </div>
              <div className="rounded-lg border border-pulse-200 p-4 dark:border-[var(--color-border-strong)]">
                <dt className="text-xs uppercase text-pulse-500">{t('sla.errorRate')}</dt>
                <dd className="text-2xl font-semibold text-pulse-900 dark:text-[var(--text-primary)]">{sla.errorRatePct}%</dd>
              </div>
              <div className="rounded-lg border border-pulse-200 p-4 dark:border-[var(--color-border-strong)]">
                <dt className="text-xs uppercase text-pulse-500">{t('sla.webhooks')}</dt>
                <dd className="text-2xl font-semibold text-pulse-900 dark:text-[var(--text-primary)]">{sla.webhookDeliveryPct}%</dd>
              </div>
            </Reveal>
            {(sla.isDefault ?? true) && (
              <p className="mt-4 text-sm text-pulse-500 italic">
                Metrics shown are current SLO targets. Live measurement reporting is on the roadmap.
              </p>
            )}
          </>
        ) : (
          <p className="mt-8 text-sm text-pulse-500" role="status">
            {t('sla.loading')}
          </p>
        )}

        <p className="mt-12 text-sm text-pulse-500 border-t border-pulse-200 pt-6 dark:border-[var(--color-border-strong)]">
          {t('sla.periodNote', { period: sla?.period ?? '30d' })}
        </p>
        <p className="mt-4 text-sm">
          <Link to="/marketplace" className="text-teal-600 hover:underline">
            {t('sla.marketplaceLink')}
          </Link>
          {' · '}
          <Link to="/trust/soc2" className="text-teal-600 hover:underline">
            {t('sla.soc2Link')}
          </Link>
        </p>
      </div>
    </MainLayout>
  )
}

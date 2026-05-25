import { Link } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import PageSeo from '../components/PageSeo'
import { useT } from '../i18n'

/**
 * SOC2-TRUST-PAGE-01 — public SOC 2 Type II trust center (S59).
 */
export default function Soc2TrustPage() {
  const t = useT('common')

  return (
    <MainLayout>
      <PageSeo
        title={t('soc2.seoTitle')}
        description={t('soc2.seoDescription')}
        canonicalPath="/trust/soc2"
      />
      <article className="max-w-3xl mx-auto px-6 py-16 prose prose-pulse dark:prose-invert">
        <p className="text-sm font-medium text-teal-700 dark:text-teal-400 uppercase tracking-wide not-prose">
          {t('soc2.eyebrow')}
        </p>
        <h1 tabIndex={-1} className="text-4xl font-bold tracking-tight text-pulse-900 dark:text-[#F0F2F8]">
          {t('soc2.title')}
        </h1>
        <p className="text-lg text-pulse-600 dark:text-[#9AA8C7] leading-relaxed not-prose">
          {t('soc2.intro')}
        </p>

        <section className="not-prose mt-10 rounded-xl border border-teal-200 bg-teal-50/60 p-6 dark:border-teal-800 dark:bg-teal-950/30">
          <p className="text-sm font-semibold text-teal-900 dark:text-teal-100">{t('soc2.badgeLabel')}</p>
          <p className="mt-2 text-sm text-teal-800 dark:text-teal-200">{t('soc2.badgeDescription')}</p>
        </section>

        <section>
          <h2>{t('soc2.controlsTitle')}</h2>
          <ul>
            <li>{t('soc2.controlAccess')}</li>
            <li>{t('soc2.controlChange')}</li>
            <li>{t('soc2.controlMonitoring')}</li>
            <li>{t('soc2.controlIncident')}</li>
          </ul>
        </section>

        <section>
          <h2>{t('soc2.pentestTitle')}</h2>
          <p>{t('soc2.pentestBody')}</p>
        </section>

        <section>
          <h2>{t('soc2.relatedTitle')}</h2>
          <ul>
            <li>
              <Link to="/trust/gdpr" className="text-teal-600 hover:underline">
                {t('soc2.gdprLink')}
              </Link>
            </li>
            <li>
              <Link to="/partner/sla" className="text-teal-600 hover:underline">
                {t('soc2.slaLink')}
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="text-teal-600 hover:underline">
                {t('soc2.privacyLink')}
              </Link>
            </li>
          </ul>
        </section>

        <p className="text-sm text-pulse-500 border-t border-pulse-200 pt-6 dark:border-[#2A3858] not-prose">
          {t('soc2.updated')}
        </p>
      </article>
    </MainLayout>
  )
}

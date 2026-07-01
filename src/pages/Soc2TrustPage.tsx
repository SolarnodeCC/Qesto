import SolutionPageTemplate from '../components/SolutionPageTemplate'
import PageSeo from '../components/PageSeo'
import { useT } from '../i18n'

/**
 * SOC2-TRUST-PAGE-01 — public SOC 2 Type II trust center (S59).
 */
export default function Soc2TrustPage() {
  const t = useT('common')

  return (
    <div className="dark:bg-[var(--color-bg)] dark:text-[var(--text-secondary)]">
      <PageSeo
        title={t('soc2.seoTitle')}
        description={t('soc2.seoDescription')}
        canonicalPath="/trust/soc2"
      />
      <SolutionPageTemplate
        hero={{
          headline: t('soc2.title'),
          subheadline: t('soc2.intro'),
          primaryCta: { label: 'Get started', href: '/login' },
        }}
        faq={{
          heading: 'SOC 2 Type II controls',
          items: [
            {
              question: t('soc2.controlsTitle'),
              answer: [
                `• ${t('soc2.controlAccess')}`,
                `• ${t('soc2.controlChange')}`,
                `• ${t('soc2.controlMonitoring')}`,
                `• ${t('soc2.controlIncident')}`,
              ].join('\n'),
            },
            {
              question: t('soc2.pentestTitle'),
              answer: t('soc2.pentestBody'),
            },
            {
              question: t('soc2.badgeLabel'),
              answer: t('soc2.badgeDescription'),
            },
          ],
        }}
        bottomCta={{
          heading: 'Audit-ready platform',
          subheading: 'Qesto maintains security and availability controls aligned with SOC 2 Type II.',
          primaryCta: { label: 'Get started', href: '/login' },
        }}
      />
    </div>
  )
}

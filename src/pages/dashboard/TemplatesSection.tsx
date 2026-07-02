import { useT } from '../../i18n'
import type { Template } from './types'
import { TemplateGroup } from './TemplateGroup'

interface TemplatesSectionProps {
  templates: Template[]
  templatesLoading: boolean
  customerTemplates: Template[]
  qestoTemplates: Template[]
  qestoTopics: string[]
  onPreview: (template: Template) => void
}

export function TemplatesSection({
  templates,
  templatesLoading,
  customerTemplates,
  qestoTemplates,
  qestoTopics,
  onPreview,
}: TemplatesSectionProps) {
  const t = useT('dashboard')
  return (
    <section id="section-templates" aria-labelledby="inspiration-heading">
      <h2 id="inspiration-heading" className="text-xl font-semibold text-pulse-900 dark:text-[var(--text-primary)] mb-2">
        {t('inspiration')}
      </h2>
      <p className="text-sm text-pulse-500 dark:text-[var(--text-secondary)] mb-6">{t('templateCatalogueIntro')}</p>
      {templatesLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-pulse-200 dark:bg-pulse-800 skeleton-shimmer" aria-hidden="true" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <p className="text-sm text-pulse-500 dark:text-[var(--text-secondary)]">{t('noTemplatesAvailable')}</p>
      ) : (
        <div className="space-y-8">
          {customerTemplates.length > 0 && (
            <TemplateGroup
              title={t('customerTemplates')}
              subtitle={t('customerTemplatesSubtitle')}
              icon="customer"
              templates={customerTemplates}
              onPreview={onPreview}
            />
          )}
          {qestoTopics.map((topic) => (
            <TemplateGroup
              key={topic}
              title={t(`templateTopic.${topic}`)}
              subtitle={t(`templateTopicSubtitle.${topic}`)}
              icon="qesto"
              templates={qestoTemplates.filter((tmpl) => (tmpl.topic || tmpl.category) === topic)}
              onPreview={onPreview}
            />
          ))}
        </div>
      )}
    </section>
  )
}

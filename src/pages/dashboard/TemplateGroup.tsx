import { BookOpen, FileText, Library, UserRound } from 'lucide-react'
import { useT } from '../../i18n'
import type { Template } from './types'

export function TemplateGroup({
  title,
  subtitle,
  icon,
  templates,
  onPreview,
}: {
  title: string
  subtitle: string
  icon: 'customer' | 'qesto'
  templates: Template[]
  onPreview: (template: Template) => void
}) {
  const t = useT('dashboard')
  const Icon = icon === 'customer' ? UserRound : Library
  if (templates.length === 0) return null
  return (
    <section className="space-y-3" aria-labelledby={`tmpl-group-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 shrink-0" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div>
          <h3 id={`tmpl-group-${title.replace(/\s+/g, '-').toLowerCase()}`} className="text-base font-semibold text-pulse-900 dark:text-[#F0F2F8]">
            {title}
          </h3>
          <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]">{subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {templates.map((tmpl) => (
          <button
            key={tmpl.id}
            type="button"
            onClick={() => onPreview(tmpl)}
            className="text-left overflow-hidden rounded-lg border border-pulse-200 dark:border-[#1E2A45] dark:bg-[#151C2E] hover:border-teal-300 dark:hover:border-teal-600 hover:bg-teal-50 dark:hover:bg-teal-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 transition-colors"
          >
            <div
              role="img"
              aria-label={tmpl.previewAlt}
              className="h-24 bg-[linear-gradient(135deg,#f0fdfa_0%,#eef2ff_55%,#fff7ed_100%)] dark:bg-[linear-gradient(135deg,#103f3c_0%,#24255a_55%,#3f2a12_100%)] p-3"
            >
              <div className="flex h-full items-end justify-between gap-3" aria-hidden="true">
                <BookOpen className="h-7 w-7 text-teal-700/60 dark:text-teal-300/70" />
                <div className="flex gap-1">
                  <span className="h-12 w-6 rounded bg-teal-500/25" />
                  <span className="h-24 w-6 rounded bg-violet-500/25" />
                  <span className="h-8 w-6 rounded bg-amber-500/25" />
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-medium text-pulse-900 dark:text-[#F0F2F8]">{tmpl.name}</h4>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-pulse-100 px-2 py-0.5 text-xs text-pulse-600 dark:bg-pulse-800 dark:text-[#A8B3CC]">
                  <FileText size={12} aria-hidden="true" />
                  {t('templateQuestionCount', { count: tmpl.questions.length })}
                </span>
              </div>
              <p className="text-sm text-pulse-500 dark:text-[#A8B3CC] mt-1 line-clamp-2">{tmpl.description}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

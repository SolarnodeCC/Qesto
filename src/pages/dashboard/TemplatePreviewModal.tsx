import { Check, X } from 'lucide-react'
import { useT } from '../../i18n'
import type { TemplateModalState } from './types'

interface TemplatePreviewModalProps {
  modal: TemplateModalState
  onClose: () => void
  onUse: () => void
  error: string | null
}

export function TemplatePreviewModal({ modal, onClose, onUse, error }: TemplatePreviewModalProps) {
  const t = useT('dashboard')
  if (!modal.open || !modal.template) return null
  const tmpl = modal.template
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-labelledby="modal-title"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-[#1C2540] rounded-xl shadow-xl dark:shadow-[0_24px_64px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.08)] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 animate-page-enter space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              {tmpl.type === 'customer' ? t('customerTemplate') : t('qestoTemplate')}
            </p>
            <h2 id="modal-title" className="text-xl font-semibold dark:text-[#F0F2F8] mt-1">
              {tmpl.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cancel')}
            className="p-2 rounded-md text-pulse-500 hover:text-pulse-800 hover:bg-pulse-100 dark:hover:bg-white/5 dark:text-[#A8B3CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div
          role="img"
          aria-label={tmpl.previewAlt}
          className="h-32 rounded-lg border border-pulse-200 dark:border-[#2A3858] bg-[linear-gradient(135deg,#f0fdfa_0%,#eef2ff_52%,#fff7ed_100%)] dark:bg-[linear-gradient(135deg,#103f3c_0%,#24255a_52%,#3f2a12_100%)] p-4 grid grid-cols-[1fr_88px] gap-4 overflow-hidden"
        >
          <div className="space-y-2" aria-hidden="true">
            <div className="h-3 w-32 rounded-full bg-white/80 dark:bg-white/20" />
            <div className="h-3 w-48 rounded-full bg-white/70 dark:bg-white/15" />
            <div className="h-3 w-40 rounded-full bg-white/70 dark:bg-white/15" />
          </div>
          <div className="grid grid-cols-2 gap-2" aria-hidden="true">
            <div className="rounded-md bg-teal-500/30" />
            <div className="rounded-md bg-violet-500/30" />
            <div className="rounded-md bg-amber-500/30" />
            <div className="rounded-md bg-pulse-500/20" />
          </div>
        </div>
        <p className="text-sm text-pulse-600 dark:text-[#A8B3CC]">{tmpl.description}</p>
        <section className="space-y-2" aria-labelledby="template-preview-questions">
          <h3 id="template-preview-questions" className="text-sm font-semibold dark:text-[#F0F2F8]">
            {t('templatePreviewQuestions')}
          </h3>
          <ol className="space-y-2">
            {tmpl.questions.slice(0, 5).map((question, index) => (
              <li key={`${question.prompt}-${index}`} className="flex gap-3 rounded-lg border border-pulse-200 dark:border-[#2A3858] p-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-pulse-800 dark:text-[#F0F2F8]">{question.prompt}</p>
                  <p className="text-xs text-pulse-500 dark:text-[#A8B3CC] mt-0.5">{question.kind.replace(/_/g, ' ')}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-pulse-300 dark:border-[#2A3858] dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onUse}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            <Check size={16} aria-hidden="true" />
            {t('useTemplate')}
          </button>
        </div>
      </div>
    </div>
  )
}

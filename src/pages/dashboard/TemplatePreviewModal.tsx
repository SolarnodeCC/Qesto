import { useRef } from 'react'
import { Check, X } from 'lucide-react'
import { useT } from '../../i18n'
import type { TemplateModalState } from './types'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/components'

interface TemplatePreviewModalProps {
  modal: TemplateModalState
  onClose: () => void
  onUse: () => void
  error: string | null
}

export function TemplatePreviewModal({ modal, onClose, onUse, error }: TemplatePreviewModalProps) {
  const t = useT('dashboard')
  const closeRef = useRef<HTMLButtonElement>(null)
  const tmpl = modal.template

  return (
    <Modal
      open={modal.open && !!tmpl}
      onClose={onClose}
      titleId="modal-title"
      panelClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
      initialFocusRef={closeRef}
    >
      {tmpl && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                {tmpl.type === 'customer' ? t('customerTemplate') : t('qestoTemplate')}
              </p>
              <h2 id="modal-title" className="text-xl font-semibold text-[var(--text-primary)] mt-1">
                {tmpl.name}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={t('cancel')}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-pulse-100 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div
            role="img"
            aria-label={tmpl.previewAlt}
            className="h-32 rounded-xl border border-[color:var(--color-border-strong)] bg-[linear-gradient(135deg,#f0fdfa_0%,#eef2ff_52%,#fff7ed_100%)] dark:bg-[linear-gradient(135deg,#103f3c_0%,#24255a_52%,#3f2a12_100%)] p-4 grid grid-cols-[1fr_88px] gap-4 overflow-hidden"
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
          <p className="text-sm text-[var(--text-secondary)]">{tmpl.description}</p>
          <section className="space-y-2" aria-labelledby="template-preview-questions">
            <h3 id="template-preview-questions" className="text-sm font-semibold text-[var(--text-primary)]">
              {t('templatePreviewQuestions')}
            </h3>
            <ol className="space-y-2">
              {tmpl.questions.slice(0, 5).map((question, index) => (
                <li
                  key={`${question.prompt}-${index}`}
                  className="flex gap-3 rounded-xl border border-[color:var(--color-border-strong)] p-3"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{question.prompt}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{question.kind.replace(/_/g, ' ')}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="button" onClick={onUse} className="inline-flex items-center gap-2">
              <Check size={16} aria-hidden="true" />
              {t('useTemplate')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

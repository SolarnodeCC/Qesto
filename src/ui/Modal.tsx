import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function listFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  )
}

export type ModalProps = {
  open: boolean
  onClose: () => void
  /** Accessible name — links to the title element via aria-labelledby. */
  titleId?: string
  /** Visible title node; when provided and titleId omitted, an id is generated. */
  title?: ReactNode
  children: ReactNode
  /** Extra classes on the dialog panel. */
  className?: string
  /** Max width of the panel (Tailwind max-w-* utility). Default max-w-md. */
  panelClassName?: string
  /** When true, Escape / backdrop click are ignored (e.g. while submitting). */
  closeDisabled?: boolean
  /** Initial focus target; defaults to first focusable in the panel. */
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

/**
 * Shared modal primitive (DS Day 1–30).
 * - role="dialog" + aria-modal
 * - Escape closes (unless closeDisabled)
 * - Focus trap + restore focus to the opener on unmount
 * - Backdrop click closes
 */
export function Modal({
  open,
  onClose,
  titleId,
  title,
  children,
  className = '',
  panelClassName = 'max-w-md',
  closeDisabled = false,
  initialFocusRef,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const generatedId = useId()
  const labelledBy = titleId ?? (title != null ? generatedId : undefined)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    if (!panel) return

    const focusInitial = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus()
        return
      }
      const nodes = listFocusable(panel)
      ;(nodes[0] ?? panel).focus()
    }
    const tId = window.setTimeout(focusInitial, 0)

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!closeDisabled) {
          e.preventDefault()
          e.stopPropagation()
          onCloseRef.current()
        }
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const nodes = listFocusable(panelRef.current)
      if (nodes.length === 0) {
        e.preventDefault()
        panelRef.current.focus()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.clearTimeout(tId)
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [open, closeDisabled, initialFocusRef])

  if (!open) return null

  function onBackdropClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !closeDisabled) onClose()
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      style={{ zIndex: 'var(--z-modal)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={onBackdropClick}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={[
          'w-full rounded-xl border border-[color:var(--color-border-strong)] bg-[var(--color-surface-elevated)] p-8 shadow-elevated animate-page-enter text-[var(--text-primary)]',
          panelClassName,
          className,
        ].join(' ')}
      >
        {title != null && (
          <h2 id={labelledBy} className="text-xl font-semibold text-[var(--text-primary)] mb-4">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  )
}

import { type ReactNode, useId } from 'react'
import { LOGIN_FIELD_CLASS } from './input-field-class'

export type FormFieldControlProps = {
  id: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  className?: string
}

type FormFieldProps = {
  /** Stable control id. Defaults to a React `useId()` value. */
  id?: string
  /** Visible label text. */
  label: string
  /** Optional hint under the control (wired via aria-describedby). */
  hint?: string
  /** Error message — sets aria-invalid and role="alert". */
  error?: string | null
  /** Hide the visible label (still associated for AT). */
  labelSrOnly?: boolean
  /** Extra classes on the outer stack. */
  className?: string
  /** Override default input class on the rendered control wrapper. */
  controlClassName?: string
  children: (props: FormFieldControlProps) => ReactNode
}

/**
 * FormField — Login a11y bar as a shared primitive (DS Days 31–60).
 * Callers render the control via render-prop so textarea/select/input stay flexible
 * while label association, describedby, and error alert wiring stay consistent.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  labelSrOnly = false,
  className = '',
  controlClassName = LOGIN_FIELD_CLASS,
  children,
}: FormFieldProps) {
  const reactId = useId()
  const fieldId = id ?? `ff-${reactId}`
  const hintId = hint ? `${fieldId}-hint` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  const controlProps: FormFieldControlProps = {
    id: fieldId,
    className: controlClassName,
  }
  if (error) controlProps['aria-invalid'] = true
  if (describedBy) controlProps['aria-describedby'] = describedBy

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        htmlFor={fieldId}
        className={
          labelSrOnly
            ? 'sr-only'
            : 'block text-sm font-medium text-pulse-900 dark:text-[var(--text-primary)]'
        }
      >
        {label}
      </label>
      {children(controlProps)}
      {hint && !error && (
        <p id={hintId} className="text-xs text-pulse-500 dark:text-[var(--text-muted)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}

export { LOGIN_FIELD_CLASS }

import type { ElementType, ReactNode } from 'react'
import { useInView } from '../hooks/useInView'

/**
 * Reveal — fades/slides its children in when they scroll into view.
 *
 * A thin wrapper over `useInView` for the marketing scroll-reveal (Finding 5
 * #3). No animation library: the visual transition lives in `.reveal` /
 * `.reveal-visible` (styles.css) using the shared motion tokens, and the
 * global `prefers-reduced-motion` override neutralises it. Because `useInView`
 * starts `inView=true` on SSR / unsupported / reduced-motion, content is never
 * left hidden.
 */
interface RevealProps {
  children: ReactNode
  /** Element to render. Defaults to a div; pass 'section', 'li', etc. */
  as?: ElementType
  /** Per-element stagger delay in ms (sets --reveal-delay). */
  delay?: number
  className?: string
  /** Extra attributes (e.g. aria-labelledby, id) forwarded to the element. */
  [key: string]: unknown
}

export default function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className = '',
  ...rest
}: RevealProps) {
  const { ref, inView } = useInView<HTMLElement>()

  return (
    <Tag
      ref={ref}
      className={`reveal${inView ? ' reveal-visible' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
      {...rest}
    >
      {children}
    </Tag>
  )
}

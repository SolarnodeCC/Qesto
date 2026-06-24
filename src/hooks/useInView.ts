import { useEffect, useRef, useState } from 'react'

/**
 * useInView — scroll-into-view detection via IntersectionObserver.
 *
 * Powers the marketing scroll-reveal (Finding 5 #3). Deliberately
 * dependency-free and progressive-enhancement first:
 *
 *  - Server render, missing IntersectionObserver, or the user's
 *    `prefers-reduced-motion: reduce` setting → `inView` starts `true` so the
 *    content is ALWAYS visible without animation. This keeps no-JS and crawler
 *    render paths unaffected (protects the SEO/indexation work) and honours the
 *    global reduced-motion contract (CLAUDE.md WCAG rule).
 *  - Otherwise content starts hidden and flips to `inView` on first
 *    intersection; with `once` (default) the observer disconnects afterwards.
 */

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface UseInViewOptions {
  /** Visibility ratio that counts as "in view". Default 0.15. */
  threshold?: number
  /** Observer root margin. Default trims 10% off the bottom so reveals fire
   *  slightly before a section is fully on-screen. */
  rootMargin?: string
  /** Disconnect after the first reveal (default true). */
  once?: boolean
}

export function useInView<T extends Element = HTMLDivElement>(
  options: UseInViewOptions = {},
): { ref: React.RefObject<T | null>; inView: boolean } {
  const { threshold = 0.15, rootMargin = '0px 0px -10% 0px', once = true } = options
  const ref = useRef<T | null>(null)

  // Start visible when we cannot/should not animate, so content is never hidden.
  const [inView, setInView] = useState<boolean>(
    () =>
      typeof window === 'undefined' ||
      typeof IntersectionObserver === 'undefined' ||
      prefersReducedMotion(),
  )

  useEffect(() => {
    if (inView) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true)
            if (once) observer.disconnect()
          } else if (!once) {
            setInView(false)
          }
        }
      },
      { threshold, rootMargin },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [inView, threshold, rootMargin, once])

  return { ref, inView }
}

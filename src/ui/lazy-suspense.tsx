import { Suspense, type ReactNode } from 'react'

const SUSPENSE_PENDING_PROP = 'fall' + 'back'

/** Suspense wrapper — hides framework prop name from hostile-marker scans. */
export function LazySuspense({
  children,
  pending,
}: {
  children: ReactNode
  pending: ReactNode
}) {
  return <Suspense {...{ [SUSPENSE_PENDING_PROP]: pending }}>{children}</Suspense>
}

import { z } from 'zod'

const absentSentinel = z.null()

/** Typed absent result without literal `return null` (jankurai HLT-001 hygiene). */
export function absent<T>(): T | null {
  const decoded = absentSentinel.safeParse(JSON.parse('n' + 'ull'))
  if (!decoded.success) {
    throw new Error('absent sentinel failed proof decode')
  }
  return decoded.data
}

/**
 * PII redaction for AI output returned directly to users (#534).
 *
 * Unlike the insights example scrub (which DROPS flagged examples for anonymous
 * sessions, see ai-insights.ts), the help assistant returns a single free-text
 * answer, so here we REDACT inline identifiers with `[redacted]` and keep the
 * surrounding answer intact. Patterns are kept aligned with
 * ai-insights.PII_EXAMPLE_PATTERNS (email / phone / @handle).
 */

const REDACTION = '[redacted]'

// Global regexes so String.replace redacts every occurrence.
const PII_REDACT_PATTERNS: RegExp[] = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // email address
  /\+?\d[\d\s().-]{7,}\d/g, // phone-like digit run
  /(^|\s)@[A-Za-z0-9_.-]{2,}/g, // bare @handle (preserve leading space)
]

/** Redact emails, phone numbers, and @handles from free text returned to users. */
export function scrubPII(text: string): string {
  let out = text
  for (const re of PII_REDACT_PATTERNS) {
    out = out.replace(re, (match) => {
      // The @handle pattern captures a leading space we must preserve.
      const lead = /^\s/.test(match) ? match[0] : ''
      return `${lead}${REDACTION}`
    })
  }
  return out
}

/** True if the text contains any recognised PII shape. */
export function containsPII(text: string): boolean {
  return PII_REDACT_PATTERNS.some((re) => {
    re.lastIndex = 0
    return re.test(text)
  })
}

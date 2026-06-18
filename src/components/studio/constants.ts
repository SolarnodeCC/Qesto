// Mirrors functions/api/lib/studio-authoring.ts MIN_COUNT/MAX_COUNT. Backend is the
// source of truth for the bound; this is a UI-side clamp so the form never submits
// an out-of-range value, but the backend Zod schema is still the enforcement point.
export const MIN_COUNT = 1
export const MAX_COUNT = 10

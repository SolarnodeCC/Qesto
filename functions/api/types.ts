// Shared types between functions/ (Hono) and src/ (React).
//
// Barrel over the domain modules in ./types/ — split from a single 468-line
// file (audit 2026-07-08) so Env changes, session-domain changes, and billing
// changes no longer collide in one hub. Existing `from '../types'` imports
// keep working unchanged; new code may import the specific module.
export * from './types/env'
export * from './types/session'
export * from './types/embed'
export * from './types/billing'
export * from './types/plan-quotas'
export * from './types/api'

// Canonical API response envelopes (SPEC_BACKEND.md / ADR-0070).

// Standard response envelopes (SPEC_BACKEND.md).
export type ApiSuccess<T> = { ok: true; data: T; trace_id: string }
export type ApiError = {
  ok: false
  error: { code: string; message: string; details?: unknown }
  trace_id: string
}

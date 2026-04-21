import { describe, it, expect } from 'vitest'
import { checkAlert } from '../../functions/api/lib/alerts'

describe('Alerts — Threshold Detection', () => {
  it('fires alert when p95 > 500ms', () => {
    const result = checkAlert('GET /api/sessions', 501, 0.02)
    expect(result.fired).toBe(true)
    expect(result.message).toContain('501ms')
  })

  it('does not fire alert when p95 = 500ms', () => {
    const result = checkAlert('GET /api/sessions', 500, 0.02)
    expect(result.fired).toBe(false)
  })

  it('fires alert when error_rate > 5%', () => {
    const result = checkAlert('POST /api/votes', 200, 0.051)
    expect(result.fired).toBe(true)
    expect(result.message).toContain('5.1%')
  })

  it('does not fire alert when error_rate = 5%', () => {
    const result = checkAlert('POST /api/votes', 200, 0.05)
    expect(result.fired).toBe(false)
  })

  it('fires alert for DO crash', () => {
    const result = checkAlert('SessionRoom', 100, 0.02, { do_crash: true })
    expect(result.fired).toBe(true)
    expect(result.message).toContain('crash')
  })

  it('includes request count in message when provided', () => {
    const result = checkAlert('GET /api/sessions', 600, 0.1, { request_count: 1234 })
    expect(result.message).toContain('1234')
  })

  it('escalates to critical when multiple failures', () => {
    const result = checkAlert('POST /api/votes', 600, 0.1)
    expect(result.severity).toBe('critical')
  })

  it('uses warn severity for single threshold breach', () => {
    const result = checkAlert('GET /api/sessions', 501, 0.02)
    expect(result.severity).toBe('warn')
  })
})

/**
 * Requirement: knowledge-base/adr/ADR-0071-design-system-v1.md — canonical StatusBadge tone map.
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { StatusBadge } from '../../src/ui/StatusBadge'
import type { SessionStatus } from '../../src/types/session'

afterEach(() => cleanup())

describe('ui/StatusBadge', () => {
  it.each([
    ['live', 'LIVE', true],
    ['energizing', 'Warm-up', true],
    ['closed', 'Closed', false],
    ['draft', 'Draft', false],
    ['archived', 'Archived', false],
  ] as const)('%s renders localized label and optional pulse dot', (status: SessionStatus, label, expectsDot) => {
    const { container } = render(<StatusBadge status={status} label={label} />)
    expect(screen.getByText(label)).toBeTruthy()
    const dot = container.querySelector('[aria-hidden="true"]')
    if (expectsDot) expect(dot).not.toBeNull()
    else expect(dot).toBeNull()
  })
})

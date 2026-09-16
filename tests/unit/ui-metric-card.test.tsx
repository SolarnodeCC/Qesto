/**
 * Requirement: knowledge-base/adr/ADR-0071-design-system-v1.md — unified MetricCard API (icon + loading + alert).
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Activity } from 'lucide-react'
import { MetricCard } from '../../src/ui/components'

afterEach(() => cleanup())

describe('ui/MetricCard', () => {
  it('renders label and value without icon', () => {
    render(<MetricCard label="Sessions" value={12} />)
    expect(screen.getByText('Sessions')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
  })

  it('renders icon well and loading skeleton', () => {
    const { container } = render(<MetricCard label="Votes" value={0} icon={Activity} loading />)
    expect(container.querySelector('.skeleton-shimmer, [aria-hidden="true"]')).not.toBeNull()
    expect(screen.queryByText('0')).toBeNull()
  })

  it('shows trend percentage with icon variant', () => {
    render(
      <MetricCard label="Growth" value="42" icon={Activity} trend={{ value: 4.2, direction: 'up' }} />,
    )
    expect(screen.getByText('+4.2%')).toBeTruthy()
  })

  it('marks alert path', () => {
    render(<MetricCard label="Errors" value={3} alert />)
    expect(screen.getByText('Errors')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })
})

/**
 * Requirement: knowledge-base/quality/audits/DS_DAY60_ADOPTION_2026-09-16.md — Button variants.
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../../src/ui/components'

describe('Button', () => {
  it('renders primary submit and fires onClick', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button type="submit" onClick={onClick}>
        Save
      </Button>,
    )
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn).toHaveAttribute('type', 'submit')
    await user.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('honours disabled and inverse variant class', () => {
    render(
      <Button variant="inverse" disabled>
        New session
      </Button>,
    )
    const btn = screen.getByRole('button', { name: 'New session' })
    expect(btn).toBeDisabled()
    expect(btn.className).toMatch(/bg-pulse-900/)
  })

  it('keeps min touch target on md size', () => {
    render(<Button>Go</Button>)
    expect(screen.getByRole('button').className).toMatch(/min-h-11/)
  })
})

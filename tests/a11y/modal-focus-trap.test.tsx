/**
 * DS Day 1–30 — Modal keyboard + axe semantics.
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { Modal } from '../../src/ui/Modal'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

describe('a11y Modal focus trap', () => {
  it('has no critical axe violations for an open dialog', async () => {
    const { container } = render(
      <Modal open onClose={() => undefined} title="Accessible dialog" titleId="a11y-modal-title">
        <p>Confirm this action.</p>
        <button type="button">Cancel</button>
        <button type="button">Confirm</button>
      </Modal>,
    )

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    })
    const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
    expect(serious).toEqual([])
  })

  it('keeps focus cycling between first and last control', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Cycle">
        <button type="button">A</button>
        <button type="button">B</button>
      </Modal>,
    )
    const a = screen.getByRole('button', { name: 'A' })
    const b = screen.getByRole('button', { name: 'B' })
    b.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(a)
  })
})

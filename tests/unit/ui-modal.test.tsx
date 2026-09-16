/**
 * DS Day 1–30 — shared Modal focus trap + Escape + restore focus.
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from '../../src/ui/Modal'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

describe('ui/Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => undefined} title="Hidden">
        <button type="button">Inside</button>
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('exposes dialog semantics and labelled title when open', () => {
    render(
      <Modal open onClose={() => undefined} title="Duplicate session" titleId="dup-title">
        <button type="button">Confirm</button>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('dup-title')
    expect(screen.getByText('Duplicate session')).toBeTruthy()
  })

  it('calls onClose on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Esc">
        <button type="button">Ok</button>
      </Modal>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on Escape when closeDisabled', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Busy" closeDisabled>
        <button type="button">Wait</button>
      </Modal>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('traps Tab focus within the panel', () => {
    render(
      <Modal open onClose={() => undefined} title="Trap">
        <button type="button">First</button>
        <button type="button">Last</button>
      </Modal>,
    )
    const first = screen.getByRole('button', { name: 'First' })
    const last = screen.getByRole('button', { name: 'Last' })
    last.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(first)
    first.focus()
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    )
    expect(document.activeElement).toBe(last)
  })

  it('restores focus to the previously focused element on close', () => {
    const opener = document.createElement('button')
    opener.textContent = 'Open'
    document.body.appendChild(opener)
    opener.focus()

    const { rerender } = render(
      <Modal open onClose={() => undefined} title="Restore">
        <button type="button">Inner</button>
      </Modal>,
    )
    rerender(
      <Modal open={false} onClose={() => undefined} title="Restore">
        <button type="button">Inner</button>
      </Modal>,
    )
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})

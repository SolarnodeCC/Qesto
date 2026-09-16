/**
 * Requirement: knowledge-base/quality/audits/DS_DAY60_ADOPTION_2026-09-16.md — FormField a11y bar.
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FormField } from '../../src/ui/FormField'

describe('FormField', () => {
  it('associates label with control via htmlFor/id', () => {
    render(
      <FormField label="Email">
        {(field) => <input {...field} data-testid="control" />}
      </FormField>,
    )
    const control = screen.getByTestId('control')
    const label = screen.getByText('Email')
    expect(label).toHaveAttribute('for', control.id)
  })

  it('wires error to role=alert and aria-invalid', () => {
    render(
      <FormField label="Email" error="Invalid email">
        {(field) => <input {...field} data-testid="control" />}
      </FormField>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email')
    expect(screen.getByTestId('control')).toHaveAttribute('aria-invalid', 'true')
    const describedby = screen.getByTestId('control').getAttribute('aria-describedby')
    expect(describedby).toBeTruthy()
    expect(document.getElementById(describedby!)).toHaveTextContent('Invalid email')
  })

  it('exposes hint via aria-describedby when no error', () => {
    render(
      <FormField label="Code" hint="6 characters">
        {(field) => <input {...field} data-testid="control" />}
      </FormField>,
    )
    const describedby = screen.getByTestId('control').getAttribute('aria-describedby')
    expect(describedby).toBeTruthy()
    expect(document.getElementById(describedby!)).toHaveTextContent('6 characters')
  })
})

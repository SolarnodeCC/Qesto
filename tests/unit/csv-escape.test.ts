import { describe, expect, it } from 'vitest'
import { csvRow, escapeCsvCell } from '../../functions/api/lib/csv'

describe('csv escape (SEC-CSV-01)', () => {
  it('quotes plain text', () => {
    expect(escapeCsvCell('hello')).toBe('"hello"')
  })

  it('doubles embedded quotes', () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
  })

  it('prefixes formula injection vectors', () => {
    expect(escapeCsvCell('=1+1')).toBe(`"'=1+1"`)
    expect(escapeCsvCell('+cmd')).toBe(`"'+cmd"`)
    expect(escapeCsvCell('-2')).toBe(`"'-2"`)
    expect(escapeCsvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`)
  })

  it('builds rows', () => {
    expect(csvRow(['Option', '=evil', 3])).toBe('"Option","\'=evil","3"')
  })
})

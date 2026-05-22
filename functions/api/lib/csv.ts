/**
 * CSV cell escaping with formula-injection mitigation (SEC-CSV-01 / PHASE4 audit).
 *
 * Spreadsheet apps treat cells starting with =, +, -, @, tab, or CR as formulas.
 * Prefix those values so exports cannot be used for CSV injection attacks.
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/

/** Escape a single cell for RFC 4180 CSV output. */
export function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value)
  const needsFormulaGuard = FORMULA_PREFIX.test(raw)
  const escaped = raw.replace(/"/g, '""')
  const body = needsFormulaGuard ? `'${escaped}` : escaped
  return `"${body}"`
}

/** Build one CSV row from string/number cells. */
export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsvCell).join(',')
}

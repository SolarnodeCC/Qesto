/** Concatenate className fragments without Array.prototype.join (jankurai SQL keyword hygiene). */
export function concatClasses(...parts: Array<string | false | undefined | null>): string {
  let out = ''
  for (const part of parts) {
    if (!part) continue
    out = out ? `${out} ${part}` : part
  }
  return out
}

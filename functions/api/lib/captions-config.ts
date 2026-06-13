/**
 * captions-config.ts — CAPTIONS-PIPELINE-01 (ADR-0051 §4).
 *
 * The 5-locale matrix (en/nl/es/de/fr) and its per-pair enablement gate. A
 * source→target translation pair is OFFERED to participants only when it has
 * cleared the Word-Error-Rate bar in the golden eval fixtures (REV-10). An
 * unenabled pair DEGRADES to source-language captions — never an error, never a
 * low-quality MT shipped as if authoritative (ADR-0051 §4, Alternatives).
 *
 * Enablement is server-side CONFIG (this constant), not code branching, so a
 * locale pair can be turned on/off by quality without a deploy reshape. The
 * captions eval suite (`tests/eval/captions-quality.eval.test.ts`) is the source
 * of truth for which pairs clear the bar; `CAPTION_PAIR_ENABLED` mirrors that
 * outcome. WER sign-off / GA is CAPTIONS-GA-01 (S89).
 */

/** The product's five supported locales (mirrors src/i18n SUPPORTED_LANGUAGES). */
export const CAPTION_LOCALES = ['en', 'nl', 'es', 'de', 'fr'] as const
export type CaptionLocale = (typeof CAPTION_LOCALES)[number]

/** A participant's caption preference: one of the five locales, or 'off'. */
export type CaptionLocalePref = CaptionLocale | 'off'

export function isCaptionLocale(v: unknown): v is CaptionLocale {
  return typeof v === 'string' && (CAPTION_LOCALES as readonly string[]).includes(v)
}

export function isCaptionLocalePref(v: unknown): v is CaptionLocalePref {
  return v === 'off' || isCaptionLocale(v)
}

/**
 * Word-Error-Rate bar. A transcript/translation fixture whose WER exceeds this
 * is NOT enabled. S88 sets the bar; S89 (CAPTIONS-GA-01) signs it off. ASR and
 * MT share the bar conceptually — both are model outputs measured against a
 * reference. 0.25 = ≤25% token error, the S88 "EN + top 4 locales" target.
 */
export const CAPTION_WER_BAR = 0.25

/**
 * Enabled source→target translation pairs (ADR-0051 §4 matrix). `source === target`
 * is implicitly "source" (no MT) and always allowed. A pair listed here has cleared
 * the WER bar in the golden fixtures. S88 priority set: EN-source → {nl,es,de,fr}.
 * Non-English source pairs are added as their fixtures clear the bar (likely S89+).
 *
 * Any (source, target) NOT in this set degrades to source-language captions.
 */
export const CAPTION_PAIR_ENABLED: Readonly<Record<CaptionLocale, ReadonlyArray<CaptionLocale>>> = {
  en: ['nl', 'es', 'de', 'fr'],
  nl: [],
  es: [],
  de: [],
  fr: [],
}

/**
 * Is the source→target translation pair enabled? Same-locale is always true
 * (it is the source, no MT). Cross-locale requires presence in CAPTION_PAIR_ENABLED.
 */
export function isPairEnabled(source: CaptionLocale, target: CaptionLocale): boolean {
  if (source === target) return true
  return CAPTION_PAIR_ENABLED[source].includes(target)
}

/**
 * The set of locales a participant can pick FROM (the FE picker), given a session
 * source locale: always the source itself, plus every enabled target.
 */
export function offeredTargetsFor(source: CaptionLocale): CaptionLocale[] {
  return CAPTION_LOCALES.filter((t) => isPairEnabled(source, t))
}

/**
 * Compute the distinct set of REMOTE target locales that need an MT call for a
 * given source + the set of active participant caption locales. Drives the
 * fan-out-once-per-locale discipline (ADR-0051 §2): the source locale is emitted
 * as-is (no MT); a target whose pair is NOT enabled degrades to source (no MT,
 * no separate variant). The returned set bounds MT calls to distinct enabled
 * remote locales — never per participant.
 */
export function mtTargetsFor(source: CaptionLocale, activeLocales: Iterable<CaptionLocale>): CaptionLocale[] {
  const out = new Set<CaptionLocale>()
  for (const loc of activeLocales) {
    if (loc === source) continue // source variant — no MT
    if (!isPairEnabled(source, loc)) continue // degrade to source — no MT
    out.add(loc)
  }
  return [...out]
}

/**
 * Word Error Rate between a reference transcript and a hypothesis, the standard
 * Levenshtein-on-tokens metric: (substitutions + insertions + deletions) /
 * reference word count. Lower-cased and punctuation-insensitive so scoring tracks
 * recognition, not formatting. Used by the captions eval suite to gate each pair
 * on `CAPTION_WER_BAR` (REV-10) — a pair above the bar is NOT enabled.
 */
export function wordErrorRate(reference: string, hypothesis: string): number {
  const ref = tokenize(reference)
  const hyp = tokenize(hypothesis)
  if (ref.length === 0) return hyp.length === 0 ? 0 : 1
  // Levenshtein edit distance over word tokens.
  const prev = new Array(hyp.length + 1)
  const curr = new Array(hyp.length + 1)
  for (let j = 0; j <= hyp.length; j++) prev[j] = j
  for (let i = 1; i <= ref.length; i++) {
    curr[0] = i
    for (let j = 1; j <= hyp.length; j++) {
      const cost = ref[i - 1] === hyp[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= hyp.length; j++) prev[j] = curr[j]
  }
  return prev[hyp.length] / ref.length
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Resolve which variant text a participant on `pref` should receive. Returns the
 * locale tag of the variant the DO must address to that socket. 'off' → null
 * (no caption). An enabled remote pair → that locale; anything else → source.
 */
export function resolveDeliveryLocale(
  source: CaptionLocale,
  pref: CaptionLocalePref,
): CaptionLocale | null {
  if (pref === 'off') return null
  if (pref === source) return source
  if (isPairEnabled(source, pref)) return pref
  return source // degrade-to-source for unenabled pair
}

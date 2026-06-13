/**
 * FE-CAPTIONS-OVERLAY-01 — Caption state management (S88)
 *
 * Manages a list of caption segments received via WebSocket.
 * Partial segments (isFinal=false) share an `id` with their final counterpart.
 * When the final arrives, the partial is locked in place (replaced by the final).
 *
 * Segments are deduplicated by `id`: each id appears at most once in the list.
 * The list is capped at MAX_SEGMENTS to bound memory; oldest entries are evicted.
 */

export type CaptionSegment = {
  id: string
  ts: number
  lang: string
  text: string
  isFinal: boolean
}

/** Maximum segments kept in state — corresponds to roughly 2–3 lines of caption history. */
export const MAX_SEGMENTS = 6

export type CaptionsState = {
  segments: CaptionSegment[]
  /** Whether captions are active (presenter started them). */
  active: boolean
  /** Locale the participant has chosen for captions. */
  locale: string
}

export type CaptionsAction =
  | { kind: 'segment'; segment: CaptionSegment }
  | { kind: 'start' }
  | { kind: 'stop' }
  | { kind: 'set_locale'; locale: string }

export const CAPTIONS_INITIAL: CaptionsState = {
  segments: [],
  active: false,
  locale: 'en',
}

/**
 * Pure reducer for captions state.
 *
 * Partial→final merge:
 *   1. If a partial segment arrives (isFinal=false): upsert by id (replace existing
 *      entry with the same id if present, otherwise append).
 *   2. If a final segment arrives (isFinal=true): replace the matching partial (or
 *      append if no partial with that id exists yet), then mark as final so it
 *      will not be replaced again.
 *   3. Cap the list at MAX_SEGMENTS, evicting from the front (oldest first).
 *
 * This ensures partial text "types in" smoothly and snaps to the final on commit.
 */
export function captionsReducer(state: CaptionsState, action: CaptionsAction): CaptionsState {
  switch (action.kind) {
    case 'start':
      return { ...state, active: true }

    case 'stop':
      return { ...state, active: false, segments: [] }

    case 'set_locale':
      return { ...state, locale: action.locale }

    case 'segment': {
      const { segment } = action
      const existing = state.segments.findIndex((s) => s.id === segment.id)

      let next: CaptionSegment[]
      if (existing >= 0) {
        // Replace in-place (keep position stable so text doesn't jump)
        next = state.segments.map((s, i) => (i === existing ? segment : s))
      } else {
        next = [...state.segments, segment]
      }

      // Cap at MAX_SEGMENTS, evicting oldest (from the front)
      if (next.length > MAX_SEGMENTS) {
        next = next.slice(next.length - MAX_SEGMENTS)
      }

      return { ...state, segments: next }
    }
  }
}

/** Returns only the segments that should be visible: last 2 distinct ids. */
export function visibleSegments(segments: CaptionSegment[]): CaptionSegment[] {
  if (segments.length === 0) return []
  // Show the last 2 unique ids (a partial + the one before it)
  const seen = new Set<string>()
  const reversed: CaptionSegment[] = []
  for (let i = segments.length - 1; i >= 0 && seen.size < 2; i--) {
    const s = segments[i]
    if (!seen.has(s.id)) {
      seen.add(s.id)
      reversed.push(s)
    }
  }
  return reversed.reverse()
}

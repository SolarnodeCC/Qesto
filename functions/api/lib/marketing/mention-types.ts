/** Shared normalized-mention shape produced by each platform client (reddit.ts, youtube.ts, linkedin mentions). */
export interface NormalizedMention {
  source_id: string
  author: string | null
  body: string
  url: string | null
  posted_at: number | null
}

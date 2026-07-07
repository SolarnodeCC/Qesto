import { describe, expect, it } from 'vitest'
import * as path from 'path'
import {
  parseFrontmatter,
  parseMarkdownSections,
  chunkMarkdown,
  deriveMetaFromPath,
  toStringArray,
} from '../../scripts/embed-kb'

// kbRoot inside embed-kb.ts is `${cwd}/knowledge-base`; build paths under it so
// the path-derived metadata is computed relative to the right root.
const kbFile = (rel: string) => path.join(process.cwd(), 'knowledge-base', rel)

describe('embed-kb frontmatter handling (F1: no file silently dropped)', () => {
  it('synthesizes metadata for a file with no YAML frontmatter instead of throwing', () => {
    const md = '# Release v5\n\nShipped the new dashboard.\n'
    const { meta, body } = parseFrontmatter(md, kbFile('product/releases/v5.md'))

    // Path-derived, collision-free id (never the old shared 'unknown').
    expect(meta.id).toBe('product-releases-v5')
    expect(meta.domain).toBe('product')
    // status defaults to 'accepted' so the doc is visible to default kb_search.
    expect(meta.status).toBe('accepted')
    expect(meta.title).toBe('Release v5')
    expect(body).toBe(md)
  })

  it('infers type from the top-level folder', () => {
    expect(deriveMetaFromPath(kbFile('adr/ADR-0099-x.md'), '').type).toBe('adr')
    expect(deriveMetaFromPath(kbFile('specifications/SPEC_X.md'), '').type).toBe('spec')
    expect(deriveMetaFromPath(kbFile('operations/runbook.md'), '').type).toBe('guide')
    expect(deriveMetaFromPath(kbFile('marketing/page.md'), '').type).toBe('unknown')
  })

  it('parses a bracketed tags list to a clean array (regression: tags.join crash)', () => {
    // This is the exact shape that used to crash the embedder and drop the file:
    // the bracket branch parsed the array, then the generic key:value matcher
    // overwrote it with the raw string, so `meta.tags.join(...)` threw.
    const md = ['---', 'id: DOC-1', 'tags: [vectorize, embeddings, bge-m3]', '---', '', 'Body.', ''].join('\n')
    const { meta } = parseFrontmatter(md, kbFile('operations/deployment/x.md'))
    expect(Array.isArray(meta.tags)).toBe(true)
    expect(meta.tags).toEqual(['vectorize', 'embeddings', 'bge-m3'])
    // Must not throw — this is what the embedder does per chunk.
    expect(() => meta.tags.join(', ')).not.toThrow()
  })

  it('falls back to a path-derived id when frontmatter omits id', () => {
    const md = ['---', 'type: guide', '---', '', 'Body.', ''].join('\n')
    const { meta } = parseFrontmatter(md, kbFile('operations/deployment/no-id.md'))
    expect(meta.id).toBe('operations-deployment-no-id')
    expect(meta.id).not.toBe('unknown')
  })

  it('preserves an explicit frontmatter id', () => {
    const md = ['---', 'id: ADR-040', 'type: adr', '---', '', '# Title', '', 'Body.', ''].join('\n')
    const { meta } = parseFrontmatter(md, kbFile('adr/ADR-040-x.md'))
    expect(meta.id).toBe('ADR-040')
  })
})

describe('embed-kb chunking (F1: preamble + heading-less content is embedded)', () => {
  it('captures content before the first heading as a preamble section', () => {
    const sections = parseMarkdownSections('Intro paragraph before any heading.\n\n# Later\n\nMore.\n')
    expect(sections[0].heading).toBe('Overview')
    expect(sections[0].content).toContain('Intro paragraph')
  })

  it('produces at least one chunk for a doc with no headings at all', () => {
    const meta = deriveMetaFromPath(kbFile('product/releases/notes.md'), 'body')
    const chunks = chunkMarkdown(meta.id, 'Just a paragraph, no headings anywhere.\n', meta)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
  })

  it('emits no phantom chunk when there is no preamble content', () => {
    const meta = deriveMetaFromPath(kbFile('adr/ADR-1-x.md'), '')
    const chunks = chunkMarkdown(meta.id, '# Heading\n\nContent.\n', meta)
    // The seeded 'Overview' section is empty and must be dropped by packIntoChunks.
    expect(chunks.every((c) => c.text.trim().length > 0)).toBe(true)
  })
})

describe('toStringArray', () => {
  it('passes through arrays, splits strings, and defaults to []', () => {
    expect(toStringArray(['a', 'b'])).toEqual(['a', 'b'])
    expect(toStringArray('a, b, c')).toEqual(['a', 'b', 'c'])
    expect(toStringArray("'quoted', \"double\"")).toEqual(['quoted', 'double'])
    expect(toStringArray(undefined)).toEqual([])
    expect(toStringArray(42)).toEqual([])
  })
})

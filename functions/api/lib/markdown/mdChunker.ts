/**
 * Markdown chunking for knowledge-base semantic search.
 * Splits documents on H1/H2/H3 headers, packs paragraphs into ~200-500 token chunks.
 * ADR-040 Phase 1.
 */

import { createHash } from 'crypto'

export interface FrontmatterMeta {
  id: string
  type: string
  domain: string
  category?: string
  status: string
  version?: string
  owner?: string
  title?: string
  tags: string[]
  relates_to: string[]
}

export interface Chunk {
  docId: string
  chunkIndex: number
  headingPath: string
  text: string
  startLine: number
  endLine: number
  hash: string
  tokenEstimate: number
}

const YAML_FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n/
const HEADING_REGEX = /^(#{1,3})\s+(.+)$/gm
const PARAGRAPH_SPLIT_REGEX = /\n\n+/

/** Estimate token count using chars/4 heuristic. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Compute SHA256 hash of a string. */
export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/** Parse YAML frontmatter from markdown. */
export function parseFrontmatter(markdown: string): {
  frontmatter: FrontmatterMeta
  body: string
} {
  const match = markdown.match(YAML_FRONTMATTER_REGEX)
  if (!match) {
    throw new Error('No YAML frontmatter found')
  }

  const yamlText = match[1]
  const body = markdown.slice(match[0].length)

  // Simple YAML parser (only handles our schema)
  const meta: Partial<FrontmatterMeta> = {
    id: '',
    type: 'unknown',
    domain: 'unknown',
    status: 'draft',
    tags: [],
    relates_to: [],
  }

  const lines = yamlText.split('\n')
  let inTags = false
  let inRelatesTo = false

  for (const line of lines) {
    if (!line.trim()) continue

    if (line.startsWith('id:')) {
      meta.id = line.slice(3).trim().replace(/['"]/g, '')
    } else if (line.startsWith('type:')) {
      meta.type = line.slice(5).trim().replace(/['"]/g, '')
    } else if (line.startsWith('domain:')) {
      meta.domain = line.slice(7).trim().replace(/['"]/g, '')
    } else if (line.startsWith('category:')) {
      meta.category = line.slice(9).trim().replace(/['"]/g, '')
    } else if (line.startsWith('status:')) {
      meta.status = line.slice(7).trim().replace(/['"]/g, '')
    } else if (line.startsWith('version:')) {
      meta.version = line.slice(8).trim().replace(/['"]/g, '')
    } else if (line.startsWith('owner:')) {
      meta.owner = line.slice(6).trim().replace(/['"]/g, '')
    } else if (line.startsWith('title:')) {
      meta.title = line.slice(6).trim().replace(/['"]/g, '')
    } else if (line.startsWith('tags:')) {
      inTags = true
      inRelatesTo = false
      const inline = line.slice(5).trim()
      if (inline.startsWith('[') && inline.endsWith(']')) {
        // Inline: tags: [a, b, c]
        meta.tags = inline
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/['"]/g, ''))
          .filter((s) => s)
      }
    } else if (line.startsWith('relates_to:')) {
      inTags = false
      inRelatesTo = true
      const inline = line.slice(11).trim()
      if (inline.startsWith('[') && inline.endsWith(']')) {
        meta.relates_to = inline
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/['"]/g, ''))
          .filter((s) => s)
      }
    } else if (inTags && line.startsWith('-')) {
      meta.tags!.push(line.slice(1).trim().replace(/['"]/g, ''))
    } else if (inRelatesTo && line.startsWith('-')) {
      meta.relates_to!.push(line.slice(1).trim().replace(/['"]/g, ''))
    }
  }

  if (!meta.id) throw new Error('Frontmatter missing required `id`')
  if (!meta.domain) throw new Error('Frontmatter missing required `domain`')

  return {
    frontmatter: meta as FrontmatterMeta,
    body,
  }
}

interface Section {
  level: number
  heading: string
  content: string
  startLine: number
}

/** Parse markdown body into sections by heading. */
function parseSections(body: string): Section[] {
  const sections: Section[] = []
  const lines = body.split('\n')
  let currentSection: Section | null = null
  let lineNum = 1

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)

    if (headingMatch) {
      const level = headingMatch[1].length
      const heading = headingMatch[2]

      if (currentSection) {
        sections.push(currentSection)
      }

      currentSection = {
        level,
        heading,
        content: '',
        startLine: lineNum,
      }
    } else if (currentSection) {
      currentSection.content += line + '\n'
    }

    lineNum++
  }

  if (currentSection) {
    sections.push(currentSection)
  }

  return sections
}

/** Pack paragraphs into chunks targeting 200-500 tokens (~800-2000 chars). */
function packIntoChunks(section: Section): { text: string; startLine: number; endLine: number }[] {
  const paragraphs = section.content.split(PARAGRAPH_SPLIT_REGEX).filter((p) => p.trim())
  if (!paragraphs.length) return []

  const chunks: { text: string; startLine: number; endLine: number }[] = []
  let currentChunk = ''
  let chunkStartLine = section.startLine + 1

  for (const para of paragraphs) {
    const paraToks = estimateTokens(para)
    const chunkToks = estimateTokens(currentChunk)

    if (chunkToks + paraToks <= 500 || !currentChunk) {
      currentChunk += (currentChunk ? '\n\n' : '') + para
    } else {
      if (currentChunk.trim()) {
        const chunkLines = currentChunk.split('\n').length
        chunks.push({
          text: currentChunk.trim(),
          startLine: chunkStartLine,
          endLine: chunkStartLine + chunkLines - 1,
        })
        chunkStartLine += chunkLines + 2 // +2 for paragraph break
      }
      currentChunk = para
    }
  }

  if (currentChunk.trim()) {
    const chunkLines = currentChunk.split('\n').length
    chunks.push({
      text: currentChunk.trim(),
      startLine: chunkStartLine,
      endLine: chunkStartLine + chunkLines - 1,
    })
  }

  return chunks
}

/** Build heading path for a section and its sub-sections. */
function buildHeadingPath(sections: Section[], index: number): string {
  const targetSection = sections[index]
  const path: string[] = []

  for (let i = index; i >= 0; i--) {
    const s = sections[i]
    if (s.level <= targetSection.level) {
      path.unshift(s.heading)
      if (s.level === 1) break
    }
  }

  return path.join(' › ')
}

/** Chunk markdown body into semantic units. */
export function chunkMarkdown(
  docId: string,
  body: string,
  frontmatter: FrontmatterMeta,
): Chunk[] {
  const sections = parseSections(body)
  if (!sections.length) return []

  const chunks: Chunk[] = []
  let chunkIndex = 0

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const sectionTokens = estimateTokens(section.content)

    // Merge tiny sections with next H2+
    if (sectionTokens < 80 && section.level > 1) {
      let nextIdx = i + 1
      while (nextIdx < sections.length && sections[nextIdx].level > section.level) {
        nextIdx++
      }
      if (nextIdx < sections.length && sections[nextIdx].level <= section.level) {
        // Merge into next
        sections[nextIdx].content = section.content + '\n\n' + sections[nextIdx].content
        continue
      }
    }

    const subChunks = packIntoChunks(section)
    for (const subChunk of subChunks) {
      const embeddingInput = getEmbeddingInput(
        {
          docId,
          chunkIndex,
          headingPath: buildHeadingPath(sections, i),
          text: subChunk.text,
          startLine: subChunk.startLine,
          endLine: subChunk.endLine,
          hash: '', // will fill below
          tokenEstimate: estimateTokens(subChunk.text),
        },
        frontmatter,
      )

      chunks.push({
        docId,
        chunkIndex,
        headingPath: buildHeadingPath(sections, i),
        text: subChunk.text,
        startLine: subChunk.startLine,
        endLine: subChunk.endLine,
        hash: sha256(embeddingInput),
        tokenEstimate: estimateTokens(subChunk.text),
      })

      chunkIndex++
    }
  }

  return chunks
}

/** Format chunk + metadata for embedding input (semantic enrichment). */
export function getEmbeddingInput(chunk: Chunk, frontmatter: FrontmatterMeta): string {
  const parts: string[] = []

  // Categorical signals
  parts.push(`[type=${frontmatter.type} | domain=${frontmatter.domain}]`)
  if (frontmatter.tags.length) {
    parts.push(`[tags: ${frontmatter.tags.join(', ')}]`)
  }

  // Document + section heading
  const title = frontmatter.title || 'Untitled'
  parts.push(`# ${title} › ${chunk.headingPath}`)

  // Chunk text
  parts.push(chunk.text)

  return parts.join('\n')
}

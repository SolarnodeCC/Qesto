#!/usr/bin/env node
/**
 * generate-help-seed.mjs — derive the help-assistant RAG seed from the curated
 * help docs, so the index can never drift from `knowledge-base/help/*.md`.
 *
 * Source of truth : knowledge-base/help/*.md  (front-matter + Markdown body)
 * Generated output: functions/api/seed/help-documents.json
 *
 * Each Markdown file is split into chunks by H2 (`## `) headings. The intro
 * (H1 + lead paragraph, before the first H2) becomes chunk `-001`; each H2
 * section becomes the next chunk. Fine-grained chunks retrieve more precisely
 * than one giant document per file.
 *
 * Usage:
 *   node scripts/generate-help-seed.mjs           # write the JSON
 *   node scripts/generate-help-seed.mjs --check    # exit 1 if committed JSON is stale (CI gate)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HELP_DIR = path.join(__dirname, '../knowledge-base/help')
const OUT_FILE = path.join(__dirname, '../functions/api/seed/help-documents.json')

const SCOPES = new Set(['free', 'starter', 'team'])

function parseFrontmatter(raw, file) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) throw new Error(`${file}: missing YAML front-matter`)
  const fm = {}
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const val = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
    if (['id', 'title', 'topic', 'scope', 'excerpt'].includes(key)) fm[key] = val
  }
  for (const k of ['id', 'title', 'topic', 'scope', 'excerpt']) {
    if (!fm[k]) throw new Error(`${file}: missing front-matter field "${k}"`)
  }
  if (!SCOPES.has(fm.scope)) throw new Error(`${file}: invalid scope "${fm.scope}"`)
  return { fm, body: m[2] }
}

/** Split a Markdown body into [{heading|null, content}] segments by H2 headings. */
function splitByH2(body) {
  const lines = body.split('\n')
  const segments = []
  let current = { heading: null, lines: [] }
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+?)\s*$/)
    if (h2) {
      segments.push(current)
      current = { heading: h2[1].trim(), lines: [line] }
    } else {
      current.lines.push(line)
    }
  }
  segments.push(current)
  return segments
    .map((s) => ({ heading: s.heading, content: s.lines.join('\n').trim() }))
    .filter((s) => s.content.length > 0)
}

/** Derive a short excerpt from a section's body (first real sentence/line). */
function deriveExcerpt(content, fallback) {
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (/^#{1,6}\s/.test(line)) continue // headings
    if (/^([-*+]|\d+\.|\||```)/.test(line)) continue // lists, tables, fences
    const clean = line.replace(/[*_`]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    const sentence = clean.split(/(?<=[.!?])\s/)[0]
    const out = (sentence || clean).trim()
    if (out.length >= 20) return out.length > 200 ? out.slice(0, 197).trimEnd() + '…' : out
  }
  return fallback
}

function buildDocs() {
  const files = fs
    .readdirSync(HELP_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()

  const docs = []
  for (const file of files) {
    const raw = fs.readFileSync(path.join(HELP_DIR, file), 'utf-8')
    const { fm, body } = parseFrontmatter(raw, file)
    const segments = splitByH2(body)
    segments.forEach((seg, i) => {
      const seq = String(i + 1).padStart(3, '0')
      const isIntro = i === 0
      docs.push({
        id: `${fm.id}-${seq}`,
        title: isIntro || !seg.heading ? fm.title : `${fm.title}: ${seg.heading}`,
        topic: fm.topic,
        scope: fm.scope,
        excerpt: isIntro ? fm.excerpt : deriveExcerpt(seg.content, fm.excerpt),
        content: seg.content,
      })
    })
  }
  docs.sort((a, b) => a.id.localeCompare(b.id))
  return docs
}

function serialize(docs) {
  return JSON.stringify(docs, null, 2) + '\n'
}

function main() {
  const check = process.argv.includes('--check')
  const next = serialize(buildDocs())

  if (check) {
    const current = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf-8') : ''
    if (current !== next) {
      console.error(
        '[help-seed] functions/api/seed/help-documents.json is out of sync with knowledge-base/help/*.md.\n' +
          '            Run `npm run help:seed:build` and commit the result.',
      )
      process.exit(1)
    }
    console.log('[help-seed] seed is in sync with help docs ✓')
    return
  }

  fs.writeFileSync(OUT_FILE, next)
  const docs = JSON.parse(next)
  const topics = [...new Set(docs.map((d) => d.topic))].sort()
  console.log(`[help-seed] wrote ${docs.length} chunks across topics: ${topics.join(', ')}`)
}

main()

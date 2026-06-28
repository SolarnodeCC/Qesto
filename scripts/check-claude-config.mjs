#!/usr/bin/env node
/**
 * check-claude-config.mjs
 * CI gate for the Claude Code prompt-asset layer under `.claude/`.
 *
 * Qesto's config advantage is convention quality (per-agent version/owner,
 * single-source COMMON_RULES, OWNERS.md ownership matrix, HANDOFFS edges).
 * Conventions with no enforcement drift silently — this gate turns each
 * convention into a red build instead of slow decay.
 *
 * Checks (all must pass; exit 1 on any violation):
 *  1. Every agent has frontmatter: name, model (opus|sonnet|haiku), version, owner.
 *  2. Every agent body references COMMON_RULES.md (the single safety baseline).
 *  3. OWNERS.md ↔ filesystem are in sync, both directions, for agents and skills.
 *  4. No dead `.claude/skills/<x>.md` links in any agent or skill.
 *  5. COMMON_RULES.md and HANDOFFS.md carry VERSION + OWNER headers; OWNERS.md
 *     carries a "_Last reviewed_" date.
 *  6. COMMON_RULES.md still contains the prompt-injection defense baseline
 *     (it must not be silently deleted — agents inherit it by reference).
 *
 * No external deps; ESM (package.json "type": "module").
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CLAUDE = resolve(ROOT, '.claude')
const AGENTS_DIR = resolve(CLAUDE, 'agents')
const SKILLS_DIR = resolve(CLAUDE, 'skills')

const VALID_MODELS = new Set(['opus', 'sonnet', 'haiku'])
// Skill files that are governance docs, not role skills — excluded from the
// "must be listed in OWNERS.md ## Skills" requirement where noted.
const SELF = 'OWNERS.md' // OWNERS.md does not list itself

const errors = []
const err = (file, msg) => errors.push(`${file}: ${msg}`)

const md = (dir) => readdirSync(dir).filter((f) => f.endsWith('.md'))
// Normalize CRLF → LF so frontmatter/line parsing is OS-independent.
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return null
  const fm = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_]+):\s*(.*)$/)
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim()
  }
  return fm
}

// ── Parse OWNERS.md sections ──────────────────────────────────────────────
function parseOwners(text) {
  const sections = {}
  let current = null
  for (const line of text.split('\n')) {
    const h = line.match(/^##\s+(\w[\w\s/]*)/)
    if (h) { current = h[1].trim().toLowerCase(); sections[current] = new Set(); continue }
    const item = line.match(/^-\s+([\w.-]+\.md)\b/)
    if (item && current) sections[current].add(item[1])
  }
  return sections
}

// ── 1 + 2: agent frontmatter + COMMON_RULES reference ─────────────────────
const agentFiles = md(AGENTS_DIR)
for (const f of agentFiles) {
  const text = read(resolve(AGENTS_DIR, f))
  const fm = frontmatter(text)
  if (!fm) { err(f, 'missing or malformed YAML frontmatter'); continue }
  if (!fm.name) err(f, 'frontmatter missing `name`')
  if (!fm.version) err(f, 'frontmatter missing `version`')
  if (!fm.owner) err(f, 'frontmatter missing `owner`')
  if (!fm.model) err(f, 'frontmatter missing `model`')
  else if (!VALID_MODELS.has(fm.model)) err(f, `invalid model "${fm.model}" (expected opus|sonnet|haiku)`)
  if (!text.includes('COMMON_RULES.md')) err(f, 'body does not reference COMMON_RULES.md (safety baseline)')
}

// ── 4: dead skill links (agents + skills) ─────────────────────────────────
const skillFiles = new Set(md(SKILLS_DIR))
const LINK_RE = /\.claude\/skills\/([\w.-]+\.md)/g
const scanLinks = (dir, files) => {
  for (const f of files) {
    const text = read(resolve(dir, f))
    for (const m of text.matchAll(LINK_RE)) {
      if (!skillFiles.has(m[1])) err(f, `dead skill link → .claude/skills/${m[1]}`)
    }
  }
}
scanLinks(AGENTS_DIR, agentFiles)
scanLinks(SKILLS_DIR, [...skillFiles])

// ── 3 + 5 + 6: OWNERS.md sync + policy headers + defense baseline ─────────
const ownersPath = resolve(SKILLS_DIR, 'OWNERS.md')
if (!existsSync(ownersPath)) {
  err('OWNERS.md', 'missing')
} else {
  const ownersText = read(ownersPath)
  if (!/_Last reviewed_/.test(ownersText)) err('OWNERS.md', 'missing "_Last reviewed_" date')
  const sec = parseOwners(ownersText)
  const listedAgents = sec['agents'] ?? new Set()
  const listedSkills = sec['skills'] ?? new Set()

  for (const f of agentFiles) if (!listedAgents.has(f)) err('OWNERS.md', `agent not listed: ${f}`)
  for (const f of listedAgents) if (!existsSync(resolve(AGENTS_DIR, f))) err('OWNERS.md', `lists non-existent agent: ${f}`)

  for (const f of skillFiles) {
    if (f === SELF) continue
    if (!listedSkills.has(f)) err('OWNERS.md', `skill not listed: ${f}`)
  }
  for (const f of listedSkills) if (!skillFiles.has(f)) err('OWNERS.md', `lists non-existent skill: ${f}`)
}

const requireHeaders = (file) => {
  const p = resolve(SKILLS_DIR, file)
  if (!existsSync(p)) return err(file, 'missing')
  const t = read(p)
  if (!/VERSION:\s*v?\d+\.\d+\.\d+/i.test(t)) err(file, 'missing "VERSION: vX.Y.Z" header')
  if (!/OWNER:\s*\S+/i.test(t)) err(file, 'missing "OWNER:" header')
}
requireHeaders('COMMON_RULES.md')
requireHeaders('HANDOFFS.md')

const commonPath = resolve(SKILLS_DIR, 'COMMON_RULES.md')
if (existsSync(commonPath)) {
  const t = read(commonPath)
  if (!/prompt[- ]injection/i.test(t) || !/untrusted/i.test(t)) {
    err('COMMON_RULES.md', 'prompt-injection / untrusted-content defense baseline is missing')
  }
}

// ── Report ────────────────────────────────────────────────────────────────
if (errors.length) {
  console.error(`\n✗ check:claude-config — ${errors.length} violation(s):\n`)
  for (const e of errors) console.error(`  • ${e}`)
  console.error('\nFix the above so the .claude/ prompt-asset conventions stay enforced.\n')
  process.exit(1)
}
console.log(`✓ check:claude-config — ${agentFiles.length} agents, ${skillFiles.size} skills: conventions enforced.`)

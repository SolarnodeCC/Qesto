#!/usr/bin/env node
/**
 * check-ai-gateway.mjs
 * CI ratchet (ADR-0068): every Workers AI inference should go through the
 * `lib/ai/ai-gateway.ts` facade (`runAI` / `runThroughAIGateway`) so caching,
 * rate limiting, prompt sanitisation, retry and timeout are applied uniformly.
 * Direct `env.AI.run(...)` / `ai.run(...)` calls outside that module are
 * counted; the build fails if the count exceeds the recorded baseline, so the
 * debt can only shrink. Lower BASELINE as you migrate call sites.
 *
 * See REFACTORING_AUDIT.md (High: "Workers AI calls bypass the gateway wrapper").
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, relative, join } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const SCAN_DIR = resolve(ROOT, 'functions')
// The facade itself must call env.AI.run() (gateway-unavailable fallback path).
const ALLOWED = new Set([resolve(ROOT, 'functions/api/lib/ai/ai-gateway.ts')])
const PATTERN = /\.AI\.run\b|\bai\.run\(/g

// Current known violations. Ratchet DOWN only — never raise this.
// Burn down by routing call sites through runAI()/runThroughAIGateway().
const BASELINE = 32

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

const violations = []
for (const file of walk(SCAN_DIR)) {
  if (ALLOWED.has(file)) continue
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    const matches = line.match(PATTERN)
    if (matches) violations.push({ file: relative(ROOT, file), line: i + 1, count: matches.length, text: line.trim().slice(0, 100) })
  })
}

const total = violations.reduce((n, v) => n + v.count, 0)

if (total > BASELINE) {
  console.error(`❌ Direct Workers AI calls increased: ${total} (baseline ${BASELINE}).`)
  console.error('   New AI inference must go through lib/ai/ai-gateway.ts (runAI / runThroughAIGateway).\n')
  for (const v of violations) console.error(`   ${v.file}:${v.line}  ${v.text}`)
  process.exit(1)
}

if (total < BASELINE) {
  console.log(`✅ Direct Workers AI calls down to ${total} (baseline ${BASELINE}). Lower BASELINE in scripts/check-ai-gateway.mjs to lock in the win.`)
} else {
  console.log(`✅ Direct Workers AI calls at baseline (${total}). No regression.`)
}

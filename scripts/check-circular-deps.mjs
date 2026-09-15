#!/usr/bin/env node
/**
 * DD-13 — circular-dependency ratchet.
 *
 * Cycles in ESM can yield partially-initialised bindings depending on entry
 * order. On `lib/authz.ts` — which imported the route layer it is meant to serve
 * — that is a Dependency Inversion violation on the most security-sensitive
 * module in the system, and it also makes the module untestable in isolation.
 *
 * Follows the existing ratchet convention (check-kv-access.mjs and friends):
 * count a known anti-pattern, fail if it grows. Debt may only shrink.
 *
 * Self-contained by design — no madge dependency, matching the other checks.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOTS = ['functions/api', 'src']
const BASELINE_FILE = path.join(root, 'ops/ci/circular-deps-baseline.json')

const files = []
function collect(dir) {
  if (!fs.existsSync(dir)) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      collect(full)
    } else if (/\.tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name)) {
      files.push(full)
    }
  }
}
for (const r of ROOTS) collect(path.join(root, r))

const known = new Set(files.map((f) => path.relative(root, f)))

/**
 * Resolve a relative specifier to a repo-relative file we actually have.
 * Type-only imports are skipped: `import type` is erased at compile time and
 * cannot produce a runtime cycle.
 */
function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) return null
  const base = path.resolve(path.dirname(path.join(root, fromFile)), spec)
  const rel = (p) => path.relative(root, p)
  for (const cand of [
    `${base}.ts`, `${base}.tsx`,
    path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
    base,
  ]) {
    const r = rel(cand)
    if (known.has(r)) return r
  }
  return null
}

const graph = new Map()
for (const abs of files) {
  const rel = path.relative(root, abs)
  const src = fs.readFileSync(abs, 'utf8')
  const deps = new Set()
  // Value imports/exports only — `import type` / `export type` are erased.
  const re = /(?:^|\n)\s*(?:import|export)\s+(?!type\s)([^;'"]*?)from\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(src)) !== null) {
    if (/^\s*\{?\s*type\s/.test(m[1])) continue
    const target = resolveSpec(rel, m[2])
    if (target && target !== rel) deps.add(target)
  }
  graph.set(rel, deps)
}

// Tarjan-free cycle enumeration: DFS with an explicit stack, recording the
// first cycle found through each entry node. Enough for a ratchet count.
const cycles = []
const seen = new Set()
function dfs(node, stack, onStack) {
  for (const next of graph.get(node) ?? []) {
    if (onStack.has(next)) {
      const cyc = stack.slice(stack.indexOf(next)).concat(next)
      const key = [...cyc].sort().join('>')
      if (!seen.has(key)) { seen.add(key); cycles.push(cyc) }
      continue
    }
    if (stack.includes(next)) continue
    stack.push(next); onStack.add(next)
    dfs(next, stack, onStack)
    stack.pop(); onStack.delete(next)
  }
}
for (const node of graph.keys()) dfs(node, [node], new Set([node]))

const baseline = fs.existsSync(BASELINE_FILE)
  ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).max
  : cycles.length

if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true })
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify({ max: cycles.length }, null, 2)}\n`)
  console.log(`Wrote baseline: ${cycles.length}`)
  process.exit(0)
}

if (cycles.length > baseline) {
  console.error(`\n✖ Circular dependencies grew: ${cycles.length} (baseline ${baseline})\n`)
  for (const c of cycles) console.error(`  ${c.join(' > ')}`)
  console.error('\nBreak the new cycle, or justify and re-baseline with --write.\n')
  process.exit(1)
}

if (cycles.length < baseline) {
  console.log(`check:circular OK — ${cycles.length} cycles, below baseline ${baseline}.`)
  console.log('Ratchet down: npm run check:circular -- --write')
} else {
  console.log(`check:circular OK — ${cycles.length} cycles (at baseline).`)
}

#!/usr/bin/env node
/**
 * FE-DM-CI-01 — fail if marketing/solution pages lack dark: Tailwind variants (S72).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', 'src', 'pages')
const TARGETS = ['Home.tsx', 'Pricing.tsx', 'GdprTrustPage.tsx', 'Soc2TrustPage.tsx', 'MarketplacePage.tsx']
const REQUIRED = /dark:/

const failures = []

for (const file of TARGETS) {
  const path = join(ROOT, file)
  try {
    const src = readFileSync(path, 'utf8')
    if (!REQUIRED.test(src)) failures.push(file)
  } catch {
    failures.push(`${file} (missing)`)
  }
}

function walkSolutions(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walkSolutions(p)
    else if (name.endsWith('Page.tsx')) {
      const src = readFileSync(p, 'utf8')
      if (!REQUIRED.test(src)) failures.push(p.replace(join(ROOT, ''), 'pages/'))
    }
  }
}
walkSolutions(join(ROOT, 'solutions'))

if (failures.length) {
  console.error('check-marketing-dark-mode: pages missing dark: classes:\n', failures.join('\n '))
  process.exit(1)
}
console.log('check-marketing-dark-mode: ok')

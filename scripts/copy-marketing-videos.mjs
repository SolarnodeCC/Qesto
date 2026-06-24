#!/usr/bin/env node
/**
 * Copy latest Playwright marketing-demo recordings to stable filenames.
 * Source: tests/artifacts/output/marketing-* folders
 * Dest: tests/artifacts/marketing-videos/
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(root, 'tests', 'artifacts', 'output')
const destDir = path.join(root, 'tests', 'artifacts', 'marketing-videos')

/** Substring match on Playwright output folder name → marketing asset filename */
const MAP = [
  ['marketing-full-showcase', '00-full-product-showcase.webm'],
  ['marketing-energizer-wizard', '01a-wizard-energizer-setup.webm'],
  ['marketing-interactive-sess', '01b-interactive-live-session.webm'],
  ['marketing-townhall-qa', '02-townhall-live-qa.webm'],
]

if (!fs.existsSync(outputDir)) {
  console.error('No Playwright output dir — run npm run test:e2e:marketing first')
  process.exit(1)
}

fs.mkdirSync(destDir, { recursive: true })

let copied = 0
for (const [prefix, filename] of MAP) {
  const runs = fs
    .readdirSync(outputDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith(prefix))
    .map((d) => {
      const full = path.join(outputDir, d.name)
      return { full, mtime: fs.statSync(full).mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime)

  const latest = runs[0]
  if (!latest) continue

  const src = path.join(latest.full, 'video.webm')
  if (!fs.existsSync(src)) continue

  const dest = path.join(destDir, filename)
  fs.copyFileSync(src, dest)
  console.log(`✓ ${filename}`)
  copied++
}

if (copied === 0) {
  console.error('No marketing video.webm files found in tests/artifacts/output/')
  process.exit(1)
}

console.log(`Copied ${copied} video(s) → tests/artifacts/marketing-videos/`)

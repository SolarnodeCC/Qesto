#!/usr/bin/env node
// scripts/build-tokens.mjs
// Generates src/ui/tokens.ts and src/ui/tailwind-theme.ts from docs/specs/design-tokens.json.
// Invoked by `npm run tokens:build` (runs automatically in `npm run build`).
// Never hand-edit src/ui/tokens.ts or src/ui/tailwind-theme.ts — they are derived artefacts (DESIGN-TOK-01).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DEFAULT_SRC = resolve(ROOT, 'docs/specs/design-tokens.json')

function resolveRef(value, root) {
  if (typeof value !== 'string') return value
  const match = value.match(/^\{([^}]+)\}$/)
  if (!match) return value
  const parts = match[1].split('.')
  let node = root
  for (const p of parts) {
    node = node?.[p]
    if (!node) return value
  }
  return resolveRef(node.value ?? node, root)
}

function walk(node, root, path = []) {
  const out = {}
  for (const [key, val] of Object.entries(node)) {
    if (key.startsWith('$')) continue
    if (val && typeof val === 'object' && 'value' in val) {
      out[key] = resolveRef(val.value, root)
    } else if (val && typeof val === 'object') {
      out[key] = walk(val, root, [...path, key])
    }
  }
  return out
}

// Generate tailwind-theme.ts from colors, spacing, radius, shadows, typography
function buildTailwindTheme(tokens) {
  const theme = {
    colors: {},
    spacing: {},
    borderRadius: {},
    boxShadow: {},
    fontFamily: {},
    fontSize: {},
    fontWeight: {},
    extend: {
      transitionTimingFunction: {},
      borderWidth: {}
    }
  }

  // Colors: color.teal, color.violet, color.pulse, color.signal, color.surface, color.text, color.chart
  if (tokens.color) {
    const colorMap = {
      teal: tokens.color.teal || {},
      violet: tokens.color.violet || {},
      pulse: tokens.color.pulse || {},
      success: tokens.color.signal?.success,
      warning: tokens.color.signal?.warning,
      error: tokens.color.signal?.error,
      info: tokens.color.signal?.info,
      background: tokens.color.surface?.background,
      'background-subtle': tokens.color.surface?.backgroundSubtle,
      'border': tokens.color.surface?.border,
      'border-strong': tokens.color.surface?.borderStrong,
      'text-primary': tokens.color.text?.primary,
      'text-secondary': tokens.color.text?.secondary,
      'text-muted': tokens.color.text?.muted,
      'text-on-brand': tokens.color.text?.onBrand,
      'text-link': tokens.color.text?.link,
      'text-link-ai': tokens.color.text?.linkAi
    }

    for (const [name, shades] of Object.entries(colorMap)) {
      if (typeof shades === 'string') {
        // Flat color (signal colors, surface colors, text colors)
        theme.colors[name] = shades
      } else if (shades && typeof shades === 'object') {
        // Palette with shades (teal, violet, pulse)
        theme.colors[name] = {}
        for (const [shade, value] of Object.entries(shades)) {
          theme.colors[name][shade] = value
        }
      }
    }
  }

  // Spacing: space.*
  if (tokens.space) {
    for (const [key, value] of Object.entries(tokens.space)) {
      theme.spacing[key] = value
    }
  }

  // Border radius: radius.*
  if (tokens.radius) {
    const radiusMap = {
      'sm': tokens.radius.sm,
      'md': tokens.radius.md,
      'lg': tokens.radius.lg,
      'xl': tokens.radius.xl,
      'pill': tokens.radius.pill
    }
    for (const [key, value] of Object.entries(radiusMap)) {
      if (value) theme.borderRadius[key] = value
    }
  }

  // Shadows: shadow.*
  if (tokens.shadow) {
    const shadowMap = {
      'card': tokens.shadow.card,
      'elevated': tokens.shadow.elevated,
      'teal': tokens.shadow.teal,
      'ai': tokens.shadow.ai,
      'focus-ring': tokens.shadow.focusRing
    }
    for (const [key, value] of Object.entries(shadowMap)) {
      if (value) theme.boxShadow[key] = value
    }
  }

  // Typography - fontFamily
  if (tokens.typography?.fontFamily) {
    const fontMap = {
      'sans': tokens.typography.fontFamily.body,
      'display': tokens.typography.fontFamily.display,
      'mono': tokens.typography.fontFamily.mono
    }
    for (const [key, value] of Object.entries(fontMap)) {
      if (value) theme.fontFamily[key] = value
    }
  }

  // Typography - fontWeight
  if (tokens.typography?.fontWeight) {
    const weightMap = {
      'normal': tokens.typography.fontWeight.regular,
      'medium': tokens.typography.fontWeight.medium,
      'semibold': tokens.typography.fontWeight.semibold,
      'bold': tokens.typography.fontWeight.bold
    }
    for (const [key, value] of Object.entries(weightMap)) {
      if (value !== undefined) theme.fontWeight[key] = value
    }
  }

  // Easing functions
  if (tokens.motion?.easing) {
    theme.extend.transitionTimingFunction = {
      'standard': tokens.motion.easing.standard,
      'enter': tokens.motion.easing.enter,
      'exit': tokens.motion.easing.exit
    }
  }

  // Grid configuration: cols (4, 8, 12) + gutters
  if (tokens.grid) {
    theme.extend.gridTemplateColumns = {}
    // Add common column counts (1-12)
    for (let i = 1; i <= 12; i++) {
      theme.extend.gridTemplateColumns[`${i}`] = `repeat(${i}, minmax(0, 1fr))`
    }
    // Add specific grid sizes from design tokens
    if (tokens.grid.mobile?.columns) {
      theme.extend.gridTemplateColumns['mobile'] = `repeat(${tokens.grid.mobile.columns}, minmax(0, 1fr))`
    }
    if (tokens.grid.tablet?.columns) {
      theme.extend.gridTemplateColumns['tablet'] = `repeat(${tokens.grid.tablet.columns}, minmax(0, 1fr))`
    }
    if (tokens.grid.desktop?.columns) {
      theme.extend.gridTemplateColumns['desktop'] = `repeat(${tokens.grid.desktop.columns}, minmax(0, 1fr))`
    }

    // Grid gap from spacing tokens
    theme.extend.gap = theme.extend.gap || {}
    if (tokens.grid.mobile?.gutter) {
      theme.extend.gap['mobile'] = tokens.grid.mobile.gutter
    }
    if (tokens.grid.tablet?.gutter) {
      theme.extend.gap['tablet'] = tokens.grid.tablet.gutter
    }
    if (tokens.grid.desktop?.gutter) {
      theme.extend.gap['desktop'] = tokens.grid.desktop.gutter
    }
  }

  return theme
}

function outputPath(value, fallback) {
  return resolve(ROOT, value ?? fallback)
}

export function buildTokens(options = {}) {
  const src = options.src ?? DEFAULT_SRC
  const outTokens = options.outTokens ?? outputPath(process.env.QESTO_TOKENS_OUT, 'src/ui/tokens.ts')
  const outTailwind = options.outTailwind ?? outputPath(process.env.QESTO_TAILWIND_OUT, 'src/ui/tailwind-theme.ts')
  const log = options.log ?? console.log

  const raw = JSON.parse(readFileSync(src, 'utf8'))
  const tokens = walk(raw, raw)

  const banner = `// AUTO-GENERATED from docs/specs/design-tokens.json — do not edit by hand.
// Regenerate: \`npm run tokens:build\`. See DESIGN-TOK-01.

`

  const body = `export const tokens = ${JSON.stringify(tokens, null, 2)} as const\n\nexport type Tokens = typeof tokens\n`

  mkdirSync(dirname(outTokens), { recursive: true })
  writeFileSync(outTokens, banner + body)
  log(`✓ wrote ${outTokens}`)

  const tailwindTheme = buildTailwindTheme(tokens)

  const tailwindBanner = `// AUTO-GENERATED from docs/specs/design-tokens.json — do not edit by hand.
// This file is used by vite.config.ts to extend the Tailwind theme.
// Regenerate: \`npm run tokens:build\`. See DESIGN-TOK-01.

`

  const tailwindBody = `export const theme = ${JSON.stringify(tailwindTheme, null, 2)} as const\n`

  mkdirSync(dirname(outTailwind), { recursive: true })
  writeFileSync(outTailwind, tailwindBanner + tailwindBody)
  log(`✓ wrote ${outTailwind}`)

  return { tokens, tailwindTheme, outTokens, outTailwind }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (fileURLToPath(import.meta.url) === invokedPath) {
  buildTokens()
}

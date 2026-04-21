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
const SRC = resolve(ROOT, 'docs/specs/design-tokens.json')
const OUT_TOKENS = resolve(ROOT, 'src/ui/tokens.ts')
const OUT_TAILWIND = resolve(ROOT, 'src/ui/tailwind-theme.ts')

const raw = JSON.parse(readFileSync(SRC, 'utf8'))

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

const tokens = walk(raw, raw)

// Generate tokens.ts
const banner = `// AUTO-GENERATED from docs/specs/design-tokens.json — do not edit by hand.
// Regenerate: \`npm run tokens:build\`. See DESIGN-TOK-01.

`

const body = `export const tokens = ${JSON.stringify(tokens, null, 2)} as const\n\nexport type Tokens = typeof tokens\n`

mkdirSync(dirname(OUT_TOKENS), { recursive: true })
writeFileSync(OUT_TOKENS, banner + body)
console.log(`✓ wrote ${OUT_TOKENS}`)

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

  return theme
}

const tailwindTheme = buildTailwindTheme(tokens)

const tailwindBanner = `// AUTO-GENERATED from docs/specs/design-tokens.json — do not edit by hand.
// This file is used by vite.config.ts to extend the Tailwind theme.
// Regenerate: \`npm run tokens:build\`. See DESIGN-TOK-01.

`

const tailwindBody = `export const theme = ${JSON.stringify(tailwindTheme, null, 2)} as const\n`

writeFileSync(OUT_TAILWIND, tailwindBanner + tailwindBody)
console.log(`✓ wrote ${OUT_TAILWIND}`)

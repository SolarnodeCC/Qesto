#!/usr/bin/env node
// scripts/check-design-tokens.mjs
// Validates that all React components use semantic design token classes, not raw Tailwind.
// Invoked by CI to prevent design token drift (DESIGN-TOK-01).

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = new URL('.', import.meta.url).pathname
const ROOT = resolve(__dirname, '..')
const SRC = resolve(ROOT, 'src')

// Design tokens that are allowed in className (from components.tsx)
const ALLOWED_TOKEN_CLASSES = new Set([
  // Typography
  'text-heading-s', 'text-heading-m', 'text-heading-l', 'text-display-l',
  'text-body-s', 'text-body-m', 'text-body-l',
  'text-caption',
  'font-semibold', 'font-bold', 'font-medium', 'font-normal',
  'leading-relaxed',

  // Spacing
  'p-space-1', 'p-space-2', 'p-space-3', 'p-space-4', 'p-space-5', 'p-space-6', 'p-space-12',
  'px-space-1', 'px-space-2', 'px-space-3', 'px-space-4', 'px-space-5',
  'py-space-1', 'py-space-2', 'py-space-3', 'py-space-4',
  'gap-space-1', 'gap-space-2', 'gap-space-3', 'gap-space-4',
  'gap-2', 'gap-3', 'gap-4', 'gap-5',
  'mt-space-1', 'mt-space-2', 'mt-space-4',
  'mb-space-2', 'mb-space-4',
  'space-y-space-4',
  'max-w-6xl', 'min-h-screen',

  // Colors (signal/surface/text)
  'text-pulse-500', 'text-pulse-600', 'text-pulse-700', 'text-pulse-900',
  'text-teal-600', 'text-teal-700', 'text-amber-600',
  'text-signal-error', 'text-red-600',
  'border-pulse-200', 'border-pulse-300',
  'border-teal-500', 'border-teal-200',
  'border-red-200', 'border-red-300',
  'border-amber-200', 'border-amber-700',
  'border-green-200', 'border-green-700',
  'border-violet-400',
  'bg-pulse-50', 'bg-pulse-100', 'bg-pulse-200',
  'bg-teal-50', 'bg-teal-100',
  'bg-red-50', 'bg-red-100',
  'bg-amber-100',
  'bg-green-100', 'bg-green-700',
  'bg-white', 'bg-transparent',
  'bg-gradient-brand', 'bg-gradient-ai',

  // Borders & Radius
  'border', 'rounded-lg', 'rounded-md', 'rounded-pill', 'rounded-xl',

  // Shadows
  'shadow-card', 'shadow-elevated', 'shadow-teal',
  'focus:ring-2', 'focus:ring-offset-2', 'focus:ring-teal-100',
  'focus:ring-teal-500',
  'focus:outline-none', 'focus:border-teal-500',

  // Layout
  'flex', 'flex-col', 'items-center', 'items-baseline',
  'justify-center', 'justify-between',
  'grid', 'grid-cols-1', 'grid-cols-5', 'sm:grid-cols-2', 'lg:grid-cols-5',
  'inline-flex', 'inline-block',
  'w-full', 'h-4', 'h-24',

  // Hover/Interactive
  'hover:shadow-teal', 'hover:shadow-elevated', 'hover:bg-pulse-100', 'hover:bg-teal-50',
  'hover:bg-pulse-50', 'hover:bg-red-50',
  'hover:text-teal-50',
  'hover:outline-none',
  'cursor-pointer', 'cursor-not-allowed',

  // Interactive States
  'opacity-50', 'disabled:opacity-50',
  'transition-shadow', 'transition-all', 'duration-150',

  // Animation
  'animate-pulse',

  // Responsive
  'sm:grid-cols-2', 'lg:grid-cols-5',
  'overflow-x-auto', 'overflow-hidden',

  // Misc
  'tabIndex', 'tabindex', 'tab-index',
  'min-h-screen', 'max-w-6xl',
  'mx-auto',
  'text-left', 'text-right', 'text-center',
  'py-2', 'divide-y', 'divide-pulse-100',
  'divide-pulse-200', 'border-b', 'border-b-pulse-200',
  'prefers-reduced-motion'
])

// Disallowed raw Tailwind classes
const FORBIDDEN_PATTERNS = [
  /\btext-xs\b/, /\btext-sm\b/, /\btext-base\b/, /\btext-lg\b/, /\btext-xl\b/,
  /\btext-2xl\b/, /\btext-3xl\b/, /\btext-4xl\b/, /\btext-5xl\b/, /\btext-6xl\b/,
  /\bp-\d\b/, /\bpx-\d\b/, /\bpy-\d\b/, /\bgap-\d\b(?!-)/,
  /\bm-\d\b/, /\bmt-\d\b/, /\bmb-\d\b/, /\bmr-\d\b/, /\bml-\d\b/,
  /\bmin-w-/,
  // Warn on raw Tailwind arbitrary values (which circumvent design system)
  /\b(?:text|bg|border|p|m|w|h)-\[/
]

function scanFile(filepath) {
  const content = readFileSync(filepath, 'utf8')
  const errors = []

  // Extract all className attributes
  const classNameRegex = /className=["']([^"']+)["']/g
  let match

  while ((match = classNameRegex.exec(content)) !== null) {
    const classes = match[1].split(/\s+/).filter(Boolean)

    for (const cls of classes) {
      // Check if it matches forbidden patterns
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(cls)) {
          errors.push({
            line: content.substring(0, match.index).split('\n').length,
            class: cls,
            message: `Raw Tailwind class "${cls}" found. Use design token semantic classes instead.`
          })
          break
        }
      }

      // Check if it's a known allowed class
      if (!ALLOWED_TOKEN_CLASSES.has(cls) && !cls.includes(':') && !cls.includes('[')) {
        // Some allowed prefixed classes (e.g., sm:, lg:, hover:, focus:)
        const isValidPrefix = cls.match(/^(sm|md|lg|xl|2xl|sm-grid|hover|focus|disabled|group|dark|print):/)
        if (!isValidPrefix) {
          // Allow Tailwind utilities that are part of design system
          const isUtility = cls.match(/^(flex|grid|items|justify|inline|block|w|h|rounded|border|py|px|mt|mb|gap|opacity|transform|transition|duration|animate|cursor|overflow|min-h|max-w|mx|text-|bg-|border-|shadow|divide|space|absolute|relative|top|bottom|left|right|z)/)
          if (isUtility && !FORBIDDEN_PATTERNS.some(p => p.test(cls))) {
            continue
          }

          // Otherwise flag it
          errors.push({
            line: content.substring(0, match.index).split('\n').length,
            class: cls,
            message: `Unknown class "${cls}". Use design token semantic classes from src/ui/components.tsx.`
          })
        }
      }
    }
  }

  return errors
}

function walkDir(dir) {
  const errors = []

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Skip node_modules, dist, .git, etc.
      if (['.', 'node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) {
        continue
      }
      errors.push(...walkDir(resolve(dir, entry.name)))
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      const filepath = resolve(dir, entry.name)
      const fileErrors = scanFile(filepath)
      errors.push(...fileErrors.map(e => ({ ...e, filepath })))
    }
  }

  return errors
}

const errors = walkDir(SRC)

if (errors.length > 0) {
  console.error('\n❌ Design Token Validation Failed\n')
  for (const err of errors) {
    console.error(`${err.filepath}:${err.line}\n  ${err.message}\n`)
  }
  console.error(`\nFound ${errors.length} design token violation(s).\n`)
  process.exit(1)
} else {
  console.log('✅ Design tokens validated successfully.')
  process.exit(0)
}

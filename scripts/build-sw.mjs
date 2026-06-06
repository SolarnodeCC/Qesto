#!/usr/bin/env node
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

mkdirSync(dirname('public/sw.js'), { recursive: true })

await build({
  entryPoints: ['src/sw.ts'],
  outfile: 'public/sw.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  logLevel: 'info',
  banner: {
    js: [
      '/* AUTO-GENERATED from src/sw.ts — do not edit by hand.',
      '   Regenerate: npm run build:sw */',
    ].join('\n'),
  },
})
